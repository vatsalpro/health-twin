import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, DeviceMeasurement, ClinicalObservation, User
from app.schemas.models import DeviceMeasurementSchema, DeviceMeasurementCreateRequest
from app.api.deps import get_current_user, verify_patient_access
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}/measurements", tags=["Measurements & Sensors"])

@router.get("", response_model=List[DeviceMeasurementSchema])
def list_measurements(
    patient_id: str,
    measurement_type: Optional[str] = Query(None, description="blood_pressure, pulse_oximetry, blood_glucose, wearable_vitals, temperature, weight, symptom_stress"),
    source_type: Optional[str] = Query(None, description="manual, mock_device, bluetooth_ble, vendor_api, health_platform"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """Retrieves longitudinal normalized measurements with source metadata and quality status."""
    query = db.query(DeviceMeasurement).filter(DeviceMeasurement.patient_id == patient_id)
    if measurement_type:
        query = query.filter(DeviceMeasurement.measurement_type == measurement_type)
    if source_type:
        query = query.filter(DeviceMeasurement.source_type == source_type)

    measurements = (
        query.order_by(desc(DeviceMeasurement.measurement_timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for m in measurements:
        ctx = {}
        if m.context_data_json:
            try:
                ctx = json.loads(m.context_data_json)
            except Exception:
                pass

        results.append(
            DeviceMeasurementSchema(
                id=m.id,
                patient_id=m.patient_id,
                device_connection_id=m.device_connection_id,
                measurement_type=m.measurement_type,
                value_numeric=m.value_numeric,
                value_secondary=m.value_secondary,
                value_text=m.value_text,
                unit=m.unit,
                measurement_timestamp=m.measurement_timestamp,
                recording_timestamp=m.recording_timestamp,
                source_type=m.source_type,
                device_manufacturer=m.device_manufacturer,
                device_model=m.device_model,
                context_data=ctx,
                quality_status=m.quality_status,
                confidence=m.confidence,
                is_hypothetical=m.is_hypothetical,
                is_reviewed=m.is_reviewed,
                created_at=m.created_at
            )
        )
    return results

@router.post("", response_model=DeviceMeasurementSchema)
def create_manual_measurement(
    patient_id: str,
    req: DeviceMeasurementCreateRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Unified manual measurement form entry endpoint.
    Performs physiological validation, unit standardization, deduplication,
    and bridges clinical observations to update the Maternal Digital Twin.
    """
    # 1. Deduplication / Idempotency Check
    if req.idempotency_key:
        existing = db.query(DeviceMeasurement).filter(
            DeviceMeasurement.patient_id == patient_id,
            DeviceMeasurement.idempotency_key == req.idempotency_key
        ).first()
        if existing:
            ctx = json.loads(existing.context_data_json) if existing.context_data_json else {}
            return DeviceMeasurementSchema(
                id=existing.id,
                patient_id=existing.patient_id,
                device_connection_id=existing.device_connection_id,
                measurement_type=existing.measurement_type,
                value_numeric=existing.value_numeric,
                value_secondary=existing.value_secondary,
                value_text=existing.value_text,
                unit=existing.unit,
                measurement_timestamp=existing.measurement_timestamp,
                recording_timestamp=existing.recording_timestamp,
                source_type=existing.source_type,
                device_manufacturer=existing.device_manufacturer,
                device_model=existing.device_model,
                context_data=ctx,
                quality_status=existing.quality_status,
                confidence=existing.confidence,
                is_hypothetical=existing.is_hypothetical,
                is_reviewed=existing.is_reviewed,
                created_at=existing.created_at
            )

    # 2. Parse Timestamp
    meas_time = datetime.now(timezone.utc)
    if req.measurement_timestamp:
        try:
            meas_time = datetime.fromisoformat(req.measurement_timestamp.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid measurement_timestamp '{req.measurement_timestamp}'. Must be valid ISO-8601."
            )

    val_num = req.value_numeric
    val_sec = req.value_secondary
    val_text = req.value_text
    unit = req.unit
    quality_status = req.quality_status or "VALID"
    ctx_data = req.context_data or {}

    # 3. Physiological Bounds & Normalization
    m_type = req.measurement_type.lower()

    if m_type == "blood_pressure":
        if val_num is None or val_sec is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Blood pressure requires both Systolic (value_numeric) and Diastolic (value_secondary)."
            )
        if val_num <= val_sec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Systolic pressure must be greater than diastolic pressure."
            )
        if val_num < 60.0 or val_num > 260.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Systolic pressure outside plausible range (60-260 mmHg).")
        if val_sec < 30.0 or val_sec > 160.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Diastolic pressure outside plausible range (30-160 mmHg).")
        val_text = f"{int(val_num)}/{int(val_sec)}"
        unit = "mmHg"
        if val_num >= 160 or val_sec >= 110:
            quality_status = "ALERT_SEVERE"
        elif val_num >= 140 or val_sec >= 90:
            quality_status = "ALERT_ELEVATED"

    elif m_type == "pulse_oximetry":
        if val_num is None or val_num < 50.0 or val_num > 100.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SpO2 percentage must be between 50% and 100%.")
        val_text = f"{round(val_num, 1)}% SpO2"
        unit = "%"
        if val_num < 95.0:
            quality_status = "ALERT_HYPOXIA"

    elif m_type == "blood_glucose":
        if val_num is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Blood glucose requires numeric value.")
        # Unit conversion if mmol/L supplied
        if unit.lower() in ("mmol/l", "mmol/litre"):
            ctx_data["original_unit"] = "mmol/L"
            ctx_data["original_value"] = val_num
            val_num = round(val_num * 18.0182, 1)
            unit = "mg/dL"
        if val_num < 20.0 or val_num > 600.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Blood glucose outside plausible bounds (20-600 mg/dL).")
        val_text = f"{val_num} mg/dL ({ctx_data.get('meal_context', 'casual')})"
        if val_num >= 140.0:
            quality_status = "ALERT_ELEVATED"

    elif m_type == "temperature":
        if val_num is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Temperature requires numeric value.")
        if unit.upper() in ("F", "FAHRENHEIT", "°F"):
            ctx_data["original_unit"] = "°F"
            ctx_data["original_value"] = val_num
            val_num = round((val_num - 32.0) * (5.0 / 9.0), 1)
            unit = "degC"
        if val_num < 32.0 or val_num > 43.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Body temperature outside plausible range (32-43 °C).")
        val_text = f"{val_num} °C"

    elif m_type == "weight":
        if val_num is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Weight requires numeric value.")
        if unit.lower() in ("lbs", "lb", "pounds"):
            ctx_data["original_unit"] = "lbs"
            ctx_data["original_value"] = val_num
            val_num = round(val_num * 0.453592, 1)
            unit = "kg"
        if val_num < 30.0 or val_num > 300.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Weight outside plausible range (30-300 kg).")
        val_text = f"{val_num} kg"

    # 4. Insert Measurement Record
    meas = DeviceMeasurement(
        patient_id=patient_id,
        measurement_type=m_type,
        value_numeric=val_num,
        value_secondary=val_sec,
        value_text=val_text,
        unit=unit,
        measurement_timestamp=meas_time,
        recording_timestamp=datetime.now(timezone.utc),
        source_type=req.source_type or "manual",
        device_manufacturer=req.device_manufacturer or "Manual Patient Entry",
        device_model=req.device_model,
        context_data_json=json.dumps(ctx_data),
        quality_status=quality_status,
        confidence=req.confidence,
        is_hypothetical=False,
        is_reviewed=False,
        idempotency_key=req.idempotency_key
    )
    db.add(meas)

    # 5. Bridge to Clinical Observations for Twin State and Prediction Engine
    if m_type == "blood_pressure":
        # SBP observation
        obs_sbp = ClinicalObservation(
            patient_id=patient_id,
            observation_type="blood_pressure",
            test_name="systolic_bp",
            value_numeric=val_num,
            value_text=str(int(val_num)),
            unit="mmHg",
            is_abnormal=val_num >= 140.0,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        obs_dbp = ClinicalObservation(
            patient_id=patient_id,
            observation_type="blood_pressure",
            test_name="diastolic_bp",
            value_numeric=val_sec,
            value_text=str(int(val_sec)),
            unit="mmHg",
            is_abnormal=val_sec >= 90.0,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        db.add_all([obs_sbp, obs_dbp])

    elif m_type == "blood_glucose":
        obs_glu = ClinicalObservation(
            patient_id=patient_id,
            observation_type="laboratory",
            test_name="fasting_glucose" if "fasting" in str(ctx_data.get("meal_context", "")).lower() else "random_glucose",
            value_numeric=val_num,
            value_text=str(val_num),
            unit="mg/dL",
            is_abnormal=val_num >= 140.0,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        db.add(obs_glu)

    elif m_type == "weight":
        obs_wt = ClinicalObservation(
            patient_id=patient_id,
            observation_type="vital_signs",
            test_name="weight",
            value_numeric=val_num,
            value_text=f"{val_num} kg",
            unit="kg",
            is_abnormal=False,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        db.add(obs_wt)

    elif m_type == "temperature":
        obs_temp = ClinicalObservation(
            patient_id=patient_id,
            observation_type="vital_signs",
            test_name="body_temperature",
            value_numeric=val_num,
            value_text=f"{val_num} degC",
            unit="degC",
            is_abnormal=val_num >= 38.0 or val_num <= 35.5,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        db.add(obs_temp)

        # Backward compatibility: if weight was included in context_data, extract as independent measurement
        legacy_weight = ctx_data.get("weight")
        if legacy_weight is not None:
            try:
                wt_val = float(legacy_weight)
                wt_unit = str(ctx_data.get("weight_unit", "kg")).lower()
                if wt_unit in ("lbs", "lb", "pounds"):
                    wt_val = round(wt_val * 0.453592, 1)
                wt_meas = DeviceMeasurement(
                    patient_id=patient_id,
                    measurement_type="weight",
                    value_numeric=wt_val,
                    value_text=f"{wt_val} kg",
                    unit="kg",
                    measurement_timestamp=meas_time,
                    source_type=req.source_type or "manual",
                    quality_status="VALID",
                    confidence=1.0,
                    context_data_json=json.dumps({"extracted_from_legacy_combined_form": True})
                )
                db.add(wt_meas)
                obs_legacy_wt = ClinicalObservation(
                    patient_id=patient_id,
                    observation_type="vital_signs",
                    test_name="weight",
                    value_numeric=wt_val,
                    value_text=f"{wt_val} kg",
                    unit="kg",
                    is_abnormal=False,
                    measurement_timestamp=meas_time,
                    source_type="manual_measurement",
                    review_status="ACCEPTED"
                )
                db.add(obs_legacy_wt)
            except (ValueError, TypeError):
                pass

    elif m_type == "pulse_oximetry":
        obs_spo2 = ClinicalObservation(
            patient_id=patient_id,
            observation_type="vital_signs",
            test_name="spo2",
            value_numeric=val_num,
            value_text=f"{val_num}%",
            unit="%",
            is_abnormal=val_num < 95.0,
            measurement_timestamp=meas_time,
            source_type="manual_measurement",
            review_status="ACCEPTED"
        )
        db.add(obs_spo2)
        if val_sec is not None:
            obs_hr = ClinicalObservation(
                patient_id=patient_id,
                observation_type="vital_signs",
                test_name="heart_rate",
                value_numeric=val_sec,
                value_text=f"{int(val_sec)} bpm",
                unit="bpm",
                is_abnormal=val_sec > 100.0 or val_sec < 60.0,
                measurement_timestamp=meas_time,
                source_type="manual_measurement",
                review_status="ACCEPTED"
            )
            db.add(obs_hr)

    elif m_type == "wearable_vitals":
        if val_num is not None:
            obs_hr = ClinicalObservation(
                patient_id=patient_id,
                observation_type="vital_signs",
                test_name="heart_rate",
                value_numeric=val_num,
                value_text=f"{int(val_num)} bpm",
                unit="bpm",
                is_abnormal=val_num > 100.0 or val_num < 60.0,
                measurement_timestamp=meas_time,
                source_type="manual_measurement",
                review_status="ACCEPTED"
            )
            db.add(obs_hr)
        if val_sec is not None:
            obs_hrv = ClinicalObservation(
                patient_id=patient_id,
                observation_type="vital_signs",
                test_name="hrv_rmssd",
                value_numeric=val_sec,
                value_text=f"{val_sec} ms",
                unit="ms",
                is_abnormal=False,
                measurement_timestamp=meas_time,
                source_type="manual_measurement",
                review_status="ACCEPTED"
            )
            db.add(obs_hrv)

    db.commit()
    db.refresh(meas)

    # 6. Recalculate Living Twin & Risk Forecast
    twin_service.update_twin_state(db, patient_id)
    prediction_engine.evaluate_risk(db, patient_id)

    audit_service.log_event(
        db=db,
        action="MEASUREMENT_RECORDED",
        user=current_user,
        target_type="DeviceMeasurement",
        target_id=meas.id,
        details={"type": m_type, "value": val_text, "source": req.source_type}
    )

    return DeviceMeasurementSchema(
        id=meas.id,
        patient_id=meas.patient_id,
        device_connection_id=meas.device_connection_id,
        measurement_type=meas.measurement_type,
        value_numeric=meas.value_numeric,
        value_secondary=meas.value_secondary,
        value_text=meas.value_text,
        unit=meas.unit,
        measurement_timestamp=meas.measurement_timestamp,
        recording_timestamp=meas.recording_timestamp,
        source_type=meas.source_type,
        device_manufacturer=meas.device_manufacturer,
        device_model=meas.device_model,
        context_data=ctx_data,
        quality_status=meas.quality_status,
        confidence=meas.confidence,
        is_hypothetical=meas.is_hypothetical,
        is_reviewed=meas.is_reviewed,
        created_at=meas.created_at
    )

@router.post("/batch")
def batch_ingest_measurements(
    patient_id: str,
    readings: List[DeviceMeasurementCreateRequest],
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    High-throughput batch ingestion endpoint designed for mobile companion apps
    (Apple HealthKit & Android Health Connect) and IoT gateway sync.
    """
    ingested_count = 0
    duplicate_count = 0

    for r in readings:
        if r.idempotency_key:
            if db.query(DeviceMeasurement).filter(
                DeviceMeasurement.patient_id == patient_id,
                DeviceMeasurement.idempotency_key == r.idempotency_key
            ).first():
                duplicate_count += 1
                continue

        meas_time = datetime.now(timezone.utc)
        if r.measurement_timestamp:
            try:
                meas_time = datetime.fromisoformat(r.measurement_timestamp.replace("Z", "+00:00"))
            except Exception:
                pass

        meas = DeviceMeasurement(
            patient_id=patient_id,
            measurement_type=r.measurement_type,
            value_numeric=r.value_numeric,
            value_secondary=r.value_secondary,
            value_text=r.value_text or (str(r.value_numeric) if r.value_numeric is not None else ""),
            unit=r.unit,
            measurement_timestamp=meas_time,
            source_type=r.source_type or "health_platform",
            device_manufacturer=r.device_manufacturer,
            device_model=r.device_model,
            context_data_json=json.dumps(r.context_data or {}),
            quality_status=r.quality_status or "VALID",
            confidence=r.confidence,
            is_hypothetical=False,
            idempotency_key=r.idempotency_key
        )
        db.add(meas)
        ingested_count += 1

    db.commit()

    if ingested_count > 0:
        twin_service.update_twin_state(db, patient_id)
        prediction_engine.evaluate_risk(db, patient_id)

    return {
        "status": "success",
        "ingested_count": ingested_count,
        "duplicates_skipped": duplicate_count,
        "message": f"Successfully ingested {ingested_count} readings ({duplicate_count} duplicates skipped)."
    }
