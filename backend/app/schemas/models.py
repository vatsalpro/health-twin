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
    gestational_age_weeks: Optional[float] = None
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
    gestational_age_weeks: Optional[float] = None
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
    gestational_age_weeks: Optional[float] = None
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
    gestational_age_weeks: float = Field(..., ge=20.0, le=45.0, description="Gestational age in weeks (20.0 to 45.0)")
    sbp: float = Field(..., ge=70.0, le=240.0, description="Systolic blood pressure (70 to 240 mmHg)")
    dbp: float = Field(..., ge=40.0, le=160.0, description="Diastolic blood pressure (40 to 160 mmHg)")
    proteinuria_dipstick: str = Field(..., description="Proteinuria dipstick grade")
    platelets: float = Field(..., ge=10.0, le=800.0, description="Platelets (10 to 800 x10^3/uL)")
    ast: float = Field(..., ge=5.0, le=500.0, description="AST (5 to 500 U/L)")
    alt: float = Field(..., ge=5.0, le=500.0, description="ALT (5 to 500 U/L)")
    serum_creatinine: float = Field(..., ge=0.1, le=15.0, description="Serum Creatinine (0.1 to 15.0 mg/dL)")

class SimulationResponse(BaseModel):
    scenario_label: str = "Hypothetical Illustrative Simulation"
    is_causal_treatment_claim: bool = False
    warning: str = "This is a counterfactual what-if simulation for research and clinical exploration. Changing input values does NOT infer causal clinical outcomes."
    baseline_risk_score: Optional[float] = None
    simulated_risk_score: float
    simulated_risk_category: str
    delta_risk_score: float
    feature_contributions: List[FeatureContribution] = []
    model_version: str = "v1.4.2-longitudinal-preeclampsia"
    category: Optional[str] = "preeclampsia_risk"
    detailed_results: Optional[Dict[str, Any]] = None
    uncertainty_interval: Optional[Dict[str, float]] = None

class MultiCategorySimulationRequest(BaseModel):
    category: str = Field("preeclampsia_risk", description="Simulation category: cardiovascular, preeclampsia_risk, gestational_timeline, metabolic_health, sleep_stress, sensor_reliability, monitoring_schedule, postpartum")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters specific to category")
    baseline_prediction_id: Optional[str] = None

class ScenarioSaveRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category: str = Field("cardiovascular")
    description: Optional[str] = None
    parameters: Dict[str, Any]
    results: Dict[str, Any]

class ScenarioUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None

class ScenarioResponse(BaseModel):
    id: str
    patient_id: str
    name: str
    category: str
    description: Optional[str] = None
    parameters: Dict[str, Any]
    results: Dict[str, Any]
    is_baseline: bool = False
    created_at: datetime
    updated_at: datetime

# --- IoT & Measurement Schemas ---
class DeviceConnectionSchema(BaseModel):
    id: str
    patient_id: str
    device_type: str
    manufacturer: str
    model_name: str
    serial_number: Optional[str] = None
    connection_protocol: str
    connection_status: str
    battery_percentage: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

class DeviceMeasurementCreateRequest(BaseModel):
    measurement_type: str = Field(..., description="blood_pressure, pulse_oximetry, blood_glucose, wearable_vitals, temperature, weight, symptom_stress")
    value_numeric: Optional[float] = None
    value_secondary: Optional[float] = None
    value_text: Optional[str] = None
    unit: str
    measurement_timestamp: Optional[str] = None
    source_type: str = "manual"
    device_manufacturer: Optional[str] = None
    device_model: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None
    quality_status: str = "VALID"
    confidence: float = 1.0
    idempotency_key: Optional[str] = None

class DeviceMeasurementSchema(BaseModel):
    id: str
    patient_id: str
    device_connection_id: Optional[str] = None
    measurement_type: str
    value_numeric: Optional[float] = None
    value_secondary: Optional[float] = None
    value_text: Optional[str] = None
    unit: str
    measurement_timestamp: datetime
    recording_timestamp: datetime
    source_type: str
    device_manufacturer: Optional[str] = None
    device_model: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None
    quality_status: str
    confidence: float
    is_hypothetical: bool
    is_reviewed: bool
    created_at: datetime

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

# --- Medication Management Schemas ---
class MedicationOrderCreate(BaseModel):
    patient_id: str
    medication_name: str = Field(..., min_length=2, max_length=150)
    strength: Optional[str] = None
    formulation: Optional[str] = None
    prescribed_dose: str = Field(..., min_length=1)
    route: str = Field(default="oral")
    frequency: str = Field(..., min_length=2)
    timing_slots: Optional[List[str]] = Field(default=["08:00", "20:00"])
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: Optional[str] = None
    clinician_instructions: str = Field(..., min_length=5)
    warnings_precautions: Optional[str] = None

class MedicationOrderResponse(BaseModel):
    id: str
    patient_id: str
    prescribing_clinician_id: str
    prescribing_clinician_name: Optional[str] = None
    medication_name: str
    strength: Optional[str] = None
    formulation: Optional[str] = None
    prescribed_dose: str
    route: str
    frequency: str
    timing_slots: List[str] = []
    start_date: str
    end_date: Optional[str] = None
    clinician_instructions: str
    warnings_precautions: Optional[str] = None
    status: str
    version: int
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    discontinued_at: Optional[datetime] = None
    discontinued_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class MedicationDoseLogCreate(BaseModel):
    scheduled_time: Optional[str] = None
    status: str = Field(default="TAKEN", description="TAKEN, MISSED, SKIPPED")
    patient_notes: Optional[str] = None
    reported_side_effects: Optional[str] = None
    reported_side_effects_severity: Optional[str] = Field(default="MILD", description="MILD, MODERATE, SEVERE")

class MedicationDoseLogResponse(BaseModel):
    id: str
    order_id: str
    patient_id: str
    medication_name: Optional[str] = None
    scheduled_time: datetime
    logged_time: datetime
    status: str
    patient_notes: Optional[str] = None
    reported_side_effects: Optional[str] = None
    reported_side_effects_severity: Optional[str] = None
    created_at: datetime

# --- Doctor Availability & Appointment Schemas ---
class DoctorAvailabilityConfig(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: str = Field(default="09:00", description="HH:MM")
    end_time: str = Field(default="17:00", description="HH:MM")
    slot_duration_minutes: int = Field(default=30, ge=10, le=120)
    break_start: Optional[str] = Field(default="12:00")
    break_end: Optional[str] = Field(default="13:00")
    timezone: str = Field(default="UTC")
    is_active: bool = True
    max_daily_capacity: int = Field(default=12, ge=1, le=50)

class DoctorAvailabilityResponse(BaseModel):
    id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_minutes: int
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    timezone: str
    is_active: bool
    max_daily_capacity: int
    created_at: datetime

class TimeSlotResponse(BaseModel):
    doctor_id: str
    doctor_name: str
    start_time: datetime
    end_time: datetime
    formatted_time: str
    formatted_date: str
    is_available: bool

class AppointmentBookRequest(BaseModel):
    patient_id: str
    doctor_id: str
    start_time: datetime
    appointment_type: str = Field(default="in_person", description="in_person, telehealth, urgent_review")
    reason: str = Field(..., min_length=3)
    booking_channel: str = Field(default="ai_assistant")

class AppointmentRescheduleRequest(BaseModel):
    new_start_time: datetime
    reason: Optional[str] = None

class AppointmentCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=3)

class AppointmentResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    doctor_id: str
    doctor_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    appointment_type: str
    reason: str
    booking_channel: str
    cancellation_reason: Optional[str] = None
    created_at: datetime

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: str
    user_id: str
    patient_id: Optional[str] = None
    category: str
    title: str
    message: str
    priority: str
    link_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    delivery_status: str
    metadata: Dict[str, Any] = {}
    created_at: datetime

class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
    high_priority_count: int
    has_emergency: bool

# --- Emergency Event Schemas ---
class EmergencyEventResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    reported_by_user_id: str
    assigned_clinician_id: Optional[str] = None
    matched_rules: List[str] = []
    reported_symptoms: str
    severity_level: str
    status: str
    acknowledged_by_id: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    escalated_at: Optional[datetime] = None
    delivery_attempts: int
    created_at: datetime

class EmergencyAcknowledgeRequest(BaseModel):
    notes: Optional[str] = None

class EmergencyResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5)

# --- AI Assistant Chat Schemas ---
class AIChatRequest(BaseModel):
    patient_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    client_timezone: Optional[str] = Field(default="UTC")

class AIChatResponse(BaseModel):
    message_id: str
    assistant_reply: str
    intent_category: str
    is_emergency: bool = False
    emergency_event_id: Optional[str] = None
    emergency_instructions: Optional[str] = None
    mascot_expression: str = Field(default="caring", description="caring, attentive, alert")
    suggested_slots: List[TimeSlotResponse] = []
    action_taken: Optional[Dict[str, Any]] = None
    grounding_sources: List[str] = []
    created_at: datetime
