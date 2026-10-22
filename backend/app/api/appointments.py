from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_clinician, verify_patient_access
from app.models.entities import User, PatientProfile, Appointment, DoctorAvailability
from app.schemas.models import (
    DoctorAvailabilityConfig,
    DoctorAvailabilityResponse,
    TimeSlotResponse,
    AppointmentBookRequest,
    AppointmentRescheduleRequest,
    AppointmentCancelRequest,
    AppointmentResponse,
)
from app.services.appointment_service import appointment_service

router = APIRouter(prefix="/appointments", tags=["Appointments"])

def map_appointment_to_response(appt: Appointment) -> AppointmentResponse:
    patient_name = f"{appt.patient.first_name} {appt.patient.last_name}" if appt.patient else None
    doctor_name = appt.doctor.full_name if appt.doctor else None
    return AppointmentResponse(
        id=appt.id,
        patient_id=appt.patient_id,
        patient_name=patient_name,
        doctor_id=appt.doctor_id,
        doctor_name=doctor_name,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        appointment_type=appt.appointment_type,
        reason=appt.reason,
        booking_channel=appt.booking_channel,
        cancellation_reason=appt.cancellation_reason,
        created_at=appt.created_at
    )

@router.get("", response_model=List[AppointmentResponse])
def get_appointments(
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve appointments for authenticated user or specific patient."""
    query = db.query(Appointment)
    if current_user.role == "patient":
        patient = current_user.patient_profile
        if not patient:
            return []
        query = query.filter(Appointment.patient_id == patient.id)
    elif current_user.role in ("clinician", "admin"):
        if patient_id:
            verify_patient_access(patient_id, current_user, db)
            query = query.filter(Appointment.patient_id == patient_id)
        else:
            # Show appointments for this clinician
            query = query.filter(Appointment.doctor_id == current_user.id)

    if status:
        query = query.filter(Appointment.status == status.upper())

    appts = query.order_by(Appointment.start_time.asc()).all()
    return [map_appointment_to_response(a) for a in appts]

@router.get("/doctor/{doctor_id}/availability", response_model=List[DoctorAvailabilityResponse])
def get_doctor_availability(
    doctor_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve doctor's weekly working schedule rules."""
    rules = db.query(DoctorAvailability).filter(
        DoctorAvailability.doctor_id == doctor_id
    ).order_by(DoctorAvailability.day_of_week.asc()).all()

    doctor = db.query(User).filter(User.id == doctor_id).first()
    doc_name = doctor.full_name if doctor else None

    return [
        DoctorAvailabilityResponse(
            id=r.id,
            doctor_id=r.doctor_id,
            doctor_name=doc_name,
            day_of_week=r.day_of_week,
            start_time=r.start_time,
            end_time=r.end_time,
            slot_duration_minutes=r.slot_duration_minutes,
            break_start=r.break_start,
            break_end=r.break_end,
            timezone=r.timezone,
            is_active=r.is_active,
            max_daily_capacity=r.max_daily_capacity,
            created_at=r.created_at
        )
        for r in rules
    ]

@router.post("/doctor/{doctor_id}/availability", response_model=DoctorAvailabilityResponse)
def set_doctor_availability(
    doctor_id: str,
    payload: DoctorAvailabilityConfig,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Configure or update weekly working schedule for a doctor (single day)."""
    if clinician.role != "admin" and clinician.id != doctor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot alter another doctor's schedule")

    try:
        rule = appointment_service.set_doctor_availability(
            db=db,
            doctor_id=doctor_id,
            config=payload.model_dump()
        )
        return DoctorAvailabilityResponse(
            id=rule.id,
            doctor_id=rule.doctor_id,
            doctor_name=clinician.full_name,
            day_of_week=rule.day_of_week,
            start_time=rule.start_time,
            end_time=rule.end_time,
            slot_duration_minutes=rule.slot_duration_minutes,
            break_start=rule.break_start,
            break_end=rule.break_end,
            timezone=rule.timezone,
            is_active=rule.is_active,
            max_daily_capacity=rule.max_daily_capacity,
            created_at=rule.created_at
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@router.put("/doctor/{doctor_id}/availability", response_model=List[DoctorAvailabilityResponse])
@router.post("/doctor/{doctor_id}/schedule", response_model=List[DoctorAvailabilityResponse])
def set_doctor_schedule_bulk(
    doctor_id: str,
    payload: List[DoctorAvailabilityConfig],
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Configure or update the entire weekly working schedule for a doctor."""
    if clinician.role != "admin" and clinician.id != doctor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot alter another doctor's schedule")

    results = []
    for day_config in payload:
        rule = appointment_service.set_doctor_availability(
            db=db,
            doctor_id=doctor_id,
            config=day_config.model_dump()
        )
        results.append(
            DoctorAvailabilityResponse(
                id=rule.id,
                doctor_id=rule.doctor_id,
                doctor_name=clinician.full_name,
                day_of_week=rule.day_of_week,
                start_time=rule.start_time,
                end_time=rule.end_time,
                slot_duration_minutes=rule.slot_duration_minutes,
                break_start=rule.break_start,
                break_end=rule.break_end,
                timezone=rule.timezone,
                is_active=rule.is_active,
                max_daily_capacity=rule.max_daily_capacity,
                created_at=rule.created_at
            )
        )
    return results

@router.get("/doctor/{doctor_id}/slots", response_model=List[TimeSlotResponse])
def get_available_slots(
    doctor_id: str,
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate available conflict-free booking time slots for a doctor."""
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else date.today() + timedelta(days=1)
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else s_date + timedelta(days=7)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Expected YYYY-MM-DD")

    slots = appointment_service.get_available_slots(db, doctor_id, s_date, e_date)
    return [
        TimeSlotResponse(
            doctor_id=s["doctor_id"],
            doctor_name=s["doctor_name"],
            start_time=s["start_time"],
            end_time=s["end_time"],
            formatted_time=s["formatted_time"],
            formatted_date=s["formatted_date"],
            is_available=s["is_available"]
        )
        for s in slots
    ]

@router.post("/book", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentBookRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atomically book an appointment slot (prevents concurrent double booking)."""
    verify_patient_access(payload.patient_id, current_user, db)

    try:
        appt = appointment_service.book_appointment(
            db=db,
            patient_id=payload.patient_id,
            doctor_id=payload.doctor_id,
            start_time=payload.start_time,
            reason=payload.reason,
            appointment_type=payload.appointment_type,
            booking_channel=payload.booking_channel
        )
        return map_appointment_to_response(appt)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ve))

@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: str,
    payload: AppointmentRescheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reschedule an existing appointment."""
    try:
        appt = appointment_service.reschedule_appointment(
            db=db,
            appointment_id=appointment_id,
            new_start_time=payload.new_start_time,
            user=current_user,
            reason=payload.reason
        )
        return map_appointment_to_response(appt)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ve))

@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: str,
    payload: AppointmentCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an appointment with reason."""
    try:
        appt = appointment_service.cancel_appointment(
            db=db,
            appointment_id=appointment_id,
            user=current_user,
            cancellation_reason=payload.cancellation_reason
        )
        return map_appointment_to_response(appt)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
