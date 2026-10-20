from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import (
    User,
    PatientProfile,
    PregnancyEpisode,
    MedicalDocument,
    ClinicalObservation,
    RiskPrediction,
)
from app.schemas.models import PatientProfileSchema, PregnancyEpisodeSchema
from app.api.deps import get_current_user, verify_patient_access

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientProfileSchema])
def list_patients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role in ("clinician", "admin"):
        patients = db.query(PatientProfile).all()
    else:
        patients = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).all()

    result = []
    for p in patients:
        episodes_data = [
            PregnancyEpisodeSchema(
                id=ep.id,
                patient_id=ep.patient_id,
                conception_date=ep.conception_date,
                estimated_due_date=ep.estimated_due_date,
                current_gestational_age_weeks=ep.current_gestational_age_weeks,
                is_active=ep.is_active,
                outcome_preeclampsia_diagnosed=ep.outcome_preeclampsia_diagnosed,
                outcome_diagnosis_date=ep.outcome_diagnosis_date,
                outcome_diagnosis_notes=ep.outcome_diagnosis_notes,
            )
            for ep in p.episodes
        ]
        result.append(
            PatientProfileSchema(
                id=p.id,
                user_id=p.user_id,
                mrn=p.mrn,
                first_name=p.first_name,
                last_name=p.last_name,
                date_of_birth=p.date_of_birth,
                maternal_age=p.maternal_age,
                bmi=p.bmi,
                gravidity=p.gravidity,
                parity=p.parity,
                chronic_hypertension=p.chronic_hypertension,
                pregestational_diabetes=p.pregestational_diabetes,
                prior_preeclampsia=p.prior_preeclampsia,
                renal_disease=p.renal_disease,
                autoimmune_disease=p.autoimmune_disease,
                multiple_gestation=p.multiple_gestation,
                is_synthetic=p.is_synthetic,
                created_at=p.created_at,
                episodes=episodes_data
            )
        )
    return result

@router.get("/{patient_id}", response_model=PatientProfileSchema)
def get_patient(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access)
):
    episodes_data = [
        PregnancyEpisodeSchema(
            id=ep.id,
            patient_id=ep.patient_id,
            conception_date=ep.conception_date,
            estimated_due_date=ep.estimated_due_date,
            current_gestational_age_weeks=ep.current_gestational_age_weeks,
            is_active=ep.is_active,
            outcome_preeclampsia_diagnosed=ep.outcome_preeclampsia_diagnosed,
            outcome_diagnosis_date=ep.outcome_diagnosis_date,
            outcome_diagnosis_notes=ep.outcome_diagnosis_notes,
        )
        for ep in patient.episodes
    ]
    return PatientProfileSchema(
        id=patient.id,
        user_id=patient.user_id,
        mrn=patient.mrn,
        first_name=patient.first_name,
        last_name=patient.last_name,
        date_of_birth=patient.date_of_birth,
        maternal_age=patient.maternal_age,
        bmi=patient.bmi,
        gravidity=patient.gravidity,
        parity=patient.parity,
        chronic_hypertension=patient.chronic_hypertension,
        pregestational_diabetes=patient.pregestational_diabetes,
        prior_preeclampsia=patient.prior_preeclampsia,
        renal_disease=patient.renal_disease,
        autoimmune_disease=patient.autoimmune_disease,
        multiple_gestation=patient.multiple_gestation,
        is_synthetic=patient.is_synthetic,
        created_at=patient.created_at,
        episodes=episodes_data
    )

@router.get("/{patient_id}/timeline")
def get_longitudinal_timeline(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Constructs an aggregated chronological stream of maternal events:
    - Uploaded documents
    - Accepted observations (grouped by date/visit)
    - Model risk forecasts
    - Verification outcomes
    """
    timeline_events: List[Dict[str, Any]] = []

    # Documents
    documents = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id).all()
    for doc in documents:
        timeline_events.append({
            "type": "DOCUMENT_UPLOAD",
            "id": doc.id,
            "timestamp": doc.created_at.isoformat(),
            "title": f"Report: {doc.category}",
            "description": f"{doc.filename} ({doc.page_count} pages) - Status: {doc.processing_status}",
            "metadata": {
                "category": doc.category,
                "source_institution": doc.source_institution,
                "report_date": doc.report_date,
                "processing_status": doc.processing_status
            }
        })

    # Accepted observations
    observations = (
        db.query(ClinicalObservation)
        .filter(ClinicalObservation.patient_id == patient_id)
        .order_by(desc(ClinicalObservation.measurement_timestamp))
        .all()
    )
    for obs in observations:
        timeline_events.append({
            "type": "CLINICAL_OBSERVATION",
            "id": obs.id,
            "timestamp": obs.measurement_timestamp.isoformat(),
            "title": f"{obs.test_name}: {obs.value_numeric if obs.value_numeric is not None else obs.value_text} {obs.unit or ''}",
            "description": f"Gestational Age: {obs.gestational_age_weeks:.1f} weeks | Source: {obs.source_type}",
            "metadata": {
                "test_name": obs.test_name,
                "value": obs.value_numeric if obs.value_numeric is not None else obs.value_text,
                "unit": obs.unit,
                "is_abnormal": obs.is_abnormal,
                "gestational_age_weeks": obs.gestational_age_weeks,
                "review_status": obs.review_status,
                "source_type": obs.source_type,
            }
        })

    # Predictions
    predictions = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.patient_id == patient_id)
        .order_by(desc(RiskPrediction.prediction_timestamp))
        .all()
    )
    for pred in predictions:
        timeline_events.append({
            "type": "RISK_PREDICTION",
            "id": pred.id,
            "timestamp": pred.prediction_timestamp.isoformat(),
            "title": f"14-Day Preeclampsia Risk Forecast: {round(pred.risk_score * 100, 1)}% ({pred.risk_category})" if not pred.is_insufficient_data else f"Preeclampsia Model: {pred.risk_category}",
            "description": f"Gestational Age: {pred.gestational_age_weeks:.1f}w | Model: {pred.model_version}",
            "metadata": {
                "risk_score": pred.risk_score,
                "risk_category": pred.risk_category,
                "is_insufficient_data": pred.is_insufficient_data,
                "insufficient_data_reason": pred.insufficient_data_reason,
                "model_version": pred.model_version,
                "horizon_days": pred.prediction_horizon_days,
            }
        })

    # Sort descending by timestamp
    timeline_events.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "patient_id": patient_id,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "mrn": patient.mrn,
        "events_count": len(timeline_events),
        "events": timeline_events
    }
