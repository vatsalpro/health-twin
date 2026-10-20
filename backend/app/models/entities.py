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
    source_extracted_field_id = Column(String(36), nullable=True)
    
    observation_type = Column(String(50), nullable=False) # blood_pressure, laboratory, urine_protein, wearable
    test_name = Column(String(100), nullable=False) # Systolic BP, Diastolic BP, Platelets, AST, ALT, Proteinuria
    value_numeric = Column(Float, nullable=True)
    value_text = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)
    is_abnormal = Column(Boolean, default=False)
    
    measurement_timestamp = Column(DateTime(timezone=True), nullable=False)
    gestational_age_weeks = Column(Float, nullable=False)
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
    gestational_age_weeks = Column(Float, nullable=False)
    
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
    gestational_age_weeks = Column(Float, nullable=False)
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
