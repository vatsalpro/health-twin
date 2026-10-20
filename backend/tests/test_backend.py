import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.entities import User, PatientProfile, PregnancyEpisode, ClinicalObservation, ExtractedField, MedicalDocument
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine

# Use an in-memory SQLite database with StaticPool for test isolation
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
    
    # Create test users: 1 clinician, 2 patients
    clinician = User(
        id="test-clinician-1",
        email="clinician.test@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Dr. Test Clinician",
        role="clinician"
    )
    p1_user = User(
        id="test-user-p1",
        email="patient1.test@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Patient One",
        role="patient"
    )
    p2_user = User(
        id="test-user-p2",
        email="patient2.test@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Patient Two",
        role="patient"
    )
    db.add_all([clinician, p1_user, p2_user])
    db.commit()

    # Patient profiles
    p1 = PatientProfile(
        id="patient-1-id",
        user_id=p1_user.id,
        mrn="MRN-TEST-001",
        first_name="Patient",
        last_name="One",
        date_of_birth="1995-01-01",
        maternal_age=31,
        bmi=25.0,
        is_synthetic=True
    )
    p2 = PatientProfile(
        id="patient-2-id",
        user_id=p2_user.id,
        mrn="MRN-TEST-002",
        first_name="Patient",
        last_name="Two",
        date_of_birth="1996-01-01",
        maternal_age=28,
        bmi=22.0,
        is_synthetic=True
    )
    db.add_all([p1, p2])
    db.commit()

    # Episode for p1 (GA >= 20 weeks at t1)
    ep1 = PregnancyEpisode(
        id="ep-1-id",
        patient_id=p1.id,
        conception_date="2025-12-15",
        estimated_due_date="2026-09-20",
        current_gestational_age_weeks=28.0,
        is_active=True
    )
    db.add(ep1)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_unauthenticated_request_rejected(client):
    resp = client.get("/api/v1/patients")
    assert resp.status_code == 401

def test_patient_cannot_access_other_patient_data(client, db_session):
    # Token for patient 1
    token_p1 = create_access_token({"sub": "test-user-p1", "email": "patient1.test@pregtwin.org", "role": "patient"})
    headers = {"Authorization": f"Bearer {token_p1}"}

    # Access self (patient 1) -> 200
    resp_self = client.get("/api/v1/patients/patient-1-id", headers=headers)
    assert resp_self.status_code == 200

    # Access patient 2 -> 403 Forbidden
    resp_other = client.get("/api/v1/patients/patient-2-id", headers=headers)
    assert resp_other.status_code == 403

def test_clinician_can_access_patients(client):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.get("/api/v1/patients/patient-1-id", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Patient"

def test_insufficient_data_guard_under_20_weeks(client, db_session):
    # Patient 2 has no observations and GA is under 20w (or undefined)
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.post("/api/v1/patients/patient-2-id/predictions/recompute", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_insufficient_data"] == True
    assert data["risk_score"] is None
    assert data["risk_category"] == "INSUFFICIENT_DATA"

def test_leakage_prevention_temporal_cutoff(db_session):
    # Add an observation at t1 (e.g. 2026-06-01) and an observation at t2 (2026-07-01)
    t1 = datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)

    obs1 = ClinicalObservation(
        patient_id="patient-1-id",
        observation_type="blood_pressure",
        test_name="systolic_bp",
        value_numeric=120.0,
        value_text="120",
        unit="mmHg",
        measurement_timestamp=t1,
        gestational_age_weeks=22.0,
        source_type="accepted_document",
        review_status="ACCEPTED"
    )
    obs1_d = ClinicalObservation(
        patient_id="patient-1-id",
        observation_type="blood_pressure",
        test_name="diastolic_bp",
        value_numeric=80.0,
        value_text="80",
        unit="mmHg",
        measurement_timestamp=t1,
        gestational_age_weeks=22.0,
        source_type="accepted_document",
        review_status="ACCEPTED"
    )
    # Severe reading in the future (t2)
    obs2 = ClinicalObservation(
        patient_id="patient-1-id",
        observation_type="blood_pressure",
        test_name="systolic_bp",
        value_numeric=165.0,
        value_text="165",
        unit="mmHg",
        measurement_timestamp=t2,
        gestational_age_weeks=26.0,
        source_type="accepted_document",
        review_status="ACCEPTED"
    )
    db_session.add_all([obs1, obs1_d, obs2])
    db_session.commit()

    # When predicting as of t1, obs2 (future 165 mmHg) MUST NOT be seen
    pred_t1 = prediction_engine.evaluate_risk(db_session, "patient-1-id", prediction_timestamp=t1)
    assert pred_t1.is_insufficient_data == False
    assert pred_t1.risk_category == "LOW"  # 120/80 is low risk

    # When predicting as of t2, obs2 is included
    pred_t2 = prediction_engine.evaluate_risk(db_session, "patient-1-id", prediction_timestamp=t2)
    assert pred_t2.risk_category in ("MODERATE", "HIGH")
