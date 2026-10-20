import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, MaternalTwinState
from app.schemas.models import MaternalTwinStateSchema
from app.api.deps import verify_patient_access
from app.services.twin_service import twin_service

router = APIRouter(prefix="/patients/{patient_id}/twin", tags=["Maternal Digital Twin"])

def _format_twin_schema(state: MaternalTwinState) -> MaternalTwinStateSchema:
    missing = []
    if state.missing_indicators_json:
        try:
            missing = json.loads(state.missing_indicators_json)
        except Exception:
            pass

    telemetry = {}
    if state.telemetry_summary_json:
        try:
            telemetry = json.loads(state.telemetry_summary_json)
        except Exception:
            pass

    return MaternalTwinStateSchema(
        id=state.id,
        patient_id=state.patient_id,
        version=state.version,
        timestamp=state.timestamp,
        gestational_age_weeks=state.gestational_age_weeks,
        sbp=state.sbp,
        dbp=state.dbp,
        map_pressure=state.map_pressure,
        pulse_pressure=state.pulse_pressure,
        proteinuria_dipstick=state.proteinuria_dipstick,
        protein_creatinine_ratio=state.protein_creatinine_ratio,
        platelets=state.platelets,
        ast=state.ast,
        alt=state.alt,
        serum_creatinine=state.serum_creatinine,
        data_freshness_status=state.data_freshness_status,
        missing_indicators=missing,
        telemetry_summary=telemetry,
    )

@router.get("", response_model=MaternalTwinStateSchema)
def get_current_twin(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Fetches the latest versioned snapshot of the patient's maternal digital twin.
    If no snapshot exists yet, computes an initial baseline.
    """
    latest = (
        db.query(MaternalTwinState)
        .filter(MaternalTwinState.patient_id == patient_id)
        .order_by(desc(MaternalTwinState.version))
        .first()
    )
    if not latest:
        latest = twin_service.update_twin_state(db, patient_id)

    return _format_twin_schema(latest)

@router.get("/history", response_model=List[MaternalTwinStateSchema])
def get_twin_history(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Returns full versioned history of the maternal digital twin states for longitudinal replay.
    """
    history = (
        db.query(MaternalTwinState)
        .filter(MaternalTwinState.patient_id == patient_id)
        .order_by(desc(MaternalTwinState.version))
        .all()
    )
    return [_format_twin_schema(s) for s in history]
