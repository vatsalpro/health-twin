import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.entities import User, PatientProfile, PregnancyEpisode, DeviceConnection, DeviceMeasurement, ClinicalObservation

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    clinician = User(
        id="test-dev-clinician",
        email="clinician.dev@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Dr. Device Clinician",
        role="clinician"
    )
    p_user = User(
        id="test-dev-user",
        email="patient.dev@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Dev Patient",
        role="patient"
    )
    db.add_all([clinician, p_user])
    db.commit()

    patient = PatientProfile(
        id="patient-dev-id",
        user_id=p_user.id,
        mrn="MRN-DEV-001",
        first_name="Dev",
        last_name="Patient",
        date_of_birth="1995-02-14",
        maternal_age=31,
        bmi=23.0,
        is_synthetic=True
    )
    db.add(patient)
    db.commit()

    episode = PregnancyEpisode(
        id="episode-dev-id",
        patient_id=patient.id,
        conception_date="2025-11-20",
        estimated_due_date="2026-08-27",
        current_gestational_age_weeks=32.0,
        is_active=True
    )
    db.add(episode)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def test_device_catalog_discovery_and_connect(client):
    """Verifies default device catalog discovery, handshake connect, and disconnect."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List devices (triggers seeding)
    r_list = client.get("/api/v1/patients/patient-dev-id/devices", headers=headers)
    assert r_list.status_code == 200
    devices = r_list.json()
    assert len(devices) >= 4
    bp_dev = next((d for d in devices if "cuff" in d["device_type"] or "pressure" in d["device_type"]), None)
    assert bp_dev is not None

    # 2. Connect
    r_conn = client.post(f"/api/v1/patients/patient-dev-id/devices/mock/connect?device_id={bp_dev['id']}", headers=headers)
    assert r_conn.status_code == 200
    assert r_conn.json()["connection"]["status"] == "connected"

    # 3. Disconnect
    r_disc = client.post(f"/api/v1/patients/patient-dev-id/devices/mock/disconnect?device_id={bp_dev['id']}", headers=headers)
    assert r_disc.status_code == 200
    assert r_disc.json()["status"] == "success"

def test_mock_readings_generation(client, db_session):
    """Verifies generation and ingestion of synthetic device telemetry into patient log."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    r_gen = client.post("/api/v1/patients/patient-dev-id/devices/mock/generate?device_id=mock_bp_cuff&reading_count=3", headers=headers)
    assert r_gen.status_code == 200
    data = r_gen.json()
    assert data["ingested_count"] == 3
    assert data["is_synthetic"] is True

    # Check records in db
    meas_count = db_session.query(DeviceMeasurement).filter(
        DeviceMeasurement.patient_id == "patient-dev-id",
        DeviceMeasurement.source_type == "mock_device"
    ).count()
    assert meas_count == 3

def test_manual_blood_pressure_measurement_validation_and_twin_update(client, db_session):
    """Verifies manual BP entry, SBP > DBP check, and automatic clinical observation creation."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Invalid BP (SBP <= DBP) rejected
    r_invalid = client.post(
        "/api/v1/patients/patient-dev-id/measurements",
        headers=headers,
        json={
            "measurement_type": "blood_pressure",
            "value_numeric": 80.0,
            "value_secondary": 120.0,
            "unit": "mmHg"
        }
    )
    assert r_invalid.status_code == 400
    assert "greater than diastolic" in r_invalid.json()["detail"].lower()

    # 2. Valid BP
    valid_payload = {
        "measurement_type": "blood_pressure",
        "value_numeric": 142.0,
        "value_secondary": 92.0,
        "unit": "mmHg",
        "context_data": {"position": "sitting", "arm": "left"},
        "idempotency_key": "manual-bp-001"
    }
    r_valid = client.post("/api/v1/patients/patient-dev-id/measurements", headers=headers, json=valid_payload)
    assert r_valid.status_code == 200
    res_data = r_valid.json()
    assert res_data["value_numeric"] == 142.0
    assert res_data["value_secondary"] == 92.0
    assert res_data["quality_status"] == "ALERT_ELEVATED"

    # Verify clinical observation bridged
    sbp_obs = db_session.query(ClinicalObservation).filter(
        ClinicalObservation.patient_id == "patient-dev-id",
        ClinicalObservation.test_name == "systolic_bp"
    ).order_by(ClinicalObservation.created_at.desc()).first()
    assert sbp_obs is not None
    assert sbp_obs.value_numeric == 142.0

    # 3. Idempotency test (repeat call with same key)
    r_repeat = client.post("/api/v1/patients/patient-dev-id/measurements", headers=headers, json=valid_payload)
    assert r_repeat.status_code == 200
    assert r_repeat.json()["id"] == res_data["id"]

def test_manual_glucose_and_spo2_measurement(client):
    """Verifies glucose (with mmol/L conversion) and SpO2 entry."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # Pulse Ox
    r_spo2 = client.post(
        "/api/v1/patients/patient-dev-id/measurements",
        headers=headers,
        json={"measurement_type": "pulse_oximetry", "value_numeric": 98.2, "unit": "%"}
    )
    assert r_spo2.status_code == 200
    assert r_spo2.json()["quality_status"] == "VALID"

    # Glucose mmol/L converted to mg/dL
    r_glu = client.post(
        "/api/v1/patients/patient-dev-id/measurements",
        headers=headers,
        json={
            "measurement_type": "blood_glucose",
            "value_numeric": 5.2,
            "unit": "mmol/L",
            "context_data": {"meal_context": "fasting"}
        }
    )
    assert r_glu.status_code == 200
    assert r_glu.json()["unit"] == "mg/dL"
    assert round(r_glu.json()["value_numeric"], 1) == 93.7

def test_camera_research_status_and_signal_log(client, db_session):
    """Verifies camera signal research status, privacy-compliant signal logging, and consented session history."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Status
    r_status = client.get("/api/v1/patients/patient-dev-id/camera-research/status", headers=headers)
    assert r_status.status_code == 200
    data = r_status.json()
    assert data["is_diagnostic_device"] is False
    assert data["identity_recognition_performed"] is False
    assert "NO_RAW_VIDEO" in data["raw_video_storage_policy"]
    assert "MediaPipe" in data["principles"]["computer_vision"]
    assert "CHROM" in data["principles"]["rppg_signal"]

    # 2. Consent required: consent_confirmed=False should return 400
    r_no_consent = client.post(
        "/api/v1/patients/patient-dev-id/camera-research/signals",
        headers=headers,
        json={
            "session_duration_seconds": 30,
            "signal_quality_score": 85.0,
            "consent_confirmed": False
        }
    )
    assert r_no_consent.status_code == 400
    assert "consent" in r_no_consent.json()["detail"].lower()

    # 3. Log valid research session with consent
    payload = {
        "session_duration_seconds": 45,
        "signal_quality_score": 88.0,
        "lighting_condition": "OPTIMAL",
        "motion_stability": "STABLE",
        "face_tracking_ratio": 1.0,
        "estimated_pulse_bpm": 76.0,
        "hrv_status": "INSUFFICIENT_DURATION",
        "rppg_algorithm": "CHROM_deHaan_2013",
        "rppg_snr_db": 3.8,
        "facial_indicators": {
            "brow_furrow": 0.12,
            "blink_rate_bpm": 18,
            "jaw_open": 0.05,
            "head_jitter": 0.8
        },
        "stress_pipeline_status": "UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER",
        "user_reported_stress": 4.0,
        "user_notes": "Resting seated trial",
        "consent_confirmed": True
    }
    r_log = client.post(
        "/api/v1/patients/patient-dev-id/camera-research/signals",
        headers=headers,
        json=payload
    )
    assert r_log.status_code == 200
    res = r_log.json()
    assert res["status"] == "success"
    assert "Zero raw image" in res["privacy_guarantee"]
    assert res["stress_pipeline_status"] == "UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER"

    # 4. Retrieve session history
    r_sessions = client.get("/api/v1/patients/patient-dev-id/camera-research/sessions", headers=headers)
    assert r_sessions.status_code == 200
    sessions = r_sessions.json()
    assert len(sessions) >= 1
    latest = sessions[0]
    assert latest["duration_seconds"] == 45
    assert latest["estimated_pulse_bpm"] == 76.0
    assert latest["user_reported_stress"] == 4.0
    assert latest["rppg_algorithm"] == "CHROM_deHaan_2013"
    assert latest["consent_confirmed"] is True

def test_device_integration_specifications(client):
    """Verifies specifications for BLE, Vendor Cloud, and Mobile Companion platforms."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    r_specs = client.get("/api/v1/patients/patient-dev-id/devices/specs", headers=headers)
    assert r_specs.status_code == 200
    specs = r_specs.json()
    assert "path_a_direct_ble" in specs
    assert "path_b_vendor_cloud_apis" in specs
    assert "path_c_phone_health_platforms" in specs
    assert specs["path_a_direct_ble"]["verification_status"] == "NOT_PHYSICALLY_VERIFIED (Simulated with MockDeviceConnector)"

def test_independent_temperature_and_weight_measurements(client, db_session):
    """Verifies that temperature and weight are independent first-class measurements and observations."""
    token = create_access_token({"sub": "test-dev-clinician", "email": "clinician.dev@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Independent Temperature Entry (with Fahrenheit to Celsius conversion)
    r_temp = client.post(
        "/api/v1/patients/patient-dev-id/measurements",
        headers=headers,
        json={
            "measurement_type": "temperature",
            "value_numeric": 98.6,
            "unit": "F",
            "context_data": {"site": "oral"}
        }
    )
    assert r_temp.status_code == 200
    temp_data = r_temp.json()
    assert temp_data["measurement_type"] == "temperature"
    assert temp_data["unit"] == "degC"
    assert round(temp_data["value_numeric"], 1) == 37.0

    # 2. Independent Weight Entry (with lbs to kg conversion)
    r_weight = client.post(
        "/api/v1/patients/patient-dev-id/measurements",
        headers=headers,
        json={
            "measurement_type": "weight",
            "value_numeric": 150.0,
            "unit": "lbs",
            "context_data": {"clothing": "light"}
        }
    )
    assert r_weight.status_code == 200
    weight_data = r_weight.json()
    assert weight_data["measurement_type"] == "weight"
    assert weight_data["unit"] == "kg"
    assert round(weight_data["value_numeric"], 1) == 68.0

    # 3. Query independent measurements by type
    r_temp_list = client.get(
        "/api/v1/patients/patient-dev-id/measurements?measurement_type=temperature",
        headers=headers
    )
    assert r_temp_list.status_code == 200
    temps = r_temp_list.json()
    assert any(m["measurement_type"] == "temperature" for m in temps)
    assert all(m["measurement_type"] == "temperature" for m in temps)

    r_weight_list = client.get(
        "/api/v1/patients/patient-dev-id/measurements?measurement_type=weight",
        headers=headers
    )
    assert r_weight_list.status_code == 200
    weights = r_weight_list.json()
    assert any(m["measurement_type"] == "weight" for m in weights)
    assert all(m["measurement_type"] == "weight" for m in weights)

    # 4. Check ClinicalObservations bridged
    obs_temp = db_session.query(ClinicalObservation).filter(
        ClinicalObservation.patient_id == "patient-dev-id",
        ClinicalObservation.test_name == "body_temperature"
    ).first()
    assert obs_temp is not None

    obs_weight = db_session.query(ClinicalObservation).filter(
        ClinicalObservation.patient_id == "patient-dev-id",
        ClinicalObservation.test_name == "weight"
    ).first()
    assert obs_weight is not None

