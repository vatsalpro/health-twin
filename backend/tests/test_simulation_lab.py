import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.entities import User, PatientProfile, PregnancyEpisode, RiskPrediction, SimulationScenario
from app.services.simulation_service import simulation_service

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
        id="test-sim-clinician",
        email="clinician.sim@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Dr. Sim Clinician",
        role="clinician"
    )
    p_user = User(
        id="test-sim-user",
        email="patient.sim@pregtwin.org",
        hashed_password=hash_password("Password123!"),
        full_name="Sim Patient",
        role="patient"
    )
    db.add_all([clinician, p_user])
    db.commit()

    patient = PatientProfile(
        id="patient-sim-id",
        user_id=p_user.id,
        mrn="MRN-SIM-001",
        first_name="Sim",
        last_name="Patient",
        date_of_birth="1994-05-12",
        maternal_age=32,
        bmi=24.5,
        is_synthetic=True
    )
    db.add(patient)
    db.commit()

    episode = PregnancyEpisode(
        id="episode-sim-id",
        patient_id=patient.id,
        conception_date="2025-12-10",
        estimated_due_date="2026-09-15",
        current_gestational_age_weeks=30.0,
        is_active=True
    )
    db.add(episode)
    db.commit()

    pred = RiskPrediction(
        id="pred-sim-baseline",
        patient_id=patient.id,
        episode_id=episode.id,
        model_version="v1.4.2-longitudinal-preeclampsia",
        prediction_timestamp=datetime.now(timezone.utc),
        gestational_age_weeks=30.0,
        risk_score=0.18,
        risk_category="MODERATE",
        is_insufficient_data=False,
        model_limitations="Research baseline evaluation."
    )
    db.add(pred)
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

def test_cardiovascular_simulation_math():
    """Verifies transparent MAP, PP, and RPP mathematical formulas."""
    res = simulation_service.simulate_cardiovascular(
        baseline_sbp=120.0,
        baseline_dbp=80.0,
        baseline_hr=70.0,
        sim_sbp=140.0,
        sim_dbp=90.0,
        sim_hr=85.0
    )
    # MAP = (140 + 2*90)/3 = 320/3 = 106.7
    assert res["hypothetical"]["map"] == 106.7
    # PP = 140 - 90 = 50.0
    assert res["hypothetical"]["pulse_pressure"] == 50.0
    # RPP = (140 * 85)/100 = 119.0
    assert res["hypothetical"]["rpp"] == 119.0
    assert res["deltas"]["sbp"]["absolute"] == 20.0
    assert "purely hypothetical" in res["disclaimer"].lower()

def test_gestational_timeline_demarcation():
    """Verifies clear separation between historical, current, and future hypothetical points."""
    res = simulation_service.simulate_gestational_timeline(
        current_ga_weeks=28.0,
        target_ga_weeks=32.0,
        baseline_sbp=120.0,
        baseline_dbp=78.0,
        projected_sbp_slope=1.0,
        projected_dbp_slope=0.5
    )
    sources = [pt["source"] for pt in res["timeline"]]
    assert "CURRENT_OBSERVED" in sources
    assert "FUTURE_HYPOTHETICAL" in sources
    future_points = [pt for pt in res["timeline"] if pt["source"] == "FUTURE_HYPOTHETICAL"]
    assert len(future_points) == 4
    assert future_points[-1]["gestational_age_weeks"] == 32.0
    assert future_points[-1]["sbp"] == 124.0

def test_metabolic_health_unit_conversion():
    """Verifies transparent glucose excursion and mmol/L to mg/dL conversion."""
    res_mmol = simulation_service.simulate_metabolic_health(
        fasting_glucose=5.0,  # ~90.1 mg/dL
        post_meal_glucose=7.8,  # ~140.5 mg/dL
        unit="mmol/L"
    )
    assert res_mmol["normalized_mg_dl"]["fasting"] == 90.1
    assert res_mmol["normalized_mg_dl"]["post_meal"] == 140.5
    assert res_mmol["reference_evaluations"]["fasting_evaluation"] == "NORMAL_TARGET"

def test_sensor_reliability_degradation():
    """Verifies sensor noise and packet dropout penalty calculations."""
    res = simulation_service.simulate_sensor_reliability(
        missing_packet_pct=20.0,
        transmission_delay_min=30.0,
        duplicate_rate_pct=5.0,
        sensor_noise_sigma=8.0,
        low_confidence_pct=10.0,
        device_disconnect_hours=2.0
    )
    assert res["impact_metrics"]["effective_completeness_pct"] < 80.0
    assert res["impact_metrics"]["trend_reliability_score"] < 70.0
    assert "risk_of_undetected_spikes" in res["impact_metrics"]

def test_simulate_endpoint_cardiovascular(client):
    """Verifies API dispatch for cardiovascular scenario."""
    token = create_access_token({"sub": "test-sim-clinician", "email": "clinician.sim@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "category": "cardiovascular",
        "sbp": 145.0,
        "dbp": 92.0,
        "heart_rate": 82.0
    }
    resp = client.post("/api/v1/patients/patient-sim-id/simulate", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "cardiovascular"
    assert "detailed_results" in data
    assert data["detailed_results"]["hypothetical"]["sbp"] == 145.0

def test_scenario_crud_persistence_and_export(client):
    """Verifies full lifecycle: save scenario, list, retrieve, update, export, and delete."""
    token = create_access_token({"sub": "test-sim-clinician", "email": "clinician.sim@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Save
    save_payload = {
        "name": "Week 32 Elevated SBP Test",
        "category": "cardiovascular",
        "description": "Counterfactual exploration of 145/92 mmHg at Week 32",
        "parameters": {"sbp": 145, "dbp": 92, "ga": 32.0},
        "results": {"map": 109.7, "simulated_risk_score": 0.28}
    }
    r_save = client.post("/api/v1/patients/patient-sim-id/scenarios", headers=headers, json=save_payload)
    assert r_save.status_code == 200
    scenario_id = r_save.json()["id"]
    assert r_save.json()["name"] == "Week 32 Elevated SBP Test"

    # 2. List
    r_list = client.get("/api/v1/patients/patient-sim-id/scenarios", headers=headers)
    assert r_list.status_code == 200
    sc_list = r_list.json()
    assert any(s["id"] == scenario_id for s in sc_list)

    # 3. Retrieve
    r_get = client.get(f"/api/v1/patients/patient-sim-id/scenarios/{scenario_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["parameters"]["sbp"] == 145

    # 4. Update
    r_put = client.put(f"/api/v1/patients/patient-sim-id/scenarios/{scenario_id}", headers=headers, json={"name": "Renamed Scenario SBP"})
    assert r_put.status_code == 200
    assert r_put.json()["name"] == "Renamed Scenario SBP"

    # 5. Export CSV
    r_csv = client.get(f"/api/v1/patients/patient-sim-id/scenarios/{scenario_id}/export?format=csv", headers=headers)
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]
    assert "Renamed Scenario SBP" in r_csv.text

    # 6. Delete
    r_del = client.delete(f"/api/v1/patients/patient-sim-id/scenarios/{scenario_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["status"] == "success"

    # Verify deleted
    r_check = client.get(f"/api/v1/patients/patient-sim-id/scenarios/{scenario_id}", headers=headers)
    assert r_check.status_code == 404
