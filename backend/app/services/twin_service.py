import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.entities import (
    PatientProfile,
    PregnancyEpisode,
    ClinicalObservation,
    MaternalTwinState,
    ExtractedField,
)

class TwinService:
    @staticmethod
    def compute_map(sbp: Optional[float], dbp: Optional[float]) -> Optional[float]:
        """Mean Arterial Pressure (MAP) = (2 * DBP + SBP) / 3"""
        if sbp is not None and dbp is not None:
            return round((2.0 * dbp + sbp) / 3.0, 1)
        return None

    @staticmethod
    def compute_pulse_pressure(sbp: Optional[float], dbp: Optional[float]) -> Optional[float]:
        """Pulse Pressure = SBP - DBP"""
        if sbp is not None and dbp is not None:
            return round(sbp - dbp, 1)
        return None

    @staticmethod
    def update_twin_state(
        db: Session,
        patient_id: str,
        episode_id: Optional[str] = None,
        as_of_timestamp: Optional[datetime] = None
    ) -> MaternalTwinState:
        """
        Recalculates and persists a versioned snapshot of the patient's digital twin
        based strictly on ACCEPTED clinical observations at or prior to `as_of_timestamp`.
        """
        if as_of_timestamp is None:
            as_of_timestamp = datetime.now(timezone.utc)

        # Get latest active episode
        if not episode_id:
            episode = (
                db.query(PregnancyEpisode)
                .filter(PregnancyEpisode.patient_id == patient_id, PregnancyEpisode.is_active == True)
                .first()
            )
            episode_id = episode.id if episode else None
        else:
            episode = db.query(PregnancyEpisode).filter(PregnancyEpisode.id == episode_id).first()

        # Query accepted observations for this patient up to the timestamp
        obs_query = (
            db.query(ClinicalObservation)
            .filter(
                ClinicalObservation.patient_id == patient_id,
                ClinicalObservation.review_status == "ACCEPTED",
                ClinicalObservation.measurement_timestamp <= as_of_timestamp,
            )
            .order_by(desc(ClinicalObservation.measurement_timestamp))
        )
        observations = obs_query.all()

        # Group latest observation per test_name
        latest_values: Dict[str, ClinicalObservation] = {}
        for obs in observations:
            key = obs.test_name.lower().replace(" ", "_")
            if key not in latest_values:
                latest_values[key] = obs

        # Extract latest vitals & labs
        sbp_obs = latest_values.get("systolic_bp") or latest_values.get("sbp")
        dbp_obs = latest_values.get("diastolic_bp") or latest_values.get("dbp")
        plt_obs = latest_values.get("platelets") or latest_values.get("platelet_count")
        ast_obs = latest_values.get("ast")
        alt_obs = latest_values.get("alt")
        creat_obs = latest_values.get("serum_creatinine") or latest_values.get("creatinine")
        prot_obs = latest_values.get("proteinuria_dipstick") or latest_values.get("urine_protein")
        upcr_obs = latest_values.get("protein_creatinine_ratio")

        sbp = sbp_obs.value_numeric if sbp_obs else None
        dbp = dbp_obs.value_numeric if dbp_obs else None
        map_val = TwinService.compute_map(sbp, dbp)
        pp_val = TwinService.compute_pulse_pressure(sbp, dbp)

        platelets = plt_obs.value_numeric if plt_obs else None
        ast = ast_obs.value_numeric if ast_obs else None
        alt = alt_obs.value_numeric if alt_obs else None
        serum_creatinine = creat_obs.value_numeric if creat_obs else None
        proteinuria_dipstick = prot_obs.value_text if prot_obs else None
        protein_creatinine_ratio = upcr_obs.value_numeric if upcr_obs else None

        # Determine gestational age from verified clinical evidence
        ga_weeks = None
        if episode and episode.conception_date:
            try:
                c_date = datetime.strptime(episode.conception_date, "%Y-%m-%d").date()
                ref_date = as_of_timestamp.date() if hasattr(as_of_timestamp, "date") else as_of_timestamp
                diff_days = (ref_date - c_date).days
                if diff_days > 0:
                    ga_weeks = round(diff_days / 7.0, 1)
            except Exception:
                pass

        if ga_weeks is None and episode and episode.current_gestational_age_weeks:
            ga_weeks = episode.current_gestational_age_weeks
        elif ga_weeks is None and sbp_obs and sbp_obs.gestational_age_weeks:
            ga_weeks = sbp_obs.gestational_age_weeks

        # Missingness checks
        missing_indicators = []
        if ga_weeks is None:
            missing_indicators.append("gestational_age")
        if sbp is None or dbp is None:
            missing_indicators.append("blood_pressure")
        if proteinuria_dipstick is None and protein_creatinine_ratio is None:
            missing_indicators.append("proteinuria")
        if platelets is None:
            missing_indicators.append("platelets")
        if ast is None or alt is None:
            missing_indicators.append("liver_transaminases")
        if serum_creatinine is None:
            missing_indicators.append("serum_creatinine")

        # Freshness determination
        data_freshness_status = "FRESH"
        if missing_indicators:
            data_freshness_status = "INCOMPLETE"
        elif sbp_obs and (as_of_timestamp - sbp_obs.measurement_timestamp.replace(tzinfo=timezone.utc if sbp_obs.measurement_timestamp.tzinfo is None else sbp_obs.measurement_timestamp.tzinfo)).days > 14:
            data_freshness_status = "STALE"

        # Versioning
        last_state = (
            db.query(MaternalTwinState)
            .filter(MaternalTwinState.patient_id == patient_id)
            .order_by(desc(MaternalTwinState.version))
            .first()
        )
        new_version = (last_state.version + 1) if last_state else 1

        telemetry_summary = {
            "mean_arterial_pressure": map_val,
            "pulse_pressure": pp_val,
            "hypertensive_stage": "Stage 2" if (sbp and sbp >= 140) or (dbp and dbp >= 90) else "Normotensive",
            "accepted_observations_count": len(observations),
            "last_observation_date": observations[0].measurement_timestamp.isoformat() if observations else None,
        }

        twin_state = MaternalTwinState(
            patient_id=patient_id,
            episode_id=episode_id,
            version=new_version,
            timestamp=as_of_timestamp,
            gestational_age_weeks=ga_weeks,
            sbp=sbp,
            dbp=dbp,
            map_pressure=map_val,
            pulse_pressure=pp_val,
            proteinuria_dipstick=proteinuria_dipstick,
            protein_creatinine_ratio=protein_creatinine_ratio,
            platelets=platelets,
            ast=ast,
            alt=alt,
            serum_creatinine=serum_creatinine,
            data_freshness_status=data_freshness_status,
            missing_indicators_json=json.dumps(missing_indicators),
            telemetry_summary_json=json.dumps(telemetry_summary),
        )

        db.add(twin_state)
        db.commit()
        db.refresh(twin_state)
        return twin_state

twin_service = TwinService()
