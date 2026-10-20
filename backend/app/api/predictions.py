import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, RiskPrediction, User
from app.schemas.models import RiskPredictionSchema, FeatureContribution
from app.api.deps import get_current_user, verify_patient_access
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(tags=["Preeclampsia Risk Prediction"])

def _format_prediction_schema(pred: RiskPrediction) -> RiskPredictionSchema:
    contributions = []
    if pred.feature_contributions_json:
        try:
            raw_contribs = json.loads(pred.feature_contributions_json)
            for c in raw_contribs:
                contributions.append(
                    FeatureContribution(
                        feature_name=c.get("feature_name", ""),
                        feature_label=c.get("feature_label", ""),
                        value=c.get("value"),
                        contribution=float(c.get("contribution", 0.0)),
                        direction=c.get("direction", "neutral"),
                    )
                )
        except Exception:
            pass

    return RiskPredictionSchema(
        id=pred.id,
        patient_id=pred.patient_id,
        model_version=pred.model_version,
        prediction_timestamp=pred.prediction_timestamp,
        gestational_age_weeks=pred.gestational_age_weeks,
        prediction_horizon_days=pred.prediction_horizon_days,
        risk_score=pred.risk_score,
        risk_category=pred.risk_category or "UNKNOWN",
        confidence_interval_lower=pred.confidence_interval_lower,
        confidence_interval_upper=pred.confidence_interval_upper,
        calibration_status=pred.calibration_status or "calibrated_platt_scaling",
        feature_contributions=contributions,
        is_insufficient_data=pred.is_insufficient_data,
        insufficient_data_reason=pred.insufficient_data_reason,
        model_limitations=pred.model_limitations or "Research model intended strictly to support clinical review.",
    )

@router.get("/patients/{patient_id}/predictions", response_model=List[RiskPredictionSchema])
def list_patient_predictions(
    patient_id: str,
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    predictions = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.patient_id == patient_id)
        .order_by(desc(RiskPrediction.prediction_timestamp))
        .all()
    )
    return [_format_prediction_schema(p) for p in predictions]

@router.post("/patients/{patient_id}/predictions/recompute", response_model=RiskPredictionSchema)
def recompute_prediction(
    patient_id: str,
    as_of: Optional[str] = Query(None, description="ISO timestamp for historical replay reconstruction"),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    cutoff = datetime.now(timezone.utc)
    if as_of:
        try:
            cutoff = datetime.fromisoformat(as_of.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid 'as_of' timestamp format '{as_of}'. Provide a valid ISO-8601 string (e.g., '2026-06-01T10:00:00Z')."
            )

    pred = prediction_engine.evaluate_risk(db, patient_id, prediction_timestamp=cutoff)

    audit_service.log_event(
        db=db,
        action="PREDICTION_RECOMPUTED",
        user=current_user,
        target_type="RiskPrediction",
        target_id=pred.id,
        details={"risk_score": pred.risk_score, "is_insufficient_data": pred.is_insufficient_data}
    )

    return _format_prediction_schema(pred)

@router.get("/models/preeclampsia/evaluation")
def get_model_evaluation_metrics(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the scientific research model's performance metrics and dataset provenance.
    """
    return prediction_engine.get_evaluation_metrics()
