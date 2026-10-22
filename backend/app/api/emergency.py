import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_clinician, verify_patient_access
from app.models.entities import User, PatientProfile, EmergencyEvent, AuditEvent, utc_now
from app.schemas.models import (
    EmergencyEventResponse,
    EmergencyAcknowledgeRequest,
    EmergencyResolveRequest
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/emergency", tags=["Emergency Escalation"])

def map_emergency_to_response(event: EmergencyEvent) -> EmergencyEventResponse:
    rules = []
    if event.matched_rules_json:
        try:
            rules = json.loads(event.matched_rules_json)
        except Exception:
            rules = []
    patient_name = f"{event.patient.first_name} {event.patient.last_name}" if event.patient else None
    mrn = event.patient.mrn if event.patient else None

    return EmergencyEventResponse(
        id=event.id,
        patient_id=event.patient_id,
        patient_name=patient_name,
        patient_mrn=mrn,
        reported_by_user_id=event.reported_by_user_id,
        assigned_clinician_id=event.assigned_clinician_id,
        matched_rules=rules,
        reported_symptoms=event.reported_symptoms,
        severity_level=event.severity_level,
        status=event.status,
        acknowledged_by_id=event.acknowledged_by_id,
        acknowledged_at=event.acknowledged_at,
        resolution_notes=event.resolution_notes,
        escalated_at=event.escalated_at,
        delivery_attempts=event.delivery_attempts,
        created_at=event.created_at
    )

@router.get("/active", response_model=List[EmergencyEventResponse])
def get_active_emergencies(
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician views all active and escalated maternal emergency alerts."""
    # Run timeout escalation check
    notification_service.check_emergency_escalations(db, timeout_minutes=15)

    events = db.query(EmergencyEvent).filter(
        EmergencyEvent.status.in_(["ACTIVE", "ESCALATED_BACKUP"])
    ).order_by(EmergencyEvent.created_at.desc()).all()

    return [map_emergency_to_response(e) for e in events]

@router.post("/{event_id}/acknowledge", response_model=EmergencyEventResponse)
def acknowledge_emergency(
    event_id: str,
    payload: Optional[EmergencyAcknowledgeRequest] = None,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician acknowledges an emergency event, stopping further backup escalations."""
    event = db.query(EmergencyEvent).filter(EmergencyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency event not found")

    event.status = "ACKNOWLEDGED"
    event.acknowledged_by_id = clinician.id
    event.acknowledged_at = utc_now()
    if payload and payload.notes:
        event.resolution_notes = f"Acknowledgement note: {payload.notes}"
    db.commit()
    db.refresh(event)

    # Notify patient that doctor has acknowledged
    patient = event.patient
    if patient and patient.user_id:
        notification_service.create_notification(
            db=db,
            user_id=patient.user_id,
            patient_id=patient.id,
            category="DOCTOR_REPLY",
            title=f"Doctor Alert Acknowledged by Dr. {clinician.full_name}",
            message=(
                f"Dr. {clinician.full_name} has received and acknowledged your urgent symptom report. "
                f"The clinical care team is actively reviewing your chart."
            ),
            priority="HIGH",
            link_url="/emergency"
        )

    # Audit event
    audit = AuditEvent(
        user_id=clinician.id,
        user_email=clinician.email,
        action="EMERGENCY_ACKNOWLEDGED",
        target_type="EmergencyEvent",
        target_id=event.id,
        details_json=json.dumps({"acknowledged_by": clinician.full_name, "event_id": event.id})
    )
    db.add(audit)
    db.commit()

    return map_emergency_to_response(event)

@router.post("/{event_id}/resolve", response_model=EmergencyEventResponse)
def resolve_emergency(
    event_id: str,
    payload: EmergencyResolveRequest,
    clinician: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """Clinician resolves an emergency event with clinical outcome notes."""
    event = db.query(EmergencyEvent).filter(EmergencyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emergency event not found")

    event.status = "RESOLVED"
    event.resolution_notes = payload.resolution_notes
    db.commit()
    db.refresh(event)

    # Audit event
    audit = AuditEvent(
        user_id=clinician.id,
        user_email=clinician.email,
        action="EMERGENCY_RESOLVED",
        target_type="EmergencyEvent",
        target_id=event.id,
        details_json=json.dumps({"resolved_by": clinician.full_name, "notes": payload.resolution_notes})
    )
    db.add(audit)
    db.commit()

    return map_emergency_to_response(event)

@router.get("/patient/{patient_id}", response_model=List[EmergencyEventResponse])
def get_patient_emergency_history(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emergency history for a patient."""
    verify_patient_access(patient_id, current_user, db)
    events = db.query(EmergencyEvent).filter(
        EmergencyEvent.patient_id == patient_id
    ).order_by(EmergencyEvent.created_at.desc()).all()
    return [map_emergency_to_response(e) for e in events]
