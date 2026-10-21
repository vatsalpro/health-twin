import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import PatientProfile, DeviceConnection, DeviceMeasurement, User
from app.schemas.models import DeviceConnectionSchema, DeviceMeasurementSchema
from app.api.deps import get_current_user, verify_patient_access
from app.services.device_connectors import mock_device_connector, IntegrationSpecifications
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}/devices", tags=["IoT & Devices"])

@router.get("", response_model=List[DeviceConnectionSchema])
def list_patient_devices(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """Lists all registered or simulated device sources for the active patient."""
    devices = (
        db.query(DeviceConnection)
        .filter(DeviceConnection.patient_id == patient_id)
        .order_by(desc(DeviceConnection.created_at))
        .all()
    )

    # If no devices are registered yet, seed the default catalog of simulated research devices
    if not devices:
        catalog = mock_device_connector.discover_devices()
        for item in catalog:
            dev = DeviceConnection(
                patient_id=patient_id,
                device_type=item["device_type"],
                manufacturer=item["manufacturer"],
                model_name=item["model_name"],
                serial_number=f"MOCK-SN-{item['device_id'].upper()}",
                connection_protocol=item["protocol"],
                connection_status="disconnected",
                battery_percentage=88,
                settings_json=json.dumps({"is_synthetic": True, "supported": item["supported_measurements"]})
            )
            db.add(dev)
        db.commit()
        devices = (
            db.query(DeviceConnection)
            .filter(DeviceConnection.patient_id == patient_id)
            .order_by(desc(DeviceConnection.created_at))
            .all()
        )

    return [
        DeviceConnectionSchema(
            id=d.id,
            patient_id=d.patient_id,
            device_type=d.device_type,
            manufacturer=d.manufacturer,
            model_name=d.model_name,
            serial_number=d.serial_number,
            connection_protocol=d.connection_protocol,
            connection_status=d.connection_status,
            battery_percentage=d.battery_percentage,
            last_sync_at=d.last_sync_at,
            error_message=d.error_message,
            created_at=d.created_at
        )
        for d in devices
    ]

@router.post("/mock/connect")
def connect_mock_device(
    patient_id: str,
    device_id: str = Query(..., description="Device ID from catalog or database connection ID"),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """Simulates connection and handshake with a maternal monitoring device."""
    dev = db.query(DeviceConnection).filter(
        DeviceConnection.patient_id == patient_id,
        (DeviceConnection.id == device_id) | (DeviceConnection.serial_number.like(f"%{device_id.upper()}%"))
    ).first()

    conn_meta = mock_device_connector.connect(device_id)

    if dev:
        dev.connection_status = "connected"
        dev.battery_percentage = conn_meta["battery_percentage"]
        dev.last_sync_at = datetime.now(timezone.utc)
        dev.error_message = None
        db.commit()
        db.refresh(dev)

    audit_service.log_event(
        db=db,
        action="DEVICE_CONNECTED",
        user=current_user,
        target_type="DeviceConnection",
        target_id=dev.id if dev else device_id,
        details={"status": "connected", "protocol": "mock"}
    )

    return {
        "status": "success",
        "message": f"Device '{dev.model_name if dev else device_id}' connected successfully (Simulated).",
        "connection": conn_meta
    }

@router.post("/mock/disconnect")
def disconnect_mock_device(
    patient_id: str,
    device_id: str = Query(..., description="Device ID from catalog or database connection ID"),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """Simulates disconnecting or unpairing a monitoring device."""
    dev = db.query(DeviceConnection).filter(
        DeviceConnection.patient_id == patient_id,
        (DeviceConnection.id == device_id) | (DeviceConnection.serial_number.like(f"%{device_id.upper()}%"))
    ).first()

    mock_device_connector.disconnect(device_id)

    if dev:
        dev.connection_status = "disconnected"
        db.commit()

    return {"status": "success", "message": "Device disconnected."}

@router.post("/mock/generate")
def generate_mock_readings(
    patient_id: str,
    device_id: str = Query(..., description="Database connection ID or mock device type key"),
    reading_count: int = Query(1, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Developer / Researcher sandbox endpoint: Generates high-fidelity synthetic sensor data
    and ingests it into the patient's normalized measurement log.
    Updates the Living Maternal Twin and recalculates predictions.
    """
    dev = db.query(DeviceConnection).filter(
        DeviceConnection.patient_id == patient_id,
        (DeviceConnection.id == device_id) | (DeviceConnection.serial_number.like(f"%{device_id.upper()}%"))
    ).first()

    dev_key = device_id
    if dev:
        if "cuff" in dev.device_type or "pressure" in dev.device_type:
            dev_key = "mock_bp_cuff"
        elif "oximeter" in dev.device_type:
            dev_key = "mock_pulse_ox"
        elif "glucose" in dev.device_type:
            dev_key = "mock_glucose_meter"
        else:
            dev_key = "mock_wearable_ring"

    generated_readings = mock_device_connector.read_measurements(dev_key, count=reading_count)
    inserted_records = []

    for item in generated_readings:
        meas = DeviceMeasurement(
            patient_id=patient_id,
            device_connection_id=dev.id if dev else None,
            measurement_type=item["measurement_type"],
            value_numeric=item["value_numeric"],
            value_secondary=item.get("value_secondary"),
            value_text=item["value_text"],
            unit=item["unit"],
            measurement_timestamp=item["measurement_timestamp"],
            recording_timestamp=datetime.now(timezone.utc),
            source_type="mock_device",
            device_manufacturer=item.get("device_manufacturer"),
            device_model=item.get("device_model"),
            context_data_json=json.dumps(item.get("context_data", {})),
            quality_status=item.get("quality_status", "VALID"),
            confidence=item.get("confidence", 1.0),
            is_hypothetical=True,
            is_reviewed=False,
            idempotency_key=item.get("idempotency_key")
        )
        db.add(meas)
        inserted_records.append(meas)

    if dev:
        dev.last_sync_at = datetime.now(timezone.utc)
        dev.connection_status = "connected"

    db.commit()

    # Re-evaluate twin state and prediction
    twin_service.update_twin_state(db, patient_id)
    prediction_engine.evaluate_risk(db, patient_id)

    audit_service.log_event(
        db=db,
        action="DEVICE_MEASUREMENTS_INGESTED",
        user=current_user,
        target_type="DeviceMeasurement",
        target_id=patient_id,
        details={"count": len(inserted_records), "device": dev.model_name if dev else dev_key}
    )

    return {
        "status": "success",
        "ingested_count": len(inserted_records),
        "device": dev.model_name if dev else dev_key,
        "is_synthetic": True,
        "message": f"Successfully ingested {len(inserted_records)} synthetic telemetry readings into patient record."
    }

@router.get("/specs")
def get_device_integration_specs(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access)
):
    """
    Returns technical specifications and requirements for physical hardware integrations:
    Direct BLE, Vendor Cloud APIs, and Apple HealthKit / Android Health Connect.
    """
    return IntegrationSpecifications.get_all_specs()
