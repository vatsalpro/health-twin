from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str
    full_name: str
    patient_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "patient"

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    patient_id: Optional[str] = None

# --- Patient & Pregnancy Episode Schemas ---
class PregnancyEpisodeSchema(BaseModel):
    id: str
    patient_id: str
    conception_date: str
    estimated_due_date: str
    current_gestational_age_weeks: float
    is_active: bool
    outcome_preeclampsia_diagnosed: bool
    outcome_diagnosis_date: Optional[str] = None
    outcome_diagnosis_notes: Optional[str] = None

class PatientProfileSchema(BaseModel):
    id: str
    user_id: str
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: str
    maternal_age: int
    bmi: Optional[float] = None
    gravidity: int
    parity: int
    chronic_hypertension: bool
    pregestational_diabetes: bool
    prior_preeclampsia: bool
    renal_disease: bool
    autoimmune_disease: bool
    multiple_gestation: bool
    is_synthetic: bool
    created_at: datetime
    episodes: List[PregnancyEpisodeSchema] = []

# --- Document & Structured Extraction Schemas ---
class BoundingBox(BaseModel):
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0

class ExtractedFieldSchema(BaseModel):
    id: str
    document_id: str
    field_name: str
    category: str
    extracted_value: str
    unit: Optional[str] = None
    source_text: Optional[str] = None
    source_page: int = 1
    bounding_box: Optional[BoundingBox] = None
    confidence: float = 1.0
    extraction_method: str
    validation_status: str
    review_status: str
    clinician_correction: Optional[str] = None
    clinician_notes: Optional[str] = None

class ReportSummarySchema(BaseModel):
    id: str
    document_id: str
    factual_summary: str
    key_findings: str
    changes_vs_prior: Optional[str] = None
    conflicting_info: Optional[str] = None
    missing_info: Optional[str] = None
    uncertainties: Optional[str] = None
    clinician_review_prompts: Optional[str] = None
    provider_metadata: Optional[str] = None

class MedicalDocumentResponse(BaseModel):
    id: str
    patient_id: str
    episode_id: Optional[str] = None
    filename: str
    file_size_bytes: int
    mime_type: str
    category: str
    report_date: Optional[str] = None
    source_institution: Optional[str] = None
    processing_status: str
    ocr_engine: Optional[str] = None
    ai_provider: Optional[str] = None
    page_count: int
    created_at: datetime
    extracted_fields: List[ExtractedFieldSchema] = []
    summary: Optional[ReportSummarySchema] = None

class FieldReviewRequest(BaseModel):
    decision: str = Field(..., description="'ACCEPT', 'REJECT', or 'MODIFY'")
    correction_value: Optional[str] = None
    clinician_notes: Optional[str] = None

# --- Clinical Observation Schemas ---
class ClinicalObservationSchema(BaseModel):
    id: str
    patient_id: str
    observation_type: str
    test_name: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool
    measurement_timestamp: datetime
    gestational_age_weeks: float
    source_type: str
    review_status: str
    source_document_id: Optional[str] = None

class ObservationCreateRequest(BaseModel):
    observation_type: str
    test_name: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    measurement_timestamp: Optional[str] = None
    gestational_age_weeks: Optional[float] = None
    source_type: str = "patient_reported"

# --- Maternal Digital Twin Schemas ---
class MaternalTwinStateSchema(BaseModel):
    id: str
    patient_id: str
    version: int
    timestamp: datetime
    gestational_age_weeks: float
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    map_pressure: Optional[float] = None
    pulse_pressure: Optional[float] = None
    proteinuria_dipstick: Optional[str] = None
    protein_creatinine_ratio: Optional[float] = None
    platelets: Optional[float] = None
    ast: Optional[float] = None
    alt: Optional[float] = None
    serum_creatinine: Optional[float] = None
    data_freshness_status: str
    missing_indicators: List[str] = []
    telemetry_summary: Dict[str, Any] = {}

# --- Risk Prediction & Research Model Schemas ---
class FeatureContribution(BaseModel):
    feature_name: str
    feature_label: str
    value: Any
    contribution: float  # log-odds impact or SHAP-like directional value
    direction: str       # "increases_risk", "decreases_risk", "neutral"

class RiskPredictionSchema(BaseModel):
    id: str
    patient_id: str
    model_version: str
    prediction_timestamp: datetime
    gestational_age_weeks: float
    prediction_horizon_days: int
    risk_score: Optional[float] = None  # None if insufficient data
    risk_category: str
    confidence_interval_lower: Optional[float] = None
    confidence_interval_upper: Optional[float] = None
    calibration_status: str
    feature_contributions: List[FeatureContribution] = []
    is_insufficient_data: bool = False
    insufficient_data_reason: Optional[str] = None
    model_limitations: str

# --- Simulation Lab Schemas ---
class SimulationRequest(BaseModel):
    baseline_prediction_id: Optional[str] = None
    gestational_age_weeks: float
    sbp: float
    dbp: float
    proteinuria_dipstick: str
    platelets: float
    ast: float
    alt: float
    serum_creatinine: float

class SimulationResponse(BaseModel):
    scenario_label: str = "Hypothetical Illustrative Simulation"
    is_causal_treatment_claim: bool = False
    warning: str = "This is a counterfactual what-if simulation for research and clinical exploration. Changing input values does NOT infer causal clinical outcomes."
    baseline_risk_score: Optional[float] = None
    simulated_risk_score: float
    simulated_risk_category: str
    delta_risk_score: float
    feature_contributions: List[FeatureContribution]
    model_version: str

# --- Audit Event Schemas ---
class AuditEventSchema(BaseModel):
    id: str
    user_id: Optional[str]
    user_email: Optional[str]
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
    details: Dict[str, Any] = {}
    ip_address: Optional[str]
    timestamp: datetime
