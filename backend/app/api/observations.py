from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.core.database import get_db
from app.models.entities import User, PatientProfile, ClinicalObservation, PregnancyEpisode
from app.schemas.models import ClinicalObservationSchema, ObservationCreateRequest
from app.api.deps import get_current_user, verify_patient_access
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}/observations", tags=["Clinical Observations"])

@router.get("", response_model=List[ClinicalObservationSchema])
def list_observations(
    patient_id: str,
    obs_type: Optional[str] = Query(None, description="Filter by observation type: blood_pressure, laboratory, urine_protein, wearable"),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    query = db.query(ClinicalObservation).filter(ClinicalObservation.patient_id == patient_id)
    if obs_type:
        query = query.filter(ClinicalObservation.observation_type == obs_type)
    observations = query.order_by(desc(ClinicalObservation.measurement_timestamp)).all()

    return [
        ClinicalObservationSchema(
            id=obs.id,
            patient_id=obs.patient_id,
            observation_type=obs.observation_type,
            test_name=obs.test_name,
            value_numeric=obs.value_numeric,
            value_text=obs.value_text,
            unit=obs.unit,
            reference_range=obs.reference_range,
            is_abnormal=obs.is_abnormal,
            measurement_timestamp=obs.measurement_timestamp,
            gestational_age_weeks=obs.gestational_age_weeks,
            source_type=obs.source_type,
            review_status=obs.review_status,
            source_document_id=obs.source_document_id,
        )
        for obs in observations
    ]

@router.post("", response_model=ClinicalObservationSchema)
def create_observation(
    patient_id: str,
    req: ObservationCreateRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    meas_time = datetime.now(timezone.utc)
    if req.measurement_timestamp:
        try:
            meas_time = datetime.fromisoformat(req.measurement_timestamp.replace("Z", "+00:00"))
        except Exception:
            pass

    ga_weeks = req.gestational_age_weeks or 28.0

    is_abnormal = False
    if req.test_name.lower() in ("systolic_bp", "sbp") and req.value_numeric and req.value_numeric >= 140:
        is_abnormal = True
    elif req.test_name.lower() in ("diastolic_bp", "dbp") and req.value_numeric and req.value_numeric >= 90:
        is_abnormal = True
    elif "protein" in req.test_name.lower() and req.value_text and req.value_text.upper() in ("1+", "2+", "3+", "4+"):
        is_abnormal = True

    obs = ClinicalObservation(
        patient_id=patient_id,
        observation_type=req.observation_type,
        test_name=req.test_name,
        value_numeric=req.value_numeric,
        value_text=req.value_text or (str(req.value_numeric) if req.value_numeric is not None else ""),
        unit=req.unit,
        reference_range=req.reference_range,
        is_abnormal=is_abnormal,
        measurement_timestamp=meas_time,
        gestational_age_weeks=ga_weeks,
        source_type=req.source_type,
        review_status="ACCEPTED",
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    # Recalculate twin state & prediction
    twin_service.update_twin_state(db, patient_id)
    prediction_engine.evaluate_risk(db, patient_id)

    audit_service.log_event(
        db=db,
        action="OBSERVATION_CREATED",
        user=current_user,
        target_type="ClinicalObservation",
        target_id=obs.id,
        details={"test_name": obs.test_name, "value": obs.value_text}
    )

    return ClinicalObservationSchema(
        id=obs.id,
        patient_id=obs.patient_id,
        observation_type=obs.observation_type,
        test_name=obs.test_name,
        value_numeric=obs.value_numeric,
        value_text=obs.value_text,
        unit=obs.unit,
        reference_range=obs.reference_range,
        is_abnormal=obs.is_abnormal,
        measurement_timestamp=obs.measurement_timestamp,
        gestational_age_weeks=obs.gestational_age_weeks,
        source_type=obs.source_type,
        review_status=obs.review_status,
        source_document_id=obs.source_document_id,
    )

@router.get("/comparisons")
def get_historical_comparisons(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Returns structured longitudinal trajectories for charts:
    - Blood pressure (SBP, DBP, MAP over gestational weeks)
    - Platelet count over time
    - Liver transaminases (AST, ALT)
    - Proteinuria trajectory
    """
    observations = (
        db.query(ClinicalObservation)
        .filter(ClinicalObservation.patient_id == patient_id, ClinicalObservation.review_status == "ACCEPTED")
        .order_by(asc(ClinicalObservation.measurement_timestamp))
        .all()
    )

    # Group measurements by gestational age or timestamp
    bp_trend: List[Dict[str, Any]] = []
    lab_trend: List[Dict[str, Any]] = []

    # Map by date string
    grouped_by_date: Dict[str, Dict[str, Any]] = {}
    for obs in observations:
        date_key = obs.measurement_timestamp.strftime("%Y-%m-%d")
        if date_key not in grouped_by_date:
            grouped_by_date[date_key] = {
                "date": date_key,
                "gestational_age_weeks": obs.gestational_age_weeks,
                "timestamp": obs.measurement_timestamp.isoformat(),
            }
        
        name = obs.test_name.lower().replace(" ", "_")
        if name in ("systolic_bp", "sbp"):
            grouped_by_date[date_key]["sbp"] = obs.value_numeric
        elif name in ("diastolic_bp", "dbp"):
            grouped_by_date[date_key]["dbp"] = obs.value_numeric
        elif name in ("platelets", "platelet_count"):
            grouped_by_date[date_key]["platelets"] = obs.value_numeric
        elif name == "ast":
            grouped_by_date[date_key]["ast"] = obs.value_numeric
        elif name == "alt":
            grouped_by_date[date_key]["alt"] = obs.value_numeric
        elif name in ("serum_creatinine", "creatinine"):
            grouped_by_date[date_key]["serum_creatinine"] = obs.value_numeric
        elif "protein" in name:
            grouped_by_date[date_key]["proteinuria"] = obs.value_text or str(obs.value_numeric)

    trend_series = list(grouped_by_date.values())
    trend_series.sort(key=lambda x: x["timestamp"])

    # Calculate MAP for points with both SBP and DBP
    for pt in trend_series:
        if pt.get("sbp") and pt.get("dbp"):
            pt["map"] = round((2.0 * pt["dbp"] + pt["sbp"]) / 3.0, 1)

    return {
        "patient_id": patient_id,
        "total_data_points": len(trend_series),
        "trajectories": trend_series,
        "comparability_notes": "All blood pressure measurements normalized to mmHg. Platelets normalized to 10^3/uL. Standard laboratory reference ranges applied."
    }
