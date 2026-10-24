import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_clinician, verify_patient_access
from app.models.entities import User, PatientProfile, MedicationOrder, MedicationDoseLog
from app.schemas.models import (
    MedicationOrderCreate,
    MedicationOrderResponse,
    MedicationDoseLogCreate,
    MedicationDoseLogResponse
)
from app.services.medication_service import medication_service

router = APIRouter(prefix="/medications", tags=["Medications"])

def map_order_to_response(order: MedicationOrder) -> MedicationOrderResponse:
    timing = []
    if order.timing_json:
        try:
            timing = json.loads(order.timing_json)
        except Exception:
            timing = []
    return MedicationOrderResponse(
        id=order.id,
        patient_id=order.patient_id,
        prescribing_clinician_id=order.prescribing_clinician_id,
        prescribing_clinician_name=order.prescribing_clinician.full_name if order.prescribing_clinician else None,
        medication_name=order.medication_name,
        strength=order.strength,
        formulation=order.formulation,
        prescribed_dose=order.prescribed_dose,
        route=order.route,
        frequency=order.frequency,
        timing_slots=timing,
        start_date=order.start_date,
        end_date=order.end_date,
        clinician_instructions=order.clinician_instructions,
        warnings_precautions=order.warnings_precautions,
        status=order.status,
        version=order.version,
        approved_by_id=order.approved_by_id,
        approved_at=order.approved_at,
        discontinued_at=order.discontinued_at,
        discontinued_reason=order.discontinued_reason,
        created_at=order.created_at,
        updated_at=order.updated_at
    )

@router.get("/orders", response_model=List[MedicationOrderResponse])
def get_patient_medication_orders(
    patient_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all medication orders for a specific patient (enforces access control)."""
    verify_patient_access(patient_id, current_user, db)
    query = db.query(MedicationOrder).filter(MedicationOrder.patient_id == patient_id)
    if status:
        query = query.filter(MedicationOrder.status == status.upper())
    orders = query.order_by(MedicationOrder.created_at.desc()).all()
    return [map_order_to_response(o) for o in orders]

@router.post("/orders", response_model=MedicationOrderResponse, status_code=status.HTTP_201_CREATED)
def create_medication_order(
    payload: MedicationOrderCreate,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician creates a new medication order (starts in DRAFT status)."""
    try:
        order = medication_service.create_order(
            db=db,
            patient_id=payload.patient_id,
            clinician=clinician,
            order_data=payload.model_dump()
        )
        return map_order_to_response(order)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

@router.get("/orders/{order_id}", response_model=MedicationOrderResponse)
def get_medication_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve details of a single medication order."""
    order = db.query(MedicationOrder).filter(MedicationOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    verify_patient_access(order.patient_id, current_user, db)
    return map_order_to_response(order)

@router.post("/orders/{order_id}/approve", response_model=MedicationOrderResponse)
def approve_medication_order(
    order_id: str,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician approves a medication order, activating reminders and patient schedule."""
    try:
        order = medication_service.approve_order(db=db, order_id=order_id, clinician=clinician)
        return map_order_to_response(order)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

@router.post("/orders/{order_id}/discontinue", response_model=MedicationOrderResponse)
def discontinue_medication_order(
    order_id: str,
    reason: str,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician discontinues a medication order with reason."""
    try:
        order = medication_service.discontinue_order(db=db, order_id=order_id, clinician=clinician, reason=reason)
        return map_order_to_response(order)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

@router.post("/orders/{order_id}/log-dose", response_model=MedicationDoseLogResponse)
def log_medication_dose(
    order_id: str,
    payload: MedicationDoseLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Patient logs a dose taken, missed, or side effects."""
    order = db.query(MedicationOrder).filter(MedicationOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    verify_patient_access(order.patient_id, current_user, db)

    try:
        log = medication_service.log_dose(
            db=db,
            order_id=order_id,
            patient_id=order.patient_id,
            user=current_user,
            dose_data=payload.model_dump()
        )
        return MedicationDoseLogResponse(
            id=log.id,
            order_id=log.order_id,
            patient_id=log.patient_id,
            medication_name=order.medication_name,
            scheduled_time=log.scheduled_time,
            logged_time=log.logged_time,
            status=log.status,
            patient_notes=log.patient_notes,
            reported_side_effects=log.reported_side_effects,
            reported_side_effects_severity=log.reported_side_effects_severity,
            created_at=log.created_at
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@router.get("/orders/{order_id}/dose-logs", response_model=List[MedicationDoseLogResponse])
def get_order_dose_logs(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get history of logged doses for an order."""
    order = db.query(MedicationOrder).filter(MedicationOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    verify_patient_access(order.patient_id, current_user, db)

    logs = db.query(MedicationDoseLog).filter(
        MedicationDoseLog.order_id == order_id
    ).order_by(MedicationDoseLog.logged_time.desc()).all()

    return [
        MedicationDoseLogResponse(
            id=l.id,
            order_id=l.order_id,
            patient_id=l.patient_id,
            medication_name=order.medication_name,
            scheduled_time=l.scheduled_time,
            logged_time=l.logged_time,
            status=l.status,
            patient_notes=l.patient_notes,
            reported_side_effects=l.reported_side_effects,
            reported_side_effects_severity=l.reported_side_effects_severity,
            created_at=l.created_at
        )
        for l in logs
    ]

@router.get("/monographs")
def get_all_monographs(
    current_user: User = Depends(get_current_user)
):
    """Retrieve all evidence-based maternal drug monographs."""
    from app.services.medication_service import MATERNAL_DRUG_MONOGRAPHS
    return MATERNAL_DRUG_MONOGRAPHS

@router.get("/reference/{medication_name}")
@router.get("/monographs/{medication_name}")
async def get_medication_reference(
    medication_name: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieve approved clinical drug reference monograph (verified library + local Ollama generation fallback)."""
    mono = await medication_service.get_or_generate_drug_monograph(medication_name)
    if not mono:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No approved reference monograph found for this drug")
    return mono

@router.get("/patient/{patient_id}/summary")
def get_patient_medication_summary(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve adherence and active prescription summary for a patient."""
    verify_patient_access(patient_id, current_user, db)
    return medication_service.get_patient_adherence_summary(db=db, patient_id=patient_id)

@router.post("/patient/{patient_id}/generate-reminders")
def generate_patient_medication_reminders(
    patient_id: str,
    days_ahead: int = 2,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger automated schedule dose reminder generation."""
    verify_patient_access(patient_id, current_user, db)
    count = medication_service.generate_reminders_for_patient(db=db, patient_id=patient_id, days_ahead=days_ahead)
    return {"status": "success", "reminders_created": count}
