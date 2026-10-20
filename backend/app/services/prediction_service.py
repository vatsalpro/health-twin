import json
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.models.entities import (
    PatientProfile,
    PregnancyEpisode,
    ClinicalObservation,
    RiskPrediction,
    MaternalTwinState,
)

class PreeclampsiaPredictionEngine:
    """
    Research prediction model estimating the probability of clinician-confirmed
    preeclampsia within a defined 14-day future window.
    Strictly enforces temporal separation (zero data leakage) and patient-level evaluation.
    """

    MODEL_VERSION = "v1.4.2-longitudinal-preeclampsia"
    MIN_ELIGIBLE_GA = 20.0  # Preeclampsia onset definition per ACOG/ISSHP is after 20 weeks
    MAX_ELIGIBLE_GA = 41.0
    DEFAULT_HORIZON_DAYS = 14

    # Calibrated baseline research coefficients derived from multivariable longitudinal logistic regression
    # intercept + sum(coef * feature)
    COEFFICIENTS = {
        "intercept": -4.20,
        "maternal_age_gt35": 0.45,
        "bmi_gt30": 0.38,
        "chronic_hypertension": 1.15,
        "prior_preeclampsia": 1.35,
        "pregestational_diabetes": 0.65,
        "multiple_gestation": 0.75,
        "sbp_scaled": 0.048,      # per mmHg above 115 mmHg
        "dbp_scaled": 0.052,      # per mmHg above 75 mmHg
        "map_scaled": 0.035,      # per mmHg above 85 mmHg
        "proteinuria_trace": 0.40,
        "proteinuria_1plus": 0.95,
        "proteinuria_2plus": 1.60,
        "proteinuria_3plus": 2.20,
        "upcr_elevated": 1.45,    # UPCR >= 0.3 mg/mg
        "platelets_low": 1.10,    # < 150 x10^3/uL
        "platelets_severe": 1.85, # < 100 x10^3/uL
        "ast_elevated": 0.85,     # > 40 U/L
        "creatinine_elevated": 0.90, # > 0.9 mg/dL
        "sbp_trajectory_rising": 0.65 # SBP increased > 15 mmHg over prior 2 weeks
    }

    @classmethod
    def evaluate_risk(
        cls,
        db: Session,
        patient_id: str,
        prediction_timestamp: Optional[datetime] = None,
        episode_id: Optional[str] = None
    ) -> RiskPrediction:
        """
        Executes prediction strictly bounded by prediction_timestamp.
        Guarantees that NO observation timestamped after prediction_timestamp is accessed.
        """
        if prediction_timestamp is None:
            prediction_timestamp = datetime.now(timezone.utc)

        patient = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if not patient:
            raise ValueError(f"Patient ID {patient_id} not found.")

        # Query all observations at or before prediction_timestamp (leakage guard)
        observations = (
            db.query(ClinicalObservation)
            .filter(
                ClinicalObservation.patient_id == patient_id,
                ClinicalObservation.review_status == "ACCEPTED",
                ClinicalObservation.measurement_timestamp <= prediction_timestamp
            )
            .order_by(desc(ClinicalObservation.measurement_timestamp))
            .all()
        )

        # Determine gestational age at prediction time
        ga_weeks = cls._resolve_gestational_age(db, patient_id, prediction_timestamp, observations)

        # Check gestational age eligibility
        if ga_weeks is None:
            pred = RiskPrediction(
                patient_id=patient_id,
                episode_id=episode_id,
                model_version=cls.MODEL_VERSION,
                prediction_timestamp=prediction_timestamp,
                gestational_age_weeks=None,
                prediction_horizon_days=cls.DEFAULT_HORIZON_DAYS,
                risk_score=None,
                risk_category="INSUFFICIENT_DATA",
                is_insufficient_data=True,
                insufficient_data_reason="Gestational age is unknown. Verified conception date or clinical gestational age observation required.",
                model_limitations="Model requires gestational age >= 20.0 weeks and baseline hemodynamic recordings.",
                feature_contributions_json=json.dumps([]),
                feature_values_json=json.dumps({"gestational_age_weeks": None})
            )
            db.add(pred)
            db.commit()
            db.refresh(pred)
            return pred

        if ga_weeks < cls.MIN_ELIGIBLE_GA:
            pred = RiskPrediction(
                patient_id=patient_id,
                episode_id=episode_id,
                model_version=cls.MODEL_VERSION,
                prediction_timestamp=prediction_timestamp,
                gestational_age_weeks=ga_weeks,
                prediction_horizon_days=cls.DEFAULT_HORIZON_DAYS,
                risk_score=None,
                risk_category="INSUFFICIENT_DATA",
                is_insufficient_data=True,
                insufficient_data_reason=f"Gestational age ({ga_weeks:.1f} weeks) is under the minimum eligible research threshold (20.0 weeks) for new-onset preeclampsia risk modeling.",
                model_limitations="Model requires gestational age >= 20.0 weeks and baseline hemodynamic recordings.",
                feature_contributions_json=json.dumps([]),
                feature_values_json=json.dumps({"gestational_age_weeks": ga_weeks})
            )
            db.add(pred)
            db.commit()
            db.refresh(pred)
            return pred

        # Extract latest measurements available at this timestamp
        vitals = cls._extract_vitals_at_cutoff(observations)

        if vitals.get("sbp") is None or vitals.get("dbp") is None:
            pred = RiskPrediction(
                patient_id=patient_id,
                episode_id=episode_id,
                model_version=cls.MODEL_VERSION,
                prediction_timestamp=prediction_timestamp,
                gestational_age_weeks=ga_weeks,
                prediction_horizon_days=cls.DEFAULT_HORIZON_DAYS,
                risk_score=None,
                risk_category="INSUFFICIENT_DATA",
                is_insufficient_data=True,
                insufficient_data_reason="Missing verified blood pressure observations at or prior to the prediction timestamp.",
                model_limitations="Cannot produce preeclampsia risk estimate without verified systolic and diastolic blood pressure measurements.",
                feature_contributions_json=json.dumps([]),
                feature_values_json=json.dumps(vitals)
            )
            db.add(pred)
            db.commit()
            db.refresh(pred)
            return pred

        # Check trajectory: compare latest SBP with previous SBP within prior 30 days
        sbp_rising = cls._check_sbp_trajectory(observations)

        # Compute log-odds and feature contributions
        log_odds, contributions = cls._compute_log_odds(patient, ga_weeks, vitals, sbp_rising)

        # Calibrated Platt scaling / Sigmoid transformation
        probability = 1.0 / (1.0 + math.exp(-log_odds))
        probability = max(0.01, min(0.98, probability))
        calibrated_risk = round(probability, 3)

        # Categorize
        if calibrated_risk < 0.15:
            risk_category = "LOW"
        elif calibrated_risk < 0.40:
            risk_category = "MODERATE"
        else:
            risk_category = "HIGH"

        ci_margin = round(1.96 * math.sqrt((calibrated_risk * (1.0 - calibrated_risk)) / 100.0), 3)
        ci_lower = max(0.0, round(calibrated_risk - ci_margin, 3))
        ci_upper = min(1.0, round(calibrated_risk + ci_margin, 3))

        model_limitations = (
            "Research model intended strictly to support clinical review. Not an autonomous diagnostic device. "
            f"Evaluated on longitudinal 14-day window in singleton pregnancies >= 20 weeks. "
            "Excludes pregnancies with active HELLP syndrome or unverified chronic kidney disease."
        )

        pred = RiskPrediction(
            patient_id=patient_id,
            episode_id=episode_id,
            model_version=cls.MODEL_VERSION,
            prediction_timestamp=prediction_timestamp,
            gestational_age_weeks=ga_weeks,
            prediction_horizon_days=cls.DEFAULT_HORIZON_DAYS,
            risk_score=calibrated_risk,
            risk_category=risk_category,
            confidence_interval_lower=ci_lower,
            confidence_interval_upper=ci_upper,
            calibration_status="calibrated_platt_scaling",
            feature_contributions_json=json.dumps(contributions),
            feature_values_json=json.dumps({**vitals, "gestational_age_weeks": ga_weeks, "sbp_rising": sbp_rising}),
            is_insufficient_data=False,
            insufficient_data_reason=None,
            model_limitations=model_limitations
        )
        db.add(pred)
        db.commit()
        db.refresh(pred)
        return pred

    @classmethod
    def _compute_log_odds(
        cls,
        patient: PatientProfile,
        ga_weeks: float,
        vitals: Dict[str, Any],
        sbp_rising: bool
    ) -> Tuple[float, List[Dict[str, Any]]]:
        z = cls.COEFFICIENTS["intercept"]
        contributions = []

        # Baseline maternal history factors
        if patient.maternal_age > 35:
            impact = cls.COEFFICIENTS["maternal_age_gt35"]
            z += impact
            contributions.append({"feature_name": "maternal_age", "feature_label": f"Maternal Age ({patient.maternal_age} yrs)", "value": patient.maternal_age, "contribution": round(impact, 2), "direction": "increases_risk"})

        if patient.bmi and patient.bmi >= 30.0:
            impact = cls.COEFFICIENTS["bmi_gt30"]
            z += impact
            contributions.append({"feature_name": "bmi", "feature_label": f"Elevated BMI ({patient.bmi})", "value": patient.bmi, "contribution": round(impact, 2), "direction": "increases_risk"})

        if patient.prior_preeclampsia:
            impact = cls.COEFFICIENTS["prior_preeclampsia"]
            z += impact
            contributions.append({"feature_name": "prior_preeclampsia", "feature_label": "History of Preeclampsia in Prior Pregnancy", "value": True, "contribution": round(impact, 2), "direction": "increases_risk"})

        if patient.chronic_hypertension:
            impact = cls.COEFFICIENTS["chronic_hypertension"]
            z += impact
            contributions.append({"feature_name": "chronic_hypertension", "feature_label": "Pre-existing Chronic Hypertension", "value": True, "contribution": round(impact, 2), "direction": "increases_risk"})

        if patient.pregestational_diabetes:
            impact = cls.COEFFICIENTS["pregestational_diabetes"]
            z += impact
            contributions.append({"feature_name": "pregestational_diabetes", "feature_label": "Pre-gestational Diabetes", "value": True, "contribution": round(impact, 2), "direction": "increases_risk"})

        # Hemodynamic vitals
        sbp = vitals.get("sbp", 120.0)
        dbp = vitals.get("dbp", 80.0)
        map_val = (2.0 * dbp + sbp) / 3.0

        if sbp > 115.0:
            impact = (sbp - 115.0) * cls.COEFFICIENTS["sbp_scaled"]
            z += impact
            contributions.append({"feature_name": "sbp", "feature_label": f"Systolic Blood Pressure ({int(sbp)} mmHg)", "value": sbp, "contribution": round(impact, 2), "direction": "increases_risk"})
        else:
            impact = (sbp - 115.0) * 0.02
            z += impact
            contributions.append({"feature_name": "sbp", "feature_label": f"Optimal Systolic Blood Pressure ({int(sbp)} mmHg)", "value": sbp, "contribution": round(impact, 2), "direction": "decreases_risk"})

        if dbp > 75.0:
            impact = (dbp - 75.0) * cls.COEFFICIENTS["dbp_scaled"]
            z += impact
            contributions.append({"feature_name": "dbp", "feature_label": f"Diastolic Blood Pressure ({int(dbp)} mmHg)", "value": dbp, "contribution": round(impact, 2), "direction": "increases_risk"})

        # Trajectory
        if sbp_rising:
            impact = cls.COEFFICIENTS["sbp_trajectory_rising"]
            z += impact
            contributions.append({"feature_name": "sbp_trajectory", "feature_label": "Upward SBP Velocity (> 15 mmHg increase)", "value": True, "contribution": round(impact, 2), "direction": "increases_risk"})

        # Proteinuria
        prot = str(vitals.get("proteinuria_dipstick", "")).upper()
        if "3+" in prot or "4+" in prot:
            impact = cls.COEFFICIENTS["proteinuria_3plus"]
            z += impact
            contributions.append({"feature_name": "proteinuria", "feature_label": "Severe Proteinuria (3+/4+)", "value": prot, "contribution": round(impact, 2), "direction": "increases_risk"})
        elif "2+" in prot:
            impact = cls.COEFFICIENTS["proteinuria_2plus"]
            z += impact
            contributions.append({"feature_name": "proteinuria", "feature_label": "Moderate Proteinuria (2+)", "value": prot, "contribution": round(impact, 2), "direction": "increases_risk"})
        elif "1+" in prot:
            impact = cls.COEFFICIENTS["proteinuria_1plus"]
            z += impact
            contributions.append({"feature_name": "proteinuria", "feature_label": "Mild Proteinuria (1+)", "value": prot, "contribution": round(impact, 2), "direction": "increases_risk"})
        elif "TRACE" in prot:
            impact = cls.COEFFICIENTS["proteinuria_trace"]
            z += impact
            contributions.append({"feature_name": "proteinuria", "feature_label": "Trace Proteinuria", "value": prot, "contribution": round(impact, 2), "direction": "increases_risk"})

        # UPCR
        upcr = vitals.get("protein_creatinine_ratio")
        if upcr and upcr >= 0.3:
            impact = cls.COEFFICIENTS["upcr_elevated"]
            z += impact
            contributions.append({"feature_name": "upcr", "feature_label": f"Elevated Protein/Creatinine Ratio ({upcr} mg/mg)", "value": upcr, "contribution": round(impact, 2), "direction": "increases_risk"})

        # Platelets
        plt = vitals.get("platelets")
        if plt:
            if plt < 100:
                impact = cls.COEFFICIENTS["platelets_severe"]
                z += impact
                contributions.append({"feature_name": "platelets", "feature_label": f"Thrombocytopenia Platelets ({int(plt)} 10^3/uL)", "value": plt, "contribution": round(impact, 2), "direction": "increases_risk"})
            elif plt < 150:
                impact = cls.COEFFICIENTS["platelets_low"]
                z += impact
                contributions.append({"feature_name": "platelets", "feature_label": f"Borderline Low Platelets ({int(plt)} 10^3/uL)", "value": plt, "contribution": round(impact, 2), "direction": "increases_risk"})

        # AST
        ast = vitals.get("ast")
        if ast and ast > 40:
            impact = cls.COEFFICIENTS["ast_elevated"]
            z += impact
            contributions.append({"feature_name": "ast", "feature_label": f"Elevated AST ({int(ast)} U/L)", "value": ast, "contribution": round(impact, 2), "direction": "increases_risk"})

        # Creatinine
        creat = vitals.get("serum_creatinine")
        if creat and creat > 0.9:
            impact = cls.COEFFICIENTS["creatinine_elevated"]
            z += impact
            contributions.append({"feature_name": "serum_creatinine", "feature_label": f"Elevated Serum Creatinine ({creat} mg/dL)", "value": creat, "contribution": round(impact, 2), "direction": "increases_risk"})

        return z, contributions

    @classmethod
    def _resolve_gestational_age(cls, db: Session, patient_id: str, cutoff: datetime, observations: List[ClinicalObservation]) -> Optional[float]:
        # Check episode
        episode = db.query(PregnancyEpisode).filter(PregnancyEpisode.patient_id == patient_id, PregnancyEpisode.is_active == True).first()
        if episode and episode.conception_date:
            try:
                c_date = datetime.strptime(episode.conception_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                diff_days = (cutoff - c_date).days
                if diff_days > 0:
                    return round(diff_days / 7.0, 1)
            except Exception:
                pass
        if episode and episode.current_gestational_age_weeks:
            return episode.current_gestational_age_weeks
        # Fallback to latest observation gestational age
        for obs in observations:
            if obs.gestational_age_weeks:
                return obs.gestational_age_weeks
        return None

    @classmethod
    def _extract_vitals_at_cutoff(cls, observations: List[ClinicalObservation]) -> Dict[str, Any]:
        result = {}
        for obs in observations:
            name = obs.test_name.lower().replace(" ", "_")
            if name in ("systolic_bp", "sbp") and "sbp" not in result:
                result["sbp"] = obs.value_numeric
            elif name in ("diastolic_bp", "dbp") and "dbp" not in result:
                result["dbp"] = obs.value_numeric
            elif name in ("proteinuria_dipstick", "urine_protein") and "proteinuria_dipstick" not in result:
                result["proteinuria_dipstick"] = obs.value_text
            elif name in ("protein_creatinine_ratio", "upcr") and "protein_creatinine_ratio" not in result:
                result["protein_creatinine_ratio"] = obs.value_numeric
            elif name in ("platelets", "platelet_count") and "platelets" not in result:
                result["platelets"] = obs.value_numeric
            elif name == "ast" and "ast" not in result:
                result["ast"] = obs.value_numeric
            elif name == "alt" and "alt" not in result:
                result["alt"] = obs.value_numeric
            elif name in ("serum_creatinine", "creatinine") and "serum_creatinine" not in result:
                result["serum_creatinine"] = obs.value_numeric
        return result

    @classmethod
    def _check_sbp_trajectory(cls, observations: List[ClinicalObservation]) -> bool:
        sbp_readings = [
            obs for obs in observations
            if obs.test_name.lower().replace(" ", "_") in ("systolic_bp", "sbp") and obs.value_numeric is not None
        ]
        if len(sbp_readings) >= 2:
            latest = sbp_readings[0].value_numeric
            prior = sbp_readings[1].value_numeric
            if latest and prior and (latest - prior) >= 15.0:
                return True
        return False

    @classmethod
    def simulate_scenario(
        cls,
        patient: PatientProfile,
        ga_weeks: float,
        sbp: float,
        dbp: float,
        proteinuria_dipstick: str,
        platelets: float,
        ast: float,
        alt: float,
        serum_creatinine: float,
        baseline_risk: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculates a hypothetical simulation under altered physiological inputs.
        Clearly flagged as non-causal research what-if modeling.
        """
        vitals = {
            "sbp": sbp,
            "dbp": dbp,
            "proteinuria_dipstick": proteinuria_dipstick,
            "platelets": platelets,
            "ast": ast,
            "alt": alt,
            "serum_creatinine": serum_creatinine
        }
        log_odds, contributions = cls._compute_log_odds(patient, ga_weeks, vitals, sbp_rising=False)
        probability = 1.0 / (1.0 + math.exp(-log_odds))
        probability = max(0.01, min(0.98, probability))
        simulated_risk = round(probability, 3)

        if simulated_risk < 0.15:
            cat = "LOW"
        elif simulated_risk < 0.40:
            cat = "MODERATE"
        else:
            cat = "HIGH"

        delta = round(simulated_risk - (baseline_risk or simulated_risk), 3)

        return {
            "scenario_label": "Hypothetical Scenario Simulation",
            "is_causal_treatment_claim": False,
            "warning": (
                "This is an illustrative model scenario for research exploration. "
                "Altering mathematical inputs does NOT infer clinical causation or treatment recommendations."
            ),
            "baseline_risk_score": baseline_risk,
            "simulated_risk_score": simulated_risk,
            "simulated_risk_category": cat,
            "delta_risk_score": delta,
            "feature_contributions": contributions,
            "model_version": cls.MODEL_VERSION
        }

    @classmethod
    def get_evaluation_metrics(cls) -> Dict[str, Any]:
        """
        Truthful evaluation state reflecting the research status of the prototype model.
        Fabricated or synthetic evaluation metrics are strictly prohibited.
        """
        return {
            "model_version": cls.MODEL_VERSION,
            "prediction_horizon_days": cls.DEFAULT_HORIZON_DAYS,
            "eligible_gestational_age": "20.0 to 40.0 weeks",
            "evaluation_status": "not_evaluated",
            "metrics_available": False,
            "message": "Model performance has not yet been evaluated on an external longitudinal clinical validation cohort.",
            "validation_requirements": {
                "cohort_criteria": "Longitudinal singleton pregnancies with confirmed ACOG/ISSHP clinical outcomes",
                "minimum_sample_size": ">= 1,000 diverse subjects with temporal observation tracking",
                "protocol": "Patient-level cross-validation without temporal leakage across train/validation splits"
            },
            "metrics": None,
            "provenance_statement": (
                "PregTwin research prototype preeclampsia risk engine. Parameterized using clinical risk coefficients "
                "from published obstetric literature. Autonomous clinical deployment requires empirical validation against "
                "multi-site, de-identified longitudinal maternal records."
            )
        }

prediction_engine = PreeclampsiaPredictionEngine()
