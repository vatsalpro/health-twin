import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="patient")  # patient, clinician, admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False)
    audit_events = relationship("AuditEvent", back_populates="user")

class PatientProfile(Base):
    __tablename__ = "patient_profiles"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    mrn = Column(String(64), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(20), nullable=False)
    maternal_age = Column(Integer, nullable=False)
    bmi = Column(Float, nullable=True)
    gravidity = Column(Integer, default=1)
    parity = Column(Integer, default=0)
    
    # Clinical history factors for preeclampsia research
    chronic_hypertension = Column(Boolean, default=False)
    pregestational_diabetes = Column(Boolean, default=False)
    prior_preeclampsia = Column(Boolean, default=False)
    renal_disease = Column(Boolean, default=False)
    autoimmune_disease = Column(Boolean, default=False)
    multiple_gestation = Column(Boolean, default=False)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    user = relationship("User", back_populates="patient_profile")
    episodes = relationship("PregnancyEpisode", back_populates="patient", cascade="all, delete-orphan")
    documents = relationship("MedicalDocument", back_populates="patient", cascade="all, delete-orphan")
    observations = relationship("ClinicalObservation", back_populates="patient", cascade="all, delete-orphan")
    twin_states = relationship("MaternalTwinState", back_populates="patient", cascade="all, delete-orphan")
    predictions = relationship("RiskPrediction", back_populates="patient", cascade="all, delete-orphan")
    scenarios = relationship("SimulationScenario", back_populates="patient", cascade="all, delete-orphan")
    devices = relationship("DeviceConnection", back_populates="patient", cascade="all, delete-orphan")
    measurements = relationship("DeviceMeasurement", back_populates="patient", cascade="all, delete-orphan")
    camera_sessions = relationship("CameraResearchSession", back_populates="patient", cascade="all, delete-orphan")

class PregnancyEpisode(Base):
    __tablename__ = "pregnancy_episodes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    conception_date = Column(String(20), nullable=False)
    estimated_due_date = Column(String(20), nullable=False)
    current_gestational_age_weeks = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    
    # Ground-truth research outcome definition (clinician verified)
    outcome_preeclampsia_diagnosed = Column(Boolean, default=False)
    outcome_diagnosis_date = Column(String(20), nullable=True)
    outcome_diagnosis_notes = Column(Text, nullable=True)
    outcome_gestational_age_at_onset = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    patient = relationship("PatientProfile", back_populates="episodes")
    documents = relationship("MedicalDocument", back_populates="episode")
    observations = relationship("ClinicalObservation", back_populates="episode")

class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    episode_id = Column(String(36), ForeignKey("pregnancy_episodes.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    category = Column(String(100), default="Antenatal visit summary")
    report_date = Column(String(20), nullable=True)
    source_institution = Column(String(200), nullable=True)
    
    # Persistent Processing states: PENDING, PROCESSING, EXTRACTED, REVIEW_PENDING, COMPLETED, FAILED
    processing_status = Column(String(50), default="PENDING")
    ocr_engine = Column(String(50), nullable=True)
    ai_provider = Column(String(50), nullable=True)
    extracted_text = Column(Text, nullable=True)
    page_count = Column(Integer, default=1)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    
    patient = relationship("PatientProfile", back_populates="documents")
    episode = relationship("PregnancyEpisode", back_populates="documents")
    extracted_fields = relationship("ExtractedField", back_populates="document", cascade="all, delete-orphan")
    summary = relationship("ReportSummary", back_populates="document", uselist=False, cascade="all, delete-orphan")

class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(100), nullable=False) # e.g. systolic_bp, diastolic_bp, proteinuria, platelet_count
    category = Column(String(50), nullable=False) # blood_pressure, laboratory, maternal_profile, urine_protein
    extracted_value = Column(String(200), nullable=False)
    unit = Column(String(50), nullable=True)
    source_text = Column(Text, nullable=True)
    source_page = Column(Integer, default=1)
    bounding_box_json = Column(Text, nullable=True) # {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05}
    confidence = Column(Float, default=1.0) # 0.0 to 1.0
    extraction_method = Column(String(50), default="pymupdf_rule") # pymupdf_rule, tesseract_ocr, llm_structured
    
    # Review workflow states: UNREVIEWED, ACCEPTED, REJECTED, MODIFIED
    validation_status = Column(String(50), default="VALID")
    review_status = Column(String(50), default="UNREVIEWED")
    clinician_correction = Column(String(200), nullable=True)
    clinician_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    document = relationship("MedicalDocument", back_populates="extracted_fields")

class ReportSummary(Base):
    __tablename__ = "report_summaries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="CASCADE"), nullable=False, unique=True)
    factual_summary = Column(Text, nullable=False)
    key_findings = Column(Text, nullable=False)
    changes_vs_prior = Column(Text, nullable=True)
    conflicting_info = Column(Text, nullable=True)
    missing_info = Column(Text, nullable=True)
    uncertainties = Column(Text, nullable=True)
    clinician_review_prompts = Column(Text, nullable=True)
    provider_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    document = relationship("MedicalDocument", back_populates="summary")

class ClinicalObservation(Base):
    __tablename__ = "clinical_observations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    episode_id = Column(String(36), ForeignKey("pregnancy_episodes.id", ondelete="CASCADE"), nullable=True)
    source_document_id = Column(String(36), ForeignKey("medical_documents.id", ondelete="SET NULL"), nullable=True)
    source_extracted_field_id = Column(String(36), nullable=True, index=True)
    
    observation_type = Column(String(50), nullable=False) # blood_pressure, laboratory, urine_protein, wearable
    test_name = Column(String(100), nullable=False) # Systolic BP, Diastolic BP, Platelets, AST, ALT, Proteinuria
    value_numeric = Column(Float, nullable=True)
    value_text = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)
    is_abnormal = Column(Boolean, default=False)
    
    measurement_timestamp = Column(DateTime(timezone=True), nullable=False)
    gestational_age_weeks = Column(Float, nullable=True) # Nullable: only populated if source evidence or valid dating exists
    source_type = Column(String(50), default="accepted_document") # accepted_document, patient_reported, wearable_stream, synthetic_stream
    review_status = Column(String(50), default="ACCEPTED")
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    patient = relationship("PatientProfile", back_populates="observations")
    episode = relationship("PregnancyEpisode", back_populates="observations")

class MaternalTwinState(Base):
    __tablename__ = "maternal_twin_states"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    episode_id = Column(String(36), ForeignKey("pregnancy_episodes.id", ondelete="CASCADE"), nullable=True)
    version = Column(Integer, default=1)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    gestational_age_weeks = Column(Float, nullable=True)
    
    # Physiological twin attributes
    sbp = Column(Float, nullable=True)
    dbp = Column(Float, nullable=True)
    map_pressure = Column(Float, nullable=True) # Mean Arterial Pressure = (2*DBP + SBP)/3
    pulse_pressure = Column(Float, nullable=True) # SBP - DBP
    proteinuria_dipstick = Column(String(50), nullable=True) # 0, Trace, 1+, 2+, 3+
    protein_creatinine_ratio = Column(Float, nullable=True) # mg/mg
    platelets = Column(Float, nullable=True) # 10^3/uL
    ast = Column(Float, nullable=True) # U/L
    alt = Column(Float, nullable=True) # U/L
    serum_creatinine = Column(Float, nullable=True) # mg/dL
    
    # Freshness & uncertainty markers
    data_freshness_status = Column(String(50), default="FRESH") # FRESH, STALE, INCOMPLETE
    missing_indicators_json = Column(Text, nullable=True)
    telemetry_summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    patient = relationship("PatientProfile", back_populates="twin_states")

class RiskPrediction(Base):
    __tablename__ = "risk_predictions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    episode_id = Column(String(36), ForeignKey("pregnancy_episodes.id", ondelete="CASCADE"), nullable=True)
    model_version = Column(String(100), nullable=False)
    prediction_timestamp = Column(DateTime(timezone=True), nullable=False)
    gestational_age_weeks = Column(Float, nullable=True)
    prediction_horizon_days = Column(Integer, default=14)
    
    # Quantified outputs
    risk_score = Column(Float, nullable=True) # 0.0 - 1.0 (calibrated risk probability)
    risk_category = Column(String(50), nullable=True) # LOW, MODERATE, HIGH, INSUFFICIENT_DATA
    confidence_interval_lower = Column(Float, nullable=True)
    confidence_interval_upper = Column(Float, nullable=True)
    calibration_status = Column(String(100), default="calibrated_platt_scaling")
    
    # Interpretability and Evidence
    feature_contributions_json = Column(Text, nullable=True) # {"sbp": +0.18, "prior_pe": +0.22, ...}
    feature_values_json = Column(Text, nullable=True)
    is_insufficient_data = Column(Boolean, default=False)
    insufficient_data_reason = Column(Text, nullable=True)
    model_limitations = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    
    patient = relationship("PatientProfile", back_populates="predictions")

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False) # LOGIN, DOCUMENT_UPLOAD, FIELD_REVIEW_ACCEPT, FIELD_REVIEW_REJECT, SCENARIO_SIMULATION
    target_type = Column(String(100), nullable=True) # MedicalDocument, ExtractedField, RiskPrediction
    target_id = Column(String(64), nullable=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    
    user = relationship("User", back_populates="audit_events")

class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    category = Column(String(50), default="cardiovascular")  # cardiovascular, preeclampsia_risk, gestational_timeline, metabolic_health, sleep_stress, sensor_reliability, monitoring_schedule, postpartum
    description = Column(Text, nullable=True)
    parameters_json = Column(Text, nullable=False)
    results_json = Column(Text, nullable=False)
    is_baseline = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    patient = relationship("PatientProfile", back_populates="scenarios")
    creator = relationship("User")

class DeviceConnection(Base):
    __tablename__ = "device_connections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    device_type = Column(String(50), nullable=False)  # blood_pressure_cuff, pulse_oximeter, glucose_meter, smart_ring, fitness_band, thermometer, weight_scale
    manufacturer = Column(String(100), nullable=False)  # Omron, Masimo, Dexcom, Oura, Garmin, Withings
    model_name = Column(String(100), nullable=False)
    serial_number = Column(String(100), nullable=True)
    connection_protocol = Column(String(50), default="mock")  # mock, bluetooth_ble, vendor_api, health_platform
    connection_status = Column(String(50), default="disconnected")  # connected, disconnected, syncing, error, unconfigured
    battery_percentage = Column(Integer, nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    patient = relationship("PatientProfile", back_populates="devices")
    measurements = relationship("DeviceMeasurement", back_populates="device", cascade="all, delete-orphan")

class DeviceMeasurement(Base):
    __tablename__ = "device_measurements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    device_connection_id = Column(String(36), ForeignKey("device_connections.id", ondelete="SET NULL"), nullable=True)
    measurement_type = Column(String(50), nullable=False)  # blood_pressure, pulse_oximetry, blood_glucose, wearable_vitals, temperature, weight, symptom_stress
    value_numeric = Column(Float, nullable=True)
    value_secondary = Column(Float, nullable=True)
    value_text = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=False)  # mmHg, %, mg/dL, mmol/L, bpm, ms, degC, kg, score
    measurement_timestamp = Column(DateTime(timezone=True), nullable=False)
    recording_timestamp = Column(DateTime(timezone=True), default=utc_now)
    timezone = Column(String(50), default="UTC")
    source_type = Column(String(50), default="manual")  # manual, mock_device, bluetooth_ble, vendor_api, health_platform, simulation
    device_manufacturer = Column(String(100), nullable=True)
    device_model = Column(String(100), nullable=True)
    context_data_json = Column(Text, nullable=True)  # {"body_position": "sitting", "meal_context": "fasting", ...}
    quality_status = Column(String(50), default="VALID")  # VALID, SUSPECT, NOISY, DEGRADED, OUT_OF_BOUNDS
    confidence = Column(Float, default=1.0)
    is_hypothetical = Column(Boolean, default=False)
    is_reviewed = Column(Boolean, default=False)
    idempotency_key = Column(String(128), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    patient = relationship("PatientProfile", back_populates="measurements")
    device = relationship("DeviceConnection", back_populates="measurements")

class CameraResearchSession(Base):
    __tablename__ = "camera_research_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(36), ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    session_timestamp = Column(DateTime(timezone=True), default=utc_now)
    duration_seconds = Column(Integer, nullable=False)

    # Environmental & Quality Telemetry
    lighting_condition = Column(String(50), default="OPTIMAL")
    motion_stability = Column(String(50), default="STABLE")
    signal_quality_score = Column(Float, nullable=False)
    face_tracking_ratio = Column(Float, default=1.0)

    # Physiological rPPG signals
    estimated_pulse_bpm = Column(Float, nullable=True)
    hrv_rmssd_ms = Column(Float, nullable=True)
    hrv_status = Column(String(100), default="INSUFFICIENT_DURATION")
    rppg_algorithm = Column(String(50), default="CHROM_deHaan_2013")
    rppg_snr_db = Column(Float, nullable=True)

    # Observable Facial Action & Movement Indicators (JSON string)
    facial_indicators_json = Column(Text, nullable=True)

    # Stress Estimation Pipeline State
    stress_pipeline_status = Column(String(100), default="UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER")
    stress_feature_vector_json = Column(Text, nullable=True)

    # User-Reported Research Reference (Subjective 1-10)
    user_reported_stress = Column(Float, nullable=True)
    user_notes = Column(Text, nullable=True)

    # Consent & Provenance
    consent_confirmed = Column(Boolean, default=True)
    raw_video_stored = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    patient = relationship("PatientProfile", back_populates="camera_sessions")
