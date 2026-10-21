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
from app.services.ai_extractor import ai_extractor

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

    # Access patient 2 -> 404 Not Found (avoids leaking record existence)
    resp_other = client.get("/api/v1/patients/patient-2-id", headers=headers)
    assert resp_other.status_code in (403, 404)

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

def test_invalid_as_of_timestamp_rejected(client):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.post("/api/v1/patients/patient-1-id/predictions/recompute?as_of=invalid-timestamp-value", headers=headers)
    assert resp.status_code == 400
    assert "Invalid 'as_of' timestamp" in resp.json()["detail"]

def test_simulation_validation_and_ownership(client, db_session):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    # Patient 2 has no baseline -> 400
    resp_no_base = client.post("/api/v1/patients/patient-2-id/simulate", headers=headers, json={
        "gestational_age_weeks": 28.0,
        "sbp": 140.0,
        "dbp": 90.0,
        "proteinuria_dipstick": "1+",
        "platelets": 150.0,
        "ast": 30.0,
        "alt": 25.0,
        "serum_creatinine": 0.8
    })
    assert resp_no_base.status_code == 400
    assert "no valid baseline" in resp_no_base.json()["detail"].lower()

    # SBP <= DBP -> 400 Bad Request
    resp_bad_bp = client.post("/api/v1/patients/patient-1-id/simulate", headers=headers, json={
        "gestational_age_weeks": 28.0,
        "sbp": 80.0,
        "dbp": 120.0,
        "proteinuria_dipstick": "1+",
        "platelets": 150.0,
        "ast": 30.0,
        "alt": 25.0,
        "serum_creatinine": 0.8
    })
    assert resp_bad_bp.status_code == 400
    assert "greater than diastolic" in resp_bad_bp.json()["detail"].lower()

    # Non-existent or other patient's baseline ID -> 404
    resp_bad_id = client.post("/api/v1/patients/patient-1-id/simulate", headers=headers, json={
        "baseline_prediction_id": "non-existent-pred-id",
        "gestational_age_weeks": 28.0,
        "sbp": 140.0,
        "dbp": 90.0,
        "proteinuria_dipstick": "1+",
        "platelets": 150.0,
        "ast": 30.0,
        "alt": 25.0,
        "serum_creatinine": 0.8
    })
    assert resp_bad_id.status_code == 404

    # Valid simulation for patient 1 (has baseline from prior test)
    resp_valid = client.post("/api/v1/patients/patient-1-id/simulate", headers=headers, json={
        "gestational_age_weeks": 28.0,
        "sbp": 155.0,
        "dbp": 98.0,
        "proteinuria_dipstick": "2+",
        "platelets": 125.0,
        "ast": 55.0,
        "alt": 48.0,
        "serum_creatinine": 0.95
    })
    assert resp_valid.status_code == 200
    data = resp_valid.json()
    assert data["is_causal_treatment_claim"] == False
    assert "not infer" in data["warning"].lower()
    assert data["simulated_risk_score"] > 0.0

def test_idempotent_field_review(client, db_session):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    # Setup document and field
    doc = MedicalDocument(
        id="test-doc-id-1",
        patient_id="patient-1-id",
        filename="antenatal_test.pdf",
        file_path="/storage/test.pdf",
        file_hash="abc123hash",
        file_size_bytes=1024,
        mime_type="application/pdf",
        report_date="2026-06-15",
        processing_status="EXTRACTED"
    )
    field = ExtractedField(
        id="test-field-id-1",
        document_id=doc.id,
        patient_id="patient-1-id",
        field_name="systolic_bp",
        category="blood_pressure",
        extracted_value="148",
        unit="mmHg",
        confidence=0.98,
        validation_status="VALID",
        review_status="UNREVIEWED"
    )
    db_session.add_all([doc, field])
    db_session.commit()

    # First review: ACCEPT
    resp1 = client.post(
        f"/api/v1/documents/{doc.id}/fields/{field.id}/review",
        headers=headers,
        json={"decision": "ACCEPT", "clinician_notes": "First review"}
    )
    assert resp1.status_code == 200

    obs_count = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field.id).count()
    assert obs_count == 1

    # Second review: ACCEPT again (idempotent upsert check)
    resp2 = client.post(
        f"/api/v1/documents/{doc.id}/fields/{field.id}/review",
        headers=headers,
        json={"decision": "ACCEPT", "clinician_notes": "Second review"}
    )
    assert resp2.status_code == 200

    obs_count_after = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field.id).count()
    assert obs_count_after == 1  # No duplicate observation!

    # Third review: REJECT -> observation removed
    resp3 = client.post(
        f"/api/v1/documents/{doc.id}/fields/{field.id}/review",
        headers=headers,
        json={"decision": "REJECT", "clinician_notes": "Spurious reading"}
    )
    assert resp3.status_code == 200

    obs_count_rejected = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field.id).count()
    assert obs_count_rejected == 0

def test_upload_file_signature_validation(client):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    # Invalid PDF missing %PDF signature
    resp = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        data={"patient_id": "patient-1-id"},
        files={"file": ("corrupt.pdf", b"PLAIN_TEXT_NOT_PDF", "application/pdf")}
    )
    assert resp.status_code == 400
    assert "missing standard '%pdf'" in resp.json()["detail"].lower()

    # Executable binary rejection
    resp_exe = client.post(
        "/api/v1/documents/upload",
        headers=headers,
        data={"patient_id": "patient-1-id"},
        files={"file": ("malware.txt", b"MZ\x90\x00\x03\x00\x00\x00", "text/plain")}
    )
    assert resp_exe.status_code == 400
    assert "executable binaries are strictly forbidden" in resp_exe.json()["detail"].lower()

def test_model_evaluation_truthful_state(client):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.get("/api/v1/models/preeclampsia/evaluation", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["evaluation_status"] == "not_evaluated"
    assert data["metrics_available"] == False
    assert data["metrics"] is None

def test_health_and_readiness_endpoints(client):
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "healthy"

    resp_ready = client.get("/ready")
    assert resp_ready.status_code == 200
    assert resp_ready.json()["status"] == "ready"
    assert resp_ready.json()["details"]["database"] == "connected"

def test_login_enumeration_guard(client):
    # Non-existent user
    resp_no_user = client.post("/api/v1/auth/login", json={"email": "nobody@pregtwin.org", "password": "Password123!"})
    assert resp_no_user.status_code == 401

    # Existing user, wrong password
    resp_wrong_pw = client.post("/api/v1/auth/login", json={"email": "clinician.test@pregtwin.org", "password": "WrongPassword!"})
    assert resp_wrong_pw.status_code == 401

    # Error message must be identical
    assert resp_no_user.json()["detail"] == resp_wrong_pw.json()["detail"]

@pytest.mark.anyio
async def test_ollama_availability_check():
    avail = await ai_extractor.check_ollama_availability()
    assert avail["reachable"] is True
    assert avail["model_available"] is True
    assert avail["configured_model"] == "llama3.2:3b"
    assert "llama3.2:3b" in avail["installed_models"]
    assert avail["error"] is None

def test_ollama_normalization_and_bounds_guard():
    # Valid BP normalization
    norm_s = ai_extractor._validate_and_normalize_field({"field_name": "sbp", "extracted_value": "144", "unit": "mmHg"})
    assert norm_s is not None
    assert norm_s["field_name"] == "systolic_bp"
    assert norm_s["extracted_value"] == "144"
    assert norm_s["category"] == "blood_pressure"

    # Physiological implausibility rejection
    bad_bp = ai_extractor._validate_and_normalize_field({"field_name": "sbp", "extracted_value": "999"})
    assert bad_bp is None

    bad_ga = ai_extractor._validate_and_normalize_field({"field_name": "gestational_age", "extracted_value": "65.0"})
    assert bad_ga is None

    # Complex Gestational age parsing (30w2d -> 30.3)
    norm_ga = ai_extractor._validate_and_normalize_field({"field_name": "gestational_age", "extracted_value": "30 weeks 2 days"})
    assert norm_ga is not None
    assert norm_ga["field_name"] == "gestational_age_weeks"
    assert norm_ga["extracted_value"] == "30.3"

    # Glucose normalization
    norm_glu = ai_extractor._validate_and_normalize_field({"field_name": "fasting_glucose", "extracted_value": "92", "unit": "mg/dL"})
    assert norm_glu is not None
    assert norm_glu["category"] == "glucose_metabolism"
    assert norm_glu["extracted_value"] == "92"

@pytest.mark.anyio
async def test_ollama_model_unavailable_fallback():
    # Simulate an unavailable or misconfigured model
    orig_model = ai_extractor.ollama_model
    try:
        ai_extractor.ollama_model = "non-existent-model-xyz-123"
        # Should gracefully fallback to deterministic clinical rules
        result = await ai_extractor.extract_and_summarize(
            text="Patient blood pressure: 142/90 mmHg. Platelets: 180. Urine protein: negative.",
            pages_data=[]
        )
        assert len(result.extracted_fields) >= 2
        assert "systolic_bp" in [f["field_name"] for f in result.extracted_fields]
        assert "Deterministic Clinical Rules" in result.provider_name
    finally:
        ai_extractor.ollama_model = orig_model

def test_system_diagnostics_ollama(client):
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.get("/api/v1/system/diagnostics", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["ai_provider"]["configured_provider"] == "ollama"
    assert data["ai_provider"]["ollama_model"] == "llama3.2:3b"
    assert data["ai_provider"]["ollama_reachable"] is True
    assert data["ai_provider"]["ollama_model_available"] is True
    assert "llama3.2:3b" in data["ai_provider"]["ollama_installed_models"]
    assert data["ocr_engine"]["configured_engine"] == "tesseract"
    assert "Tesseract" in data["ocr_engine"]["notice"]

# =========================================================================
# Regression Tests for Audit Findings PT-001 through PT-005
# =========================================================================

def test_accept_all_preserves_clinician_correction(client, db_session):
    """
    PT-001: Verifies that accept-all preserves clinician modifications,
    uses the corrected value in ClinicalObservation, and keeps the original
    extracted value preserved in ExtractedField.extracted_value.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    # Create test document and fields
    doc = MedicalDocument(
        id="test-doc-pt001",
        patient_id="patient-1-id",
        filename="antenatal_test.pdf",
        file_path="mock/path.pdf",
        file_hash="dummyhash",
        file_size_bytes=1024,
        mime_type="application/pdf",
        category="Antenatal visit summary",
        report_date="2026-10-18",
        source_institution="Test Clinic",
        processing_status="EXTRACTED"
    )
    db_session.add(doc)

    field_sbp = ExtractedField(
        id="field-sbp-pt001",
        document_id=doc.id,
        patient_id="patient-1-id",
        field_name="systolic_bp",
        category="blood_pressure",
        extracted_value="140",
        unit="mmHg",
        source_text="140/90",
        source_page=1,
        review_status="UNREVIEWED"
    )
    field_dbp = ExtractedField(
        id="field-dbp-pt001",
        document_id=doc.id,
        patient_id="patient-1-id",
        field_name="diastolic_bp",
        category="blood_pressure",
        extracted_value="90",
        unit="mmHg",
        source_text="140/90",
        source_page=1,
        review_status="UNREVIEWED"
    )
    db_session.add(field_sbp)
    db_session.add(field_dbp)
    db_session.commit()

    # Step 1: Clinician modifies SBP from 140 to 138
    mod_resp = client.post(
        f"/api/v1/documents/{doc.id}/fields/{field_sbp.id}/review",
        headers=headers,
        json={"decision": "MODIFY", "correction_value": "138", "clinician_notes": "Manual cuff recheck verified 138"}
    )
    assert mod_resp.status_code == 200
    assert mod_resp.json()["review_status"] == "MODIFIED"

    # Step 2: Trigger accept-all
    acc_resp = client.post(f"/api/v1/documents/{doc.id}/accept-all", headers=headers)
    assert acc_resp.status_code == 200

    # Step 3: Verify ExtractedField state
    db_session.refresh(field_sbp)
    assert field_sbp.extracted_value == "140", "Original extracted value must remain preserved"
    assert field_sbp.clinician_correction == "138", "Clinician correction must remain preserved"
    assert field_sbp.review_status == "MODIFIED", "Status must remain MODIFIED"

    # Step 4: Verify ClinicalObservation state
    obs_sbp = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field_sbp.id).first()
    assert obs_sbp is not None
    assert obs_sbp.value_numeric == 138.0, "Effective numeric observation must be 138, not 140"
    assert obs_sbp.value_text == "138", "Effective text observation must be 138"
    assert obs_sbp.review_status == "ACCEPTED"

    # Unmodified field should use its extracted value
    obs_dbp = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field_dbp.id).first()
    assert obs_dbp is not None
    assert obs_dbp.value_numeric == 90.0
    assert obs_dbp.value_text == "90"

def test_accept_all_never_resurrects_rejected_field(client, db_session):
    """
    PT-002: Verifies that accept-all explicitly skips REJECTED fields,
    keeps their status as REJECTED, and creates no observations from them.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    doc = MedicalDocument(
        id="test-doc-pt002",
        patient_id="patient-1-id",
        filename="rejection_test.pdf",
        file_path="mock/path2.pdf",
        file_hash="dummyhash2",
        file_size_bytes=1024,
        mime_type="application/pdf",
        category="Antenatal visit summary",
        report_date="2026-10-18",
        source_institution="Test Clinic",
        processing_status="EXTRACTED"
    )
    db_session.add(doc)

    field_pulse = ExtractedField(
        id="field-pulse-pt002",
        document_id=doc.id,
        patient_id="patient-1-id",
        field_name="pulse",
        category="clinical_indicator",
        extracted_value="92",
        unit="beats/min",
        source_text="Pulse: 92",
        source_page=1,
        review_status="UNREVIEWED"
    )
    field_ast = ExtractedField(
        id="field-ast-pt002",
        document_id=doc.id,
        patient_id="patient-1-id",
        field_name="ast",
        category="laboratory",
        extracted_value="34",
        unit="U/L",
        source_text="AST 34",
        source_page=1,
        review_status="UNREVIEWED"
    )
    db_session.add(field_pulse)
    db_session.add(field_ast)
    db_session.commit()

    # Step 1: Reject pulse field
    rej_resp = client.post(
        f"/api/v1/documents/{doc.id}/fields/{field_pulse.id}/review",
        headers=headers,
        json={"decision": "REJECT", "clinician_notes": "Not part of preeclampsia panel"}
    )
    assert rej_resp.status_code == 200
    assert rej_resp.json()["review_status"] == "REJECTED"

    # Step 2: Trigger accept-all
    acc_resp = client.post(f"/api/v1/documents/{doc.id}/accept-all", headers=headers)
    assert acc_resp.status_code == 200
    assert acc_resp.json()["skipped_rejected_count"] == 1

    # Step 3: Verify pulse field is STILL REJECTED and has NO observation
    db_session.refresh(field_pulse)
    assert field_pulse.review_status == "REJECTED", "Rejected field must never be resurrected to ACCEPTED"
    obs_pulse = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field_pulse.id).first()
    assert obs_pulse is None, "No observation should ever be created for a rejected field"

    # Step 4: Verify AST was accepted normally
    db_session.refresh(field_ast)
    assert field_ast.review_status == "ACCEPTED"
    obs_ast = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_extracted_field_id == field_ast.id).first()
    assert obs_ast is not None
    assert obs_ast.value_numeric == 34.0

def test_accept_all_idempotency_zero_duplicates(client, db_session):
    """
    PT-001/PT-002: Verifies that repeatedly executing accept-all
    is strictly idempotent and produces zero duplicate observations.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    doc_id = "test-doc-pt001"
    # Call accept-all a second time
    resp2 = client.post(f"/api/v1/documents/{doc_id}/accept-all", headers=headers)
    assert resp2.status_code == 200

    # Call accept-all a third time
    resp3 = client.post(f"/api/v1/documents/{doc_id}/accept-all", headers=headers)
    assert resp3.status_code == 200

    obs_list = db_session.query(ClinicalObservation).filter(ClinicalObservation.source_document_id == doc_id).all()
    assert len(obs_list) == 2, f"Expected exactly 2 observations (sbp, dbp), found {len(obs_list)}"
    unique_names = {o.test_name for o in obs_list}
    assert len(unique_names) == 2, "Duplicate observations detected on repeated accept-all"

def test_invalid_field_correction_rejected(client, db_session):
    """
    PT-001: Verifies that submitting empty or clinically implausible
    corrections fails safely with HTTP 400.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    # Empty correction
    r1 = client.post(
        "/api/v1/documents/test-doc-pt001/fields/field-sbp-pt001/review",
        headers=headers,
        json={"decision": "MODIFY", "correction_value": "  ", "clinician_notes": "empty"}
    )
    assert r1.status_code == 400
    assert "correction_value is required" in r1.json()["detail"].lower()

    # Out-of-bounds SBP correction (999 mmHg)
    r2 = client.post(
        "/api/v1/documents/test-doc-pt001/fields/field-sbp-pt001/review",
        headers=headers,
        json={"decision": "MODIFY", "correction_value": "999", "clinician_notes": "typo"}
    )
    assert r2.status_code == 400
    assert "outside plausible clinical bounds" in r2.json()["detail"].lower()

def test_fasting_plasma_vs_historical_glucose_extraction():
    """
    PT-003: Verifies that deterministic extraction recognizes 'Fasting plasma glucose'
    and prioritizes current visit measurements (92 mg/dL) over historical records (88 mg/dL).
    """
    report_text = """
    3. Laboratory results
    Test                    Result    Unit     Collection timestamp
    Fasting plasma glucose  92        mg/dL    2026-10-18 07:40 IST
    OGTT 1-hour glucose     178       mg/dL    2026-10-18 08:40 IST

    4. Historical observations
    Measurement             Result    Timestamp            Context
    Fasting glucose         88 mg/dL  2026-09-20 07:30 IST Prior lab result
    """
    fields, _ = ai_extractor._deterministic_extract(report_text, pages_data=[])
    fbg_field = next((f for f in fields if f["field_name"] == "fasting_glucose"), None)
    assert fbg_field is not None, "fasting_glucose must be extracted"
    assert fbg_field["extracted_value"] == "92", f"Expected current value 92 mg/dL, got {fbg_field['extracted_value']}"
    assert fbg_field["unit"] == "mg/dL"

def test_multiline_gestational_age_extraction():
    """
    PT-004: Verifies extraction and normalization of various gestational age formats:
    - 'Gestational age at visit\n30 weeks + 2 days' -> 30.3
    - 'Gestational age at visit: 30 weeks + 2 days' -> 30.3
    - 'GA: 30w + 2d' -> 30.3
    - '30 weeks and 2 days' -> 30.3
    """
    test_cases = [
        ("Gestational age at visit\n30 weeks + 2 days (30+2 weeks)", "30.3"),
        ("Gestational age at visit: 30 weeks + 2 days", "30.3"),
        ("GA at visit: 30w + 2d", "30.3"),
        ("Gestational Age: 30 weeks and 2 days", "30.3"),
        ("Gestational age at visit: 30+2 weeks", "30.3"),
        ("Gestation: 29.3 weeks", "29.3"),
    ]
    for text_sample, expected_ga in test_cases:
        fields, _ = ai_extractor._deterministic_extract(text_sample, pages_data=[])
        ga_field = next((f for f in fields if f["field_name"] == "gestational_age_weeks"), None)
        assert ga_field is not None, f"Failed to extract GA from: {text_sample!r}"
        assert ga_field["extracted_value"] == expected_ga, f"For {text_sample!r}, expected {expected_ga}, got {ga_field['extracted_value']}"

def test_urine_protein_to_creatinine_ratio_extraction():
    """
    PT-005: Verifies extraction of UPCR from multiline antenatal tables:
    'Urine protein-to-creatinine ratio\n0.34\nmg/mg' -> 0.34 mg/mg
    """
    sample_text = """
    Test                               Result    Unit     Collection timestamp
    Urine protein dipstick             1+        qualitative 2026-10-18 09:05 IST
    Urine protein-to-creatinine ratio  0.34      mg/mg       2026-10-18 09:05 IST
    """
    fields, _ = ai_extractor._deterministic_extract(sample_text, pages_data=[])
    upcr_field = next((f for f in fields if f["field_name"] == "protein_creatinine_ratio"), None)
    assert upcr_field is not None, "protein_creatinine_ratio must be extracted"
    assert upcr_field["extracted_value"] == "0.34"
    assert upcr_field["unit"] == "mg/mg"
    assert upcr_field["validation_status"] == "ALERT_ELEVATED"  # >= 0.3 is elevated


# =========================================================================
# PT-003 REGRESSION TESTS: Context-Aware Glucose & Section Segmentation
# =========================================================================

def test_pt003_inverted_section_glucose_extraction():
    """
    PT-003: Inverted layout where Historical Observations appear BEFORE Current Laboratory Results.
    Ensures reading-order assumption is completely eliminated:
    - Current fasting glucose must resolve to 92 mg/dL.
    - Historical glucose must resolve to 88 mg/dL as historical_fasting_glucose.
    """
    inverted_report = """
    PRENATAL VISIT REPORT
    Patient: Jane Doe | MRN: 987654

    1. Prior Historical Observations
    Timestamp: 2026-09-20 07:30 IST
    Fasting blood glucose: 88 mg/dL
    Blood pressure: 118/74 mmHg

    2. Current Visit & Laboratory Results
    Collection Timestamp: 2026-10-18 07:40 IST
    Fasting plasma glucose: 92 mg/dL
    OGTT 1-hour glucose: 178 mg/dL
    Blood pressure: 134/86 mmHg
    """
    fields, _ = ai_extractor._deterministic_extract(inverted_report, pages_data=[])
    
    current_fbg = next((f for f in fields if f["field_name"] == "fasting_glucose"), None)
    hist_fbg = next((f for f in fields if f["field_name"] == "historical_fasting_glucose"), None)
    
    assert current_fbg is not None, "Current fasting_glucose must be extracted"
    assert current_fbg["extracted_value"] == "92", f"Expected current 92, got {current_fbg['extracted_value']}"
    assert current_fbg["validation_status"] == "VALID"
    assert "2026-10-18" in current_fbg.get("source_text", "")
    
    assert hist_fbg is not None, "Historical fasting glucose must be captured"
    assert hist_fbg["extracted_value"] == "88", f"Expected historical 88, got {hist_fbg['extracted_value']}"
    assert hist_fbg["validation_status"] == "HISTORICAL_RECORD"


def test_pt003_chronological_disambiguation_same_section():
    """
    PT-003: When multiple glucose values exist in the current section with explicit dates,
    the later chronological date is selected as current, and older is captured as historical.
    """
    chronological_report = """
    Laboratory Flowsheet
    Test: Fasting Blood Sugar
    Date: 2026-10-05 08:00 IST - Fasting Blood Sugar: 90 mg/dL
    Date: 2026-10-19 07:45 IST - Fasting Blood Sugar: 94 mg/dL
    """
    fields, _ = ai_extractor._deterministic_extract(chronological_report, pages_data=[])
    current_fbg = next((f for f in fields if f["field_name"] == "fasting_glucose"), None)
    assert current_fbg is not None
    assert current_fbg["extracted_value"] == "94", f"Expected latest value 94, got {current_fbg['extracted_value']}"


def test_pt003_conflicting_ambiguous_glucose_requires_review():
    """
    PT-003: Conflicting current glucose readings without timestamps must be flagged as
    AMBIGUOUS_REQUIRES_CLINICIAN_REVIEW with lowered confidence to safeguard clinical integrity.
    """
    ambiguous_report = """
    Current Visit Lab Panel
    Fasting blood glucose: 92 mg/dL
    Fasting blood glucose: 108 mg/dL
    """
    fields, _ = ai_extractor._deterministic_extract(ambiguous_report, pages_data=[])
    fbg_field = next((f for f in fields if f["field_name"] == "fasting_glucose"), None)
    assert fbg_field is not None
    assert fbg_field["validation_status"] == "AMBIGUOUS_REQUIRES_CLINICIAN_REVIEW"
    assert fbg_field["confidence"] <= 0.65
    assert "conflicting" in fbg_field["source_text"].lower() or "requires clinician" in fbg_field["source_text"].lower()


def test_pt003_format_variations():
    """
    PT-003: Verifies format variations: 'FBG 92 mg/dL', 'Fasting Blood Sugar: 92' (missing unit),
    and multiline layouts.
    """
    variations = [
        ("Current Labs:\nFBG: 92 mg/dL", "92", "mg/dL"),
        ("Current Visit:\nFasting Blood Sugar\n92", "92", "mg/dL"),
        ("Current Results:\nFasting Plasma Glucose 92 mg/dL", "92", "mg/dL")
    ]
    for text_sample, expected_val, expected_unit in variations:
        fields, _ = ai_extractor._deterministic_extract(text_sample, pages_data=[])
        fbg = next((f for f in fields if f["field_name"] == "fasting_glucose"), None)
        assert fbg is not None, f"Failed for {text_sample!r}"
        assert fbg["extracted_value"] == expected_val, f"Expected {expected_val}, got {fbg['extracted_value']}"
        assert fbg["unit"] == expected_unit


def test_pt003_location_snippet_mapping_multipage():
    """
    PT-003: Verifies that snippet location resolution accurately attributes
    measurements across multiple pages to their correct page number and bounding box.
    """
    pages_data = [
        {
            "page": 1,
            "blocks": [
                {"text": "Patient: Sarah Connor\nAge: 32\nObstetric Profile", "bbox": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.1}},
                {"text": "Gestational age at visit: 30 weeks + 2 days", "bbox": {"x": 0.1, "y": 0.3, "width": 0.8, "height": 0.05}}
            ]
        },
        {
            "page": 2,
            "blocks": [
                {"text": "Laboratory Findings:\nFasting plasma glucose: 92 mg/dL", "bbox": {"x": 0.1, "y": 0.25, "width": 0.7, "height": 0.08}},
                {"text": "Serum creatinine: 0.8 mg/dL", "bbox": {"x": 0.1, "y": 0.4, "width": 0.7, "height": 0.05}}
            ]
        }
    ]
    page_no, bbox = ai_extractor._find_snippet_location("Fasting plasma glucose: 92 mg/dL", pages_data)
    assert page_no == 2, f"Expected Page 2 for glucose block, got Page {page_no}"
    assert bbox["y"] == 0.25
    assert bbox["width"] == 0.7


# =========================================================================
# PT-008 REGRESSION TESTS: Timeout Alignment, Idempotency & Fallback
# =========================================================================

def test_pt008_timeout_settings_and_diagnostics(client):
    """
    PT-008: Verifies backend configuration loads 180.0s timeout and
    diagnostics endpoint accurately exposes this timeout across tiers.
    """
    from app.core.config import settings
    assert settings.OLLAMA_TIMEOUT_SECONDS == 180.0, f"Expected 180.0s, got {settings.OLLAMA_TIMEOUT_SECONDS}"

    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    resp = client.get("/api/v1/system/diagnostics", headers=headers)
    assert resp.status_code == 200
    diag = resp.json()
    assert diag["ai_provider"]["ollama_timeout_seconds"] == 180.0, f"Expected diagnostics 180.0s, got {diag['ai_provider'].get('ollama_timeout_seconds')}"


def test_pt008_document_upload_idempotency_client_retry(client, db_session):
    """
    PT-008: Verifies upload idempotency: when a client retries uploading the exact same document
    (e.g., following a network timeout), the server detects the existing document by hash
    and returns 200 without creating duplicate documents or fields.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    file_content = b"Fasting plasma glucose: 92 mg/dL\nBlood pressure: 130/80 mmHg\nProteinuria: negative"
    files = {"file": ("antenatal_retry_test.txt", file_content, "text/plain")}
    data = {"patient_id": "patient-1-id", "category": "Antenatal visit summary"}

    # First upload
    resp1 = client.post("/api/v1/documents/upload", headers=headers, files=files, data=data)
    assert resp1.status_code == 200
    doc1 = resp1.json()
    doc1_id = doc1["id"]

    # Second upload with same bytes
    files2 = {"file": ("antenatal_retry_test.txt", file_content, "text/plain")}
    resp2 = client.post("/api/v1/documents/upload", headers=headers, files=files2, data=data)
    assert resp2.status_code == 200
    doc2 = resp2.json()
    assert doc2["id"] == doc1_id, "Retry must return existing document ID without creating duplicate"

    # Confirm only one document exists in DB for this hash
    matching_docs = db_session.query(MedicalDocument).filter(
        MedicalDocument.patient_id == "patient-1-id",
        MedicalDocument.filename == "antenatal_retry_test.txt"
    ).all()
    assert len(matching_docs) == 1, f"Expected exactly 1 document record, found {len(matching_docs)}"


@pytest.mark.anyio
async def test_pt008_ollama_timeout_safe_fallback():
    """
    PT-008: Verifies that when Ollama API times out, the extractor safely catches the
    timeout exception, falls back to deterministic extraction, and marks ai_provider as fallback.
    """
    import unittest.mock as mock
    import httpx

    sample_text = "Fasting plasma glucose: 92 mg/dL\nBlood Pressure: 130/80 mmHg"

    with mock.patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Ollama timed out after 180s")):
        res = await ai_extractor.extract_and_summarize(sample_text, pages_data=[])
        assert "fallback" in res.provider_name.lower() or "deterministic" in res.provider_name.lower()
        assert len(res.extracted_fields) >= 2
        fbg = next((f for f in res.extracted_fields if f["field_name"] == "fasting_glucose"), None)
        assert fbg is not None
        assert fbg["extracted_value"] == "92"


def test_pt008_observation_timestamp_preservation(client, db_session):
    """
    PT-008: Verifies that clinical observations created from extracted fields preserve
    the explicit collection timestamp from the report instead of overwriting with current time.
    """
    token_clinician = create_access_token({"sub": "test-clinician-1", "email": "clinician.test@pregtwin.org", "role": "clinician"})
    headers = {"Authorization": f"Bearer {token_clinician}"}

    doc_id = "test-doc-timestamp"
    doc = MedicalDocument(
        id=doc_id,
        patient_id="patient-1-id",
        filename="timestamp_test.pdf",
        file_path="mock/timestamp_test.pdf",
        file_hash="dummy_hash_timestamp",
        file_size_bytes=1024,
        mime_type="application/pdf",
        category="Antenatal visit summary",
        report_date="2026-10-18",
        source_institution="Obstetric Clinic",
        processing_status="EXTRACTED"
    )
    field_id = "field-ts-001"
    field = ExtractedField(
        id=field_id,
        document_id=doc_id,
        patient_id="patient-1-id",
        field_name="fasting_glucose",
        category="laboratory",
        extracted_value="92",
        unit="mg/dL",
        source_text="Fasting plasma glucose 92 mg/dL 2026-10-18 07:40 IST",
        confidence=0.95,
        review_status="UNREVIEWED"
    )
    db_session.add(doc)
    db_session.add(field)
    db_session.commit()

    resp = client.post(f"/api/v1/documents/{doc_id}/accept-all", headers=headers)
    assert resp.status_code == 200

    obs = db_session.query(ClinicalObservation).filter(
        ClinicalObservation.source_document_id == doc_id,
        ClinicalObservation.test_name == "fasting_glucose"
    ).first()
    assert obs is not None
    assert obs.measurement_timestamp.year == 2026
    assert obs.measurement_timestamp.month == 10
    assert obs.measurement_timestamp.day == 18

