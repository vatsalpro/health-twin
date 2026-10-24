import math
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from app.models.entities import PatientProfile, MaternalTwinState, RiskPrediction
from app.services.prediction_service import prediction_engine

class MaternalSimulationService:
    """
    Advanced Maternal Digital Twin Simulation Lab Service.
    Implements 8 distinct research simulation modules with deterministic,
    transparent physiological formulas, uncertainty bounds, and strict non-causal disclaimers.
    """

    # -------------------------------------------------------------------------
    # A. Blood Pressure & Cardiovascular Trends
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_cardiovascular(
        baseline_sbp: float,
        baseline_dbp: float,
        baseline_hr: float,
        sim_sbp: float,
        sim_dbp: float,
        sim_hr: float,
        measurement_freq_per_day: int = 2,
        variability_std_dev: float = 4.0,
        missing_rate_pct: float = 5.0,
        days_horizon: int = 14
    ) -> Dict[str, Any]:
        """
        Simulates blood pressure and cardiovascular indices.
        Formulas:
          MAP = (SBP + 2 * DBP) / 3
          Pulse Pressure = SBP - DBP
          Rate Pressure Product (RPP / 100) = (SBP * HR) / 100
        """
        # Baseline calculations
        base_map = round((baseline_sbp + 2.0 * baseline_dbp) / 3.0, 1)
        base_pp = round(baseline_sbp - baseline_dbp, 1)
        base_rpp = round((baseline_sbp * baseline_hr) / 100.0, 1)

        # Hypothetical calculations
        sim_map = round((sim_sbp + 2.0 * sim_dbp) / 3.0, 1)
        sim_pp = round(sim_sbp - sim_dbp, 1)
        sim_rpp = round((sim_sbp * sim_hr) / 100.0, 1)

        # Deltas
        delta_sbp = round(sim_sbp - baseline_sbp, 1)
        delta_dbp = round(sim_dbp - baseline_dbp, 1)
        delta_map = round(sim_map - base_map, 1)
        delta_pp = round(sim_pp - base_pp, 1)
        delta_hr = round(sim_hr - baseline_hr, 1)

        pct_change_sbp = round((delta_sbp / max(1.0, baseline_sbp)) * 100.0, 1)
        pct_change_dbp = round((delta_dbp / max(1.0, baseline_dbp)) * 100.0, 1)
        pct_change_map = round((delta_map / max(1.0, base_map)) * 100.0, 1)

        # Generate simulated hypothetical timeline
        random.seed(42)  # Deterministic seed for reproducible simulation curves
        timeline: List[Dict[str, Any]] = []
        total_slots = days_horizon * measurement_freq_per_day
        expected_readings = total_slots

        actual_readings = 0
        now = datetime.now(timezone.utc)
        for i in range(total_slots):
            day_offset = i // measurement_freq_per_day
            hour_offset = (i % measurement_freq_per_day) * (24 // max(1, measurement_freq_per_day))
            t_point = now + timedelta(days=day_offset, hours=hour_offset)

            # Check if reading dropped due to missingness
            if random.random() * 100.0 < missing_rate_pct:
                continue

            actual_readings += 1
            # Add small pseudo-variability
            noise = random.gauss(0, variability_std_dev)
            point_sbp = round(sim_sbp + noise, 1)
            point_dbp = round(sim_dbp + noise * 0.6, 1)
            point_map = round((point_sbp + 2.0 * point_dbp) / 3.0, 1)

            timeline.append({
                "timestamp": t_point.isoformat(),
                "day": day_offset + 1,
                "sbp": point_sbp,
                "dbp": point_dbp,
                "map": point_map,
                "is_hypothetical": True
            })

        completeness_pct = round((actual_readings / max(1, expected_readings)) * 100.0, 1)

        return {
            "category": "cardiovascular",
            "formulas_used": {
                "map": "MAP = (SBP + 2 * DBP) / 3",
                "pulse_pressure": "Pulse Pressure = SBP - DBP",
                "rate_pressure_product": "RPP = (SBP * HR) / 100"
            },
            "baseline": {
                "sbp": baseline_sbp,
                "dbp": baseline_dbp,
                "hr": baseline_hr,
                "map": base_map,
                "pulse_pressure": base_pp,
                "rpp": base_rpp
            },
            "hypothetical": {
                "sbp": sim_sbp,
                "dbp": sim_dbp,
                "hr": sim_hr,
                "map": sim_map,
                "pulse_pressure": sim_pp,
                "rpp": sim_rpp
            },
            "deltas": {
                "sbp": {"absolute": delta_sbp, "percent": pct_change_sbp},
                "dbp": {"absolute": delta_dbp, "percent": pct_change_dbp},
                "map": {"absolute": delta_map, "percent": pct_change_map},
                "pulse_pressure": {"absolute": delta_pp},
                "hr": {"absolute": delta_hr}
            },
            "data_quality": {
                "expected_readings": expected_readings,
                "simulated_readings_retained": actual_readings,
                "completeness_pct": completeness_pct,
                "variability_sigma": variability_std_dev
            },
            "projected_timeline": timeline[:28],  # Return up to 28 points for charting
            "disclaimer": "Simulated cardiovascular indicators are purely hypothetical. They do NOT infer clinical diagnosis or guarantee preeclampsia prevention."
        }

    # -------------------------------------------------------------------------
    # B. Preeclampsia Research Scenario Explorer
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_preeclampsia_scenario(
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
        Executes counterfactual risk model using existing multivariable logistic regression engine.
        """
        res = prediction_engine.simulate_scenario(
            patient=patient,
            ga_weeks=ga_weeks,
            sbp=sbp,
            dbp=dbp,
            proteinuria_dipstick=proteinuria_dipstick,
            platelets=platelets,
            ast=ast,
            alt=alt,
            serum_creatinine=serum_creatinine,
            baseline_risk=baseline_risk
        )
        res["category"] = "preeclampsia_risk"
        res["uncertainty_interval"] = {
            "lower": max(0.01, round(res["simulated_risk_score"] * 0.85, 3)),
            "upper": min(0.98, round(res["simulated_risk_score"] * 1.18, 3))
        }
        res["model_scope"] = {
            "min_ga": 20.0,
            "max_ga": 41.0,
            "current_ga_in_scope": 20.0 <= ga_weeks <= 41.0
        }
        return res

    # -------------------------------------------------------------------------
    # C. Gestational Timeline Simulator
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_gestational_timeline(
        current_ga_weeks: float,
        target_ga_weeks: float,
        baseline_sbp: float,
        baseline_dbp: float,
        projected_sbp_slope: float = 0.5,  # mmHg per week
        projected_dbp_slope: float = 0.3,
        historical_points: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Projects week-by-week trajectory from baseline GA to target GA.
        Clearly demarcates:
          1. Historical observed data
          2. Current visit data
          3. Future simulated hypothetical points
        """
        timeline: List[Dict[str, Any]] = []

        # Include historical points if provided
        if historical_points:
            for pt in historical_points:
                timeline.append({
                    "gestational_age_weeks": pt.get("ga", 24.0),
                    "sbp": pt.get("sbp"),
                    "dbp": pt.get("dbp"),
                    "map": pt.get("map"),
                    "source": "HISTORICAL_OBSERVED",
                    "is_hypothetical": False
                })

        # Current visit anchor point
        timeline.append({
            "gestational_age_weeks": current_ga_weeks,
            "sbp": baseline_sbp,
            "dbp": baseline_dbp,
            "map": round((baseline_sbp + 2.0 * baseline_dbp) / 3.0, 1),
            "source": "CURRENT_OBSERVED",
            "is_hypothetical": False
        })

        # Future projected hypothetical points
        weeks_ahead = int(math.ceil(max(0.0, target_ga_weeks - current_ga_weeks)))
        curr_sbp = baseline_sbp
        curr_dbp = baseline_dbp

        for w in range(1, weeks_ahead + 1):
            sim_ga = round(current_ga_weeks + w, 1)
            curr_sbp += projected_sbp_slope
            curr_dbp += projected_dbp_slope
            curr_map = round((curr_sbp + 2.0 * curr_dbp) / 3.0, 1)

            timeline.append({
                "gestational_age_weeks": sim_ga,
                "sbp": round(curr_sbp, 1),
                "dbp": round(curr_dbp, 1),
                "map": curr_map,
                "source": "FUTURE_HYPOTHETICAL",
                "is_hypothetical": True
            })

        return {
            "category": "gestational_timeline",
            "current_ga_weeks": current_ga_weeks,
            "target_ga_weeks": target_ga_weeks,
            "weekly_slopes": {
                "sbp_slope": projected_sbp_slope,
                "dbp_slope": projected_dbp_slope
            },
            "timeline": timeline,
            "summary": f"Trajectory simulated from {current_ga_weeks}w to {target_ga_weeks}w under slope {projected_sbp_slope:+.1f} mmHg SBP/week.",
            "disclaimer": "Future projected gestational trajectory is for research planning. It does NOT forecast guaranteed clinical outcomes."
        }

    # -------------------------------------------------------------------------
    # D. Maternal Metabolic Health Simulator
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_metabolic_health(
        fasting_glucose: float,
        post_meal_glucose: float,
        ogtt_1hr: Optional[float] = None,
        ogtt_2hr: Optional[float] = None,
        maternal_weight_kg: float = 68.0,
        baseline_fasting: float = 90.0,
        unit: str = "mg/dL"
    ) -> Dict[str, Any]:
        """
        Simulates metabolic and glucose excursions.
        Preserves measurement units and meal timing context.
        """
        # Conversions if unit is mmol/L
        f_val = fasting_glucose
        pm_val = post_meal_glucose
        if unit == "mmol/L":
            f_val = round(fasting_glucose * 18.0182, 1)
            pm_val = round(post_meal_glucose * 18.0182, 1)

        excursion = round(pm_val - f_val, 1)
        fasting_delta = round(f_val - baseline_fasting, 1)

        # Standard pregnancy reference thresholds (ACOG/ADA)
        # Fasting < 95 mg/dL, 1-hr post < 140 mg/dL, 2-hr post < 120 mg/dL
        fasting_status = "NORMAL_TARGET" if f_val < 95.0 else ("BORDERLINE" if f_val < 105.0 else "ELEVATED")
        post_meal_status = "NORMAL_TARGET" if pm_val < 140.0 else ("BORDERLINE" if pm_val < 160.0 else "ELEVATED")

        return {
            "category": "metabolic_health",
            "unit": unit,
            "inputs": {
                "fasting_glucose": fasting_glucose,
                "post_meal_glucose": post_meal_glucose,
                "ogtt_1hr": ogtt_1hr,
                "ogtt_2hr": ogtt_2hr,
                "weight_kg": maternal_weight_kg
            },
            "normalized_mg_dl": {
                "fasting": f_val,
                "post_meal": pm_val,
                "excursion": excursion
            },
            "reference_evaluations": {
                "fasting_evaluation": fasting_status,
                "post_meal_evaluation": post_meal_status,
                "acog_target_fasting_mg_dl": "< 95 mg/dL",
                "acog_target_1hr_postprandial_mg_dl": "< 140 mg/dL"
            },
            "deltas_vs_baseline": {
                "fasting_delta": fasting_delta
            },
            "disclaimer": "This is a descriptive research simulation. It does NOT establish a diagnosis of Gestational Diabetes Mellitus (GDM) or replace clinical oral glucose tolerance testing."
        }

    # -------------------------------------------------------------------------
    # E. Sleep, Activity, and Stress Research Simulator
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_sleep_stress(
        sleep_hours: float,
        sleep_regularity_idx: float,  # 0 to 100%
        daily_steps: int,
        resting_hr: float,
        hrv_rmssd_ms: float,
        stress_scale_1_to_10: int
    ) -> Dict[str, Any]:
        """
        Simulates sleep, physical activity, and physiological recovery associations.
        """
        # Sleep adequacy evaluation
        sleep_eval = "OPTIMAL" if 7.0 <= sleep_hours <= 9.0 else ("INSUFFICIENT" if sleep_hours < 7.0 else "PROLONGED")

        # Descriptive Autonomic Load Index (0 - 100, purely mathematical composite for research)
        # Higher resting HR + Lower HRV + High self-reported stress -> higher autonomic load index
        hr_component = min(40.0, max(0.0, (resting_hr - 60.0) * 0.8))
        hrv_component = min(30.0, max(0.0, (50.0 - hrv_rmssd_ms) * 0.6))
        stress_component = stress_scale_1_to_10 * 3.0
        autonomic_load_score = round(min(100.0, max(5.0, hr_component + hrv_component + stress_component)), 1)

        return {
            "category": "sleep_stress",
            "inputs": {
                "sleep_hours": sleep_hours,
                "sleep_regularity_idx": sleep_regularity_idx,
                "daily_steps": daily_steps,
                "resting_hr": resting_hr,
                "hrv_rmssd_ms": hrv_rmssd_ms,
                "stress_scale": stress_scale_1_to_10
            },
            "evaluations": {
                "sleep_adequacy": sleep_eval,
                "activity_level": "SEDENTARY" if daily_steps < 5000 else ("MODERATE" if daily_steps < 8500 else "ACTIVE"),
                "experimental_autonomic_load_score": autonomic_load_score
            },
            "correlational_notes": (
                "Research indices only. Autonomic variability and self-reported wellness correlate with physiological state "
                "but do NOT establish psychological diagnosis, clinical anxiety, or direct pregnancy complications."
            ),
            "disclaimer": "Correlation does not imply causation. HRV and self-reports cannot be used as standalone clinical diagnostics."
        }

    # -------------------------------------------------------------------------
    # F. Sensor Reliability Simulator
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_sensor_reliability(
        missing_packet_pct: float,
        transmission_delay_min: float,
        duplicate_rate_pct: float,
        sensor_noise_sigma: float,
        low_confidence_pct: float,
        device_disconnect_hours: float
    ) -> Dict[str, Any]:
        """
        Models sensor noise, latency, packet dropouts, and telemetry degradation.
        """
        # Effective data completeness
        disconnect_penalty = min(50.0, device_disconnect_hours * 2.0)
        completeness = max(0.0, round(100.0 - missing_packet_pct - disconnect_penalty, 1))

        # Trend reliability score (0 - 100)
        noise_penalty = min(30.0, sensor_noise_sigma * 2.5)
        delay_penalty = min(20.0, transmission_delay_min * 0.25)
        reliability_score = round(max(5.0, 100.0 - (100.0 - completeness) * 0.5 - noise_penalty - delay_penalty), 1)

        reliability_category = "ROBUST" if reliability_score >= 80.0 else ("ACCEPTABLE" if reliability_score >= 60.0 else "UNRELIABLE_DEGRADED")
        uncertainty_multiplier = round(1.0 + (100.0 - reliability_score) / 50.0, 2)

        return {
            "category": "sensor_reliability",
            "inputs": {
                "missing_packet_pct": missing_packet_pct,
                "transmission_delay_min": transmission_delay_min,
                "duplicate_rate_pct": duplicate_rate_pct,
                "sensor_noise_sigma": sensor_noise_sigma,
                "low_confidence_pct": low_confidence_pct,
                "device_disconnect_hours": device_disconnect_hours
            },
            "impact_metrics": {
                "effective_completeness_pct": completeness,
                "trend_reliability_score": reliability_score,
                "reliability_category": reliability_category,
                "risk_of_undetected_spikes": "HIGH" if completeness < 65.0 or delay_penalty > 15.0 else "LOW"
            },
            "uncertainty_multiplier": uncertainty_multiplier,
            "telemetry_reliability_score": reliability_score,
            "research_implication": (
                f"Under {missing_packet_pct}% packet loss and {sensor_noise_sigma} noise variance, downstream risk algorithms "
                f"must apply uncertainty buffers. Quality status categorized as {reliability_category}."
            )
        }

    # -------------------------------------------------------------------------
    # G. Monitoring Schedule Simulator
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_monitoring_schedule(
        protocol: str = "manual_daily",
        monitoring_days: int = 14
    ) -> Dict[str, Any]:
        """
        Compares hypothetical measurement protocols:
        - manual_daily: 1 reading per day
        - manual_multi: 3 readings per day (morning, afternoon, evening)
        - continuous_wearable: periodic 30-min sampling
        - symptom_triggered: event-based
        """
        protocols_data = {
            "manual_daily": {
                "name": "Once-Daily Manual Cuff",
                "readings_per_day": 1,
                "typical_missing_pct": 12.0,
                "detection_delay_hours": 18.0,
                "patient_burden_score": 2.5,
                "coverage_pct": 35.0
            },
            "manual_multi": {
                "name": "Three-Times-Daily Protocol",
                "readings_per_day": 3,
                "typical_missing_pct": 22.0,
                "detection_delay_hours": 6.0,
                "patient_burden_score": 6.8,
                "coverage_pct": 65.0
            },
            "continuous_wearable": {
                "name": "Passive Wearable Sensor Stream",
                "readings_per_day": 48,
                "typical_missing_pct": 8.0,
                "detection_delay_hours": 0.8,
                "patient_burden_score": 1.2,
                "coverage_pct": 92.0
            },
            "symptom_triggered": {
                "name": "Symptom-Triggered Episodic",
                "readings_per_day": 0.5,
                "typical_missing_pct": 45.0,
                "detection_delay_hours": 36.0,
                "patient_burden_score": 3.0,
                "coverage_pct": 18.0
            }
        }

        chosen = protocols_data.get(protocol, protocols_data["manual_daily"])
        total_expected = chosen["readings_per_day"] * monitoring_days
        total_retained = round(total_expected * (1.0 - chosen["typical_missing_pct"] / 100.0))

        return {
            "category": "monitoring_schedule",
            "selected_protocol": protocol,
            "protocol_details": chosen,
            "duration_days": monitoring_days,
            "projected_totals": {
                "expected_readings": total_expected,
                "retained_readings": total_retained,
                "lost_readings": total_expected - total_retained
            },
            "tradeoff_analysis": {
                "burden_vs_coverage_ratio": round(chosen["coverage_pct"] / max(0.5, chosen["patient_burden_score"]), 1),
                "clinical_detection_readiness": "EXCELLENT" if chosen["detection_delay_hours"] < 2.0 else ("MODERATE" if chosen["detection_delay_hours"] < 12.0 else "DELAYED")
            },
            "comparison_matrix": protocols_data,
            "disclaimer": "Protocol comparisons are research heuristics. Adherence to a specific clinical monitoring frequency must follow physician directives."
        }

    # -------------------------------------------------------------------------
    # H. Postpartum Monitoring Timeline
    # -------------------------------------------------------------------------
    @staticmethod
    def simulate_postpartum_timeline(
        postpartum_day: int = 4,
        delivery_type: str = "vaginal",
        postpartum_sbp: float = 138.0,
        postpartum_dbp: float = 88.0,
        symptoms: Optional[List[str]] = None,
        scheduled_followup_day: int = 7
    ) -> Dict[str, Any]:
        """
        Simulates 6-week postpartum trajectory (Days 1 to 42).
        Highlights post-delivery preeclampsia risk peaks (typically Days 3-6).
        """
        symptoms = symptoms or []
        timeline = []

        # Generate normative postpartum BP curve
        # BP typically peaks between days 3-6 postpartum before gradual decline
        for d in [1, 3, 5, 7, 14, 21, 28, 42]:
            curve_factor = 1.0
            if d in (3, 4, 5, 6):
                curve_factor = 1.04  # Physiologic fluid mobilization peak
            elif d > 14:
                curve_factor = 0.94

            timeline.append({
                "postpartum_day": d,
                "projected_sbp": round(postpartum_sbp * curve_factor, 1),
                "projected_dbp": round(postpartum_dbp * curve_factor, 1),
                "phase": "Acute Inpatient" if d <= 2 else ("High Vigilance Home" if d <= 10 else "Subacute Recovery"),
                "is_current_day": d == postpartum_day
            })

        has_severe_symptom = any(s.lower() in ("severe headache", "visual disturbance", "epigastric pain") for s in symptoms)
        risk_alert = "URGENT_EVALUATION_RECOMMENDED" if (postpartum_sbp >= 150 or postpartum_dbp >= 100 or has_severe_symptom) else "ROUTINE_POSTPARTUM_VIGILANCE"

        return {
            "category": "postpartum",
            "current_day": postpartum_day,
            "delivery_type": delivery_type,
            "vitals": {"sbp": postpartum_sbp, "dbp": postpartum_dbp},
            "symptoms_reported": symptoms,
            "alert_status": risk_alert,
            "followup_recommendation": f"Clinic visit on Postpartum Day {scheduled_followup_day}",
            "postpartum_curve": timeline,
            "clinical_rationale": (
                "Postpartum preeclampsia accounts for significant delayed maternal morbidity. "
                "Physiological fluid mobilization commonly produces an arterial pressure peak between days 3 and 6."
            ),
            "disclaimer": "This module tracks research recovery trajectories. Any severe headache, vision change, or SBP >= 160 requires immediate emergency clinical care."
        }

simulation_service = MaternalSimulationService()
