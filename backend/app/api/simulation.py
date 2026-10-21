import io
import csv
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, RiskPrediction, User, SimulationScenario, MaternalTwinState
from app.schemas.models import (
    SimulationRequest,
    SimulationResponse,
    FeatureContribution,
    ScenarioSaveRequest,
    ScenarioUpdateRequest,
    ScenarioResponse,
)
from app.api.deps import get_current_user, verify_patient_access
from app.services.prediction_service import prediction_engine
from app.services.simulation_service import simulation_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}", tags=["Simulation Lab"])

@router.post("/simulate", response_model=SimulationResponse)
def simulate_scenario(
    patient_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Multi-category counterfactual simulation endpoint.
    Maintains 100% backward compatibility with legacy SimulationRequest
    while empowering the full 8-module Advanced Maternal Simulation Lab.
    """
    category = payload.get("category", "preeclampsia_risk")
    baseline_pred_id = payload.get("baseline_prediction_id")

    # Early physiological validation: SBP must be strictly greater than DBP whenever both are provided
    if "sbp" in payload and "dbp" in payload:
        try:
            val_sbp = float(payload["sbp"])
            val_dbp = float(payload["dbp"])
            if val_sbp <= val_dbp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Systolic blood pressure ({val_sbp} mmHg) must be strictly greater than diastolic blood pressure ({val_dbp} mmHg)."
                )
        except (ValueError, TypeError):
            pass

    # Check baseline prediction
    baseline_risk = None
    if baseline_pred_id:
        baseline_pred = (
            db.query(RiskPrediction)
            .filter(
                RiskPrediction.id == baseline_pred_id,
                RiskPrediction.patient_id == patient_id
            )
            .first()
        )
        if not baseline_pred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Baseline risk prediction '{baseline_pred_id}' not found for patient '{patient_id}'."
            )
        baseline_risk = baseline_pred.risk_score
    else:
        baseline_pred = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.patient_id == patient_id, RiskPrediction.is_insufficient_data == False)
            .order_by(desc(RiskPrediction.prediction_timestamp))
            .first()
        )
        if baseline_pred and baseline_pred.risk_score is not None:
            baseline_risk = baseline_pred.risk_score
        elif category == "preeclampsia_risk" and not payload.get("allow_uncalibrated_baseline"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient has no valid baseline risk prediction. Counterfactual simulation requires an existing baseline evaluation."
            )

    # Retrieve patient's verified living twin if available
    twin = (
        db.query(MaternalTwinState)
        .filter(MaternalTwinState.patient_id == patient_id)
        .order_by(desc(MaternalTwinState.timestamp))
        .first()
    )

    # 1. Preeclampsia Research Risk Scenario
    if category in ("preeclampsia_risk", "counterfactual"):
        if "sbp" in payload and "dbp" in payload:
            sbp = float(payload["sbp"])
            dbp = float(payload["dbp"])
        elif twin and twin.sbp and twin.dbp:
            sbp = float(twin.sbp)
            dbp = float(twin.dbp)
        else:
            sbp = float(payload.get("sbp", 120.0))
            dbp = float(payload.get("dbp", 80.0))

        if sbp <= dbp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Systolic blood pressure ({sbp} mmHg) must be strictly greater than diastolic blood pressure ({dbp} mmHg)."
            )

        ga_weeks = float(payload.get("gestational_age_weeks") or (twin.gestational_age_weeks if twin and twin.gestational_age_weeks else 28.0))
        prot = str(payload.get("proteinuria_dipstick") or (twin.proteinuria_dipstick if twin and twin.proteinuria_dipstick else "NEGATIVE"))
        platelets = float(payload.get("platelets") or (twin.platelets if twin and twin.platelets else 200.0))
        ast = float(payload.get("ast") or (twin.ast if twin and twin.ast else 25.0))
        alt = float(payload.get("alt") or (twin.alt if twin and twin.alt else 22.0))
        creat = float(payload.get("serum_creatinine") or (twin.serum_creatinine if twin and twin.serum_creatinine else 0.75))

        sim_result = simulation_service.simulate_preeclampsia_scenario(
            patient=patient,
            ga_weeks=ga_weeks,
            sbp=sbp,
            dbp=dbp,
            proteinuria_dipstick=prot,
            platelets=platelets,
            ast=ast,
            alt=alt,
            serum_creatinine=creat,
            baseline_risk=baseline_risk
        )

        contributions = [
            FeatureContribution(
                feature_name=c["feature_name"],
                feature_label=c["feature_label"],
                value=c.get("value"),
                contribution=c["contribution"],
                direction=c["direction"]
            )
            for c in sim_result.get("feature_contributions", [])
        ]

        audit_service.log_event(
            db=db,
            action="SCENARIO_SIMULATION_EXECUTED",
            user=current_user,
            target_type="SimulationLab",
            target_id=patient_id,
            details={"category": category, "sbp": sbp, "dbp": dbp, "simulated_risk": sim_result["simulated_risk_score"]}
        )

        return SimulationResponse(
            scenario_label=sim_result.get("scenario_label", "Preeclampsia Research Scenario"),
            is_causal_treatment_claim=False,
            warning=sim_result.get("warning", ""),
            baseline_risk_score=sim_result.get("baseline_risk_score"),
            simulated_risk_score=sim_result.get("simulated_risk_score", 0.0),
            simulated_risk_category=sim_result.get("simulated_risk_category", "LOW"),
            delta_risk_score=sim_result.get("delta_risk_score", 0.0),
            feature_contributions=contributions,
            model_version=sim_result.get("model_version", "v1.4.2-longitudinal-preeclampsia"),
            category="preeclampsia_risk",
            detailed_results=sim_result,
            uncertainty_interval=sim_result.get("uncertainty_interval")
        )

    # 2. Blood Pressure & Cardiovascular Trends
    elif category == "cardiovascular":
        if "sbp" in payload and "dbp" in payload:
            sbp = float(payload["sbp"])
            dbp = float(payload["dbp"])
        elif twin and twin.sbp and twin.dbp:
            sbp = float(twin.sbp)
            dbp = float(twin.dbp)
        else:
            sbp = float(payload.get("sbp", 130.0))
            dbp = float(payload.get("dbp", 82.0))

        if sbp <= dbp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Systolic blood pressure ({sbp} mmHg) must be strictly greater than diastolic blood pressure ({dbp} mmHg)."
            )

        if "baseline_sbp" in payload and "baseline_dbp" in payload:
            base_sbp = float(payload["baseline_sbp"])
            base_dbp = float(payload["baseline_dbp"])
        elif twin and twin.sbp and twin.dbp:
            base_sbp = float(twin.sbp)
            base_dbp = float(twin.dbp)
        else:
            base_sbp = 120.0
            base_dbp = 80.0

        base_hr = float(payload.get("baseline_hr", 75.0))
        sim_hr = float(payload.get("heart_rate", 78.0))

        cv_res = simulation_service.simulate_cardiovascular(
            baseline_sbp=base_sbp,
            baseline_dbp=base_dbp,
            baseline_hr=base_hr,
            sim_sbp=sbp,
            sim_dbp=dbp,
            sim_hr=sim_hr,
            measurement_freq_per_day=int(payload.get("frequency_per_day", 2)),
            variability_std_dev=float(payload.get("variability_sigma", 4.0)),
            missing_rate_pct=float(payload.get("missing_pct", 5.0)),
            days_horizon=int(payload.get("days_horizon", 14))
        )

        audit_service.log_event(
            db=db,
            action="SCENARIO_SIMULATION_EXECUTED",
            user=current_user,
            target_type="SimulationLab",
            target_id=patient_id,
            details={"category": "cardiovascular", "map": cv_res["hypothetical"]["map"]}
        )

        return SimulationResponse(
            scenario_label="Cardiovascular Hemodynamic Simulation",
            is_causal_treatment_claim=False,
            warning="Simulated MAP and pulse pressure are research values. They do not substitute for in-clinic auscultatory verification.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=round(cv_res["hypothetical"]["map"] / 150.0, 3),
            simulated_risk_category="MODERATE" if cv_res["hypothetical"]["map"] >= 100 else "LOW",
            delta_risk_score=round((cv_res["hypothetical"]["map"] - cv_res["baseline"]["map"]) / 150.0, 3),
            feature_contributions=[],
            model_version="v1.4.2-cardiovascular-hemodynamics",
            category="cardiovascular",
            detailed_results=cv_res
        )

    # 3. Gestational Timeline Simulator
    elif category == "gestational_timeline":
        current_ga = float(payload.get("current_ga_weeks", 28.0))
        target_ga = float(payload.get("target_ga_weeks", 38.0))
        base_sbp = float(payload.get("baseline_sbp", 124.0))
        base_dbp = float(payload.get("baseline_dbp", 78.0))
        sbp_slope = float(payload.get("sbp_slope", 0.6))
        dbp_slope = float(payload.get("dbp_slope", 0.4))

        gt_res = simulation_service.simulate_gestational_timeline(
            current_ga_weeks=current_ga,
            target_ga_weeks=target_ga,
            baseline_sbp=base_sbp,
            baseline_dbp=base_dbp,
            projected_sbp_slope=sbp_slope,
            projected_dbp_slope=dbp_slope
        )

        return SimulationResponse(
            scenario_label="Gestational Timeline Longitudinal Projection",
            is_causal_treatment_claim=False,
            warning="Hypothetical future gestational points are for research planning. They are NOT inserted into the clinical medical record.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=0.12,
            simulated_risk_category="LOW",
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-gestational-timeline",
            category="gestational_timeline",
            detailed_results=gt_res
        )

    # 4. Maternal Metabolic Health Simulator
    elif category == "metabolic_health":
        fasting = float(payload.get("fasting_glucose", 90.0))
        post_meal = float(payload.get("post_meal_glucose", 125.0))
        unit = payload.get("unit", "mg/dL")

        meta_res = simulation_service.simulate_metabolic_health(
            fasting_glucose=fasting,
            post_meal_glucose=post_meal,
            ogtt_1hr=payload.get("ogtt_1hr"),
            ogtt_2hr=payload.get("ogtt_2hr"),
            maternal_weight_kg=float(payload.get("weight_kg", 68.0)),
            unit=unit
        )

        return SimulationResponse(
            scenario_label="Maternal Glycemic & Metabolic Simulator",
            is_causal_treatment_claim=False,
            warning="Metabolic reference evaluations are research approximations and do not constitute an official diagnosis of gestational diabetes.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=round(fasting / 200.0, 3),
            simulated_risk_category="LOW" if fasting < 95.0 else "MODERATE",
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-metabolic-glycemia",
            category="metabolic_health",
            detailed_results=meta_res
        )

    # 5. Sleep, Activity, and Stress Simulator
    elif category == "sleep_stress":
        sleep_h = float(payload.get("sleep_hours", 7.5))
        reg_idx = float(payload.get("sleep_regularity_idx", 82.0))
        steps = int(payload.get("daily_steps", 7200))
        rhr = float(payload.get("resting_hr", 72.0))
        hrv = float(payload.get("hrv_rmssd_ms", 40.0))
        stress = int(payload.get("stress_scale", 4))

        ss_res = simulation_service.simulate_sleep_stress(
            sleep_hours=sleep_h,
            sleep_regularity_idx=reg_idx,
            daily_steps=steps,
            resting_hr=rhr,
            hrv_rmssd_ms=hrv,
            stress_scale_1_to_10=stress
        )

        return SimulationResponse(
            scenario_label="Autonomic Balance & Activity Simulator",
            is_causal_treatment_claim=False,
            warning="Autonomic indices and self-reported stress are exploratory wellness metrics, not clinical diagnostics.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=round(ss_res["evaluations"]["experimental_autonomic_load_score"] / 100.0, 3),
            simulated_risk_category="LOW" if stress < 6 else "MODERATE",
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-autonomic-wellness",
            category="sleep_stress",
            detailed_results=ss_res
        )

    # 6. Sensor Reliability Simulator
    elif category == "sensor_reliability":
        sr_res = simulation_service.simulate_sensor_reliability(
            missing_packet_pct=float(payload.get("missing_packet_pct", 8.0)),
            transmission_delay_min=float(payload.get("transmission_delay_min", 15.0)),
            duplicate_rate_pct=float(payload.get("duplicate_rate_pct", 2.0)),
            sensor_noise_sigma=float(payload.get("sensor_noise_sigma", 3.5)),
            low_confidence_pct=float(payload.get("low_confidence_pct", 5.0)),
            device_disconnect_hours=float(payload.get("device_disconnect_hours", 0.0))
        )

        return SimulationResponse(
            scenario_label="Sensor Reliability & Noise Simulator",
            is_causal_treatment_claim=False,
            warning="Demonstrates how sensor degradation impacts trend trustworthiness and algorithmic uncertainty.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=0.1,
            simulated_risk_category="LOW",
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-sensor-telemetry-qa",
            category="sensor_reliability",
            detailed_results=sr_res
        )

    # 7. Monitoring Schedule Simulator
    elif category == "monitoring_schedule":
        ms_res = simulation_service.simulate_monitoring_schedule(
            protocol=payload.get("protocol", "manual_daily"),
            monitoring_days=int(payload.get("monitoring_days", 14))
        )

        return SimulationResponse(
            scenario_label="Monitoring Protocol Optimization Simulator",
            is_causal_treatment_claim=False,
            warning="Compares research trade-offs between sampling frequency, user burden, and detection readiness.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=0.1,
            simulated_risk_category="LOW",
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-monitoring-schedules",
            category="monitoring_schedule",
            detailed_results=ms_res
        )

    # 8. Postpartum Monitoring Timeline
    elif category == "postpartum":
        pp_day = int(payload.get("postpartum_day", 4))
        del_type = payload.get("delivery_type", "vaginal")
        sbp = float(payload.get("postpartum_sbp", 136.0))
        dbp = float(payload.get("postpartum_dbp", 86.0))
        if sbp <= dbp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Postpartum systolic BP ({sbp} mmHg) must be strictly greater than diastolic BP ({dbp} mmHg)."
            )
        symptoms = payload.get("symptoms", [])

        pp_res = simulation_service.simulate_postpartum_timeline(
            postpartum_day=pp_day,
            delivery_type=del_type,
            postpartum_sbp=sbp,
            postpartum_dbp=dbp,
            symptoms=symptoms,
            scheduled_followup_day=int(payload.get("followup_day", 7))
        )

        return SimulationResponse(
            scenario_label="Postpartum Hemodynamic Recovery Simulator",
            is_causal_treatment_claim=False,
            warning="Postpartum preeclampsia risk peaks days 3–6. Severe headache, vision changes, or SBP >= 160 require urgent emergency evaluation.",
            baseline_risk_score=baseline_risk,
            simulated_risk_score=0.25 if sbp >= 140 else 0.08,
            simulated_risk_category="HIGH" if sbp >= 150 else ("MODERATE" if sbp >= 140 else "LOW"),
            delta_risk_score=0.0,
            feature_contributions=[],
            model_version="v1.4.2-postpartum-recovery",
            category="postpartum",
            detailed_results=pp_res
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown simulation category '{category}'. Supported: cardiovascular, preeclampsia_risk, gestational_timeline, metabolic_health, sleep_stress, sensor_reliability, monitoring_schedule, postpartum."
        )


# =============================================================================
# SCENARIO PERSISTENCE ENDPOINTS: Save, List, Update, Delete, Export
# =============================================================================

@router.get("/scenarios", response_model=List[ScenarioResponse])
def list_patient_scenarios(
    patient_id: str,
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    query = db.query(SimulationScenario).filter(SimulationScenario.patient_id == patient_id)
    if category:
        query = query.filter(SimulationScenario.category == category)
    scenarios = query.order_by(desc(SimulationScenario.created_at)).all()

    results = []
    for s in scenarios:
        results.append(
            ScenarioResponse(
                id=s.id,
                patient_id=s.patient_id,
                name=s.name,
                category=s.category,
                description=s.description,
                parameters=json.loads(s.parameters_json) if s.parameters_json else {},
                results=json.loads(s.results_json) if s.results_json else {},
                is_baseline=s.is_baseline,
                created_at=s.created_at,
                updated_at=s.updated_at
            )
        )
    return results

@router.post("/scenarios", response_model=ScenarioResponse)
def save_scenario(
    patient_id: str,
    req: ScenarioSaveRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    scenario = SimulationScenario(
        patient_id=patient_id,
        created_by_id=current_user.id,
        name=req.name,
        category=req.category,
        description=req.description,
        parameters_json=json.dumps(req.parameters),
        results_json=json.dumps(req.results),
        is_baseline=False
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    audit_service.log_event(
        db=db,
        action="SCENARIO_SAVED",
        user=current_user,
        target_type="SimulationScenario",
        target_id=scenario.id,
        details={"name": scenario.name, "category": scenario.category}
    )

    return ScenarioResponse(
        id=scenario.id,
        patient_id=scenario.patient_id,
        name=scenario.name,
        category=scenario.category,
        description=scenario.description,
        parameters=req.parameters,
        results=req.results,
        is_baseline=scenario.is_baseline,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at
    )

@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(
    patient_id: str,
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    scenario = db.query(SimulationScenario).filter(
        SimulationScenario.id == scenario_id,
        SimulationScenario.patient_id == patient_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation scenario not found.")

    return ScenarioResponse(
        id=scenario.id,
        patient_id=scenario.patient_id,
        name=scenario.name,
        category=scenario.category,
        description=scenario.description,
        parameters=json.loads(scenario.parameters_json) if scenario.parameters_json else {},
        results=json.loads(scenario.results_json) if scenario.results_json else {},
        is_baseline=scenario.is_baseline,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at
    )

@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(
    patient_id: str,
    scenario_id: str,
    req: ScenarioUpdateRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    scenario = db.query(SimulationScenario).filter(
        SimulationScenario.id == scenario_id,
        SimulationScenario.patient_id == patient_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation scenario not found.")

    if req.name is not None:
        scenario.name = req.name
    if req.description is not None:
        scenario.description = req.description
    if req.parameters is not None:
        scenario.parameters_json = json.dumps(req.parameters)
    if req.results is not None:
        scenario.results_json = json.dumps(req.results)

    db.commit()
    db.refresh(scenario)

    return ScenarioResponse(
        id=scenario.id,
        patient_id=scenario.patient_id,
        name=scenario.name,
        category=scenario.category,
        description=scenario.description,
        parameters=json.loads(scenario.parameters_json) if scenario.parameters_json else {},
        results=json.loads(scenario.results_json) if scenario.results_json else {},
        is_baseline=scenario.is_baseline,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at
    )

@router.delete("/scenarios/{scenario_id}")
def delete_scenario(
    patient_id: str,
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    scenario = db.query(SimulationScenario).filter(
        SimulationScenario.id == scenario_id,
        SimulationScenario.patient_id == patient_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation scenario not found.")

    db.delete(scenario)
    db.commit()

    audit_service.log_event(
        db=db,
        action="SCENARIO_DELETED",
        user=current_user,
        target_type="SimulationScenario",
        target_id=scenario_id,
        details={"name": scenario.name}
    )

    return {"status": "success", "message": f"Scenario '{scenario.name}' deleted successfully."}

@router.get("/scenarios/{scenario_id}/export")
def export_scenario(
    patient_id: str,
    scenario_id: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Exports a scenario summary as CSV or JSON.
    """
    scenario = db.query(SimulationScenario).filter(
        SimulationScenario.id == scenario_id,
        SimulationScenario.patient_id == patient_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation scenario not found.")

    params = json.loads(scenario.parameters_json) if scenario.parameters_json else {}
    results = json.loads(scenario.results_json) if scenario.results_json else {}

    if format == "json":
        data = {
            "scenario_id": scenario.id,
            "patient_mrn": patient.mrn,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "scenario_name": scenario.name,
            "category": scenario.category,
            "description": scenario.description,
            "created_at": scenario.created_at.isoformat(),
            "parameters": params,
            "results": results
        }
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=scenario_{scenario.id}.json"}
        )

    # Format CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Section", "Field", "Value"])
    writer.writerow(["Metadata", "Scenario Name", scenario.name])
    writer.writerow(["Metadata", "Category", scenario.category])
    writer.writerow(["Metadata", "Patient MRN", patient.mrn])
    writer.writerow(["Metadata", "Created At", scenario.created_at.isoformat()])

    for k, v in params.items():
        writer.writerow(["Parameter", k, str(v)])

    for k, v in results.items():
        if isinstance(v, (str, int, float, bool)):
            writer.writerow(["Result", k, str(v)])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scenario_{scenario.id}.csv"}
    )
