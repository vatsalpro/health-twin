from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, RiskPrediction, User
from app.schemas.models import SimulationRequest, SimulationResponse, FeatureContribution
from app.api.deps import get_current_user, verify_patient_access
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}/simulate", tags=["Simulation Lab"])

@router.post("", response_model=SimulationResponse)
def simulate_scenario(
    patient_id: str,
    req: SimulationRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    # Retrieve baseline prediction if available
    baseline_pred = None
    if req.baseline_prediction_id:
        baseline_pred = db.query(RiskPrediction).filter(RiskPrediction.id == req.baseline_prediction_id).first()
    if not baseline_pred:
        baseline_pred = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.patient_id == patient_id, RiskPrediction.is_insufficient_data == False)
            .order_by(desc(RiskPrediction.prediction_timestamp))
            .first()
        )

    baseline_risk = baseline_pred.risk_score if baseline_pred else 0.12

    sim_result = prediction_engine.simulate_scenario(
        patient=patient,
        ga_weeks=req.gestational_age_weeks,
        sbp=req.sbp,
        dbp=req.dbp,
        proteinuria_dipstick=req.proteinuria_dipstick,
        platelets=req.platelets,
        ast=req.ast,
        alt=req.alt,
        serum_creatinine=req.serum_creatinine,
        baseline_risk=baseline_risk
    )

    audit_service.log_event(
        db=db,
        action="SCENARIO_SIMULATION_EXECUTED",
        user=current_user,
        target_type="SimulationLab",
        target_id=patient_id,
        details={
            "sbp": req.sbp,
            "dbp": req.dbp,
            "simulated_risk": sim_result["simulated_risk_score"],
            "delta": sim_result["delta_risk_score"]
        }
    )

    contributions = [
        FeatureContribution(
            feature_name=c["feature_name"],
            feature_label=c["feature_label"],
            value=c.get("value"),
            contribution=c["contribution"],
            direction=c["direction"]
        )
        for c in sim_result["feature_contributions"]
    ]

    return SimulationResponse(
        scenario_label=sim_result["scenario_label"],
        is_causal_treatment_claim=sim_result["is_causal_treatment_claim"],
        warning=sim_result["warning"],
        baseline_risk_score=sim_result["baseline_risk_score"],
        simulated_risk_score=sim_result["simulated_risk_score"],
        simulated_risk_category=sim_result["simulated_risk_category"],
        delta_risk_score=sim_result["delta_risk_score"],
        feature_contributions=contributions,
        model_version=sim_result["model_version"]
    )
