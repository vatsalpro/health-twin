const API_BASE = '/api/v1';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'patient' | 'clinician' | 'admin';
  is_active: boolean;
  patient_id?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  role: 'patient' | 'clinician' | 'admin';
  full_name: string;
  patient_id?: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  maternal_age: number;
  bmi?: number;
  gravidity: number;
  parity: number;
  chronic_hypertension: boolean;
  pregestational_diabetes: boolean;
  prior_preeclampsia: boolean;
  renal_disease: boolean;
  autoimmune_disease: boolean;
  multiple_gestation: boolean;
  is_synthetic: boolean;
  created_at: string;
  episodes: PregnancyEpisode[];
}

export interface PregnancyEpisode {
  id: string;
  patient_id: string;
  conception_date: string;
  estimated_due_date: string;
  current_gestational_age_weeks: number;
  is_active: boolean;
  outcome_preeclampsia_diagnosed: boolean;
  outcome_diagnosis_date?: string;
  outcome_diagnosis_notes?: string;
}

export interface ExtractedField {
  id: string;
  document_id: string;
  field_name: string;
  category: string;
  extracted_value: string;
  unit?: string;
  source_text?: string;
  source_page: number;
  bounding_box?: { x: number; y: number; width: number; height: number };
  confidence: number;
  extraction_method: string;
  validation_status: string;
  review_status: 'UNREVIEWED' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
  clinician_correction?: string;
  clinician_notes?: string;
}

export interface ReportSummary {
  id: string;
  document_id: string;
  factual_summary: string;
  key_findings: string;
  changes_vs_prior?: string;
  conflicting_info?: string;
  missing_info?: string;
  uncertainties?: string;
  clinician_review_prompts?: string;
  provider_metadata?: string;
}

export interface MedicalDocument {
  id: string;
  patient_id: string;
  patient_name?: string;
  patient_mrn?: string;
  episode_id?: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  category: string;
  report_date?: string;
  source_institution?: string;
  processing_status: 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'REVIEW_PENDING' | 'COMPLETED' | 'FAILED';
  ocr_engine?: string;
  ai_provider?: string;
  page_count: number;
  extracted_text?: string;
  created_at: string;
  extracted_fields: ExtractedField[];
  summary?: ReportSummary;
}

export interface ClinicalObservation {
  id: string;
  patient_id: string;
  observation_type: string;
  test_name: string;
  value_numeric?: number;
  value_text?: string;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  measurement_timestamp: string;
  gestational_age_weeks: number;
  source_type: string;
  review_status: string;
  source_document_id?: string;
}

export interface MaternalTwinState {
  id: string;
  patient_id: string;
  version: number;
  timestamp: string;
  gestational_age_weeks: number;
  sbp?: number;
  dbp?: number;
  map_pressure?: number;
  pulse_pressure?: number;
  proteinuria_dipstick?: string;
  protein_creatinine_ratio?: number;
  platelets?: number;
  ast?: number;
  alt?: number;
  serum_creatinine?: number;
  data_freshness_status: 'FRESH' | 'STALE' | 'INCOMPLETE';
  missing_indicators: string[];
  telemetry_summary: Record<string, any>;
}

export interface FeatureContribution {
  feature_name: string;
  feature_label: string;
  value: any;
  contribution: number;
  direction: 'increases_risk' | 'decreases_risk' | 'neutral';
}

export interface RiskPrediction {
  id: string;
  patient_id: string;
  model_version: string;
  prediction_timestamp: string;
  gestational_age_weeks: number;
  prediction_horizon_days: number;
  risk_score?: number;
  risk_category: 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
  confidence_interval_lower?: number;
  confidence_interval_upper?: number;
  calibration_status: string;
  feature_contributions: FeatureContribution[];
  is_insufficient_data: boolean;
  insufficient_data_reason?: string;
  model_limitations: string;
}

export interface SimulationResult {
  scenario_label: string;
  is_causal_treatment_claim: boolean;
  warning: string;
  baseline_risk_score?: number;
  simulated_risk_score: number;
  simulated_risk_category: string;
  delta_risk_score: number;
  feature_contributions: FeatureContribution[];
  model_version: string;
  category?: string;
  detailed_results?: Record<string, any>;
  uncertainty_interval?: { lower: number; upper: number };
}

export interface SimulationScenario {
  id: string;
  patient_id: string;
  name: string;
  category: string;
  description?: string;
  parameters: Record<string, any>;
  results: Record<string, any>;
  is_baseline: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceConnection {
  id: string;
  patient_id: string;
  device_type: string;
  manufacturer: string;
  model_name: string;
  serial_number?: string;
  connection_protocol: string;
  connection_status: 'connected' | 'disconnected' | 'syncing' | 'error';
  battery_percentage?: number;
  last_sync_at?: string;
  error_message?: string;
  created_at: string;
}

export interface DeviceMeasurement {
  id: string;
  patient_id: string;
  device_connection_id?: string;
  measurement_type: string;
  value_numeric?: number;
  value_secondary?: number;
  value_text?: string;
  unit: string;
  measurement_timestamp: string;
  recording_timestamp: string;
  source_type: string;
  device_manufacturer?: string;
  device_model?: string;
  context_data?: Record<string, any>;
  quality_status: string;
  confidence: number;
  is_hypothetical: boolean;
  is_reviewed: boolean;
  created_at: string;
}

export interface CameraResearchStatus {
  module: string;
  protocol_version: string;
  is_diagnostic_device: boolean;
  identity_recognition_performed: boolean;
  raw_video_storage_policy: string;
  principles: Record<string, string>;
  disclaimer: string;
}

export interface CameraResearchSessionRecord {
  id: string;
  patient_id: string;
  session_timestamp: string;
  duration_seconds: number;
  lighting_condition: string;
  motion_stability: string;
  signal_quality_score: number;
  face_tracking_ratio?: number;
  estimated_pulse_bpm?: number;
  hrv_rmssd_ms?: number;
  hrv_status?: string;
  rppg_algorithm?: string;
  rppg_snr_db?: number;
  facial_indicators?: Record<string, any>;
  stress_pipeline_status?: string;
  stress_feature_vector?: Record<string, any>;
  user_reported_stress?: number;
  user_notes?: string;
  consent_confirmed: boolean;
  created_at: string;
}

export interface TimelineEvent {
  type: string;
  id: string;
  timestamp: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface SystemDiagnostics {
  status: string;
  demo_mode: boolean;
  database: { type: string; url: string };
  ai_provider: {
    configured_provider: string;
    openai_api_key_set: boolean;
    openai_model?: string;
    ollama_base_url?: string;
    ollama_model?: string;
    ollama_reachable?: boolean;
    ollama_model_available?: boolean;
    ollama_latency_ms?: number;
    fallback_active: boolean;
    notice: string;
  };
  ocr_engine: {
    configured_engine: string;
    is_installed: boolean;
    notice: string;
  };
  preeclampsia_model: {
    version: string;
    default_horizon_days: number;
    calibration: string;
    target_outcome: string;
  };
}

// --- Medication Management Schemas ---
export interface MedicationOrder {
  id: string;
  patient_id: string;
  prescribed_by_id: string;
  approved_by_id?: string;
  status: 'DRAFT' | 'APPROVED' | 'DISCONTINUED' | 'SUPERSEDED';
  medication_name: string;
  strength?: string;
  formulation?: string;
  prescribed_dose: string;
  route: string;
  frequency: string;
  timing_slots: string[];
  start_date?: string;
  end_date?: string;
  clinician_instructions?: string;
  warnings_precautions?: string;
  version: number;
  supersedes_order_id?: string;
  created_at: string;
  approved_at?: string;
  prescriber_name?: string;
  approver_name?: string;
  recent_dose_logs?: MedicationDoseLog[];
}

export interface MedicationDoseLog {
  id: string;
  order_id: string;
  patient_id: string;
  scheduled_time: string;
  logged_time: string;
  status: 'TAKEN' | 'MISSED' | 'SKIPPED' | 'SIDE_EFFECT_REPORTED';
  patient_notes?: string;
  side_effect_severity?: string;
  side_effect_description?: string;
  created_at: string;
}

export interface MedicationSummary {
  patient_id: string;
  total_active_orders: number;
  total_doses_logged: number;
  adherence_rate_pct: number;
  consecutive_missed_doses: number;
  consecutive_missed_alert: boolean;
  recent_side_effects: any[];
  upcoming_doses: {
    order_id: string;
    medication_name: string;
    dose: string;
    route: string;
    scheduled_time: string;
    instructions?: string;
  }[];
}

export interface DrugMonograph {
  generic_name: string;
  drug_class: string;
  intended_use: string;
  pregnancy_safety_notes: string;
  common_side_effects: string[];
  serious_warning_signs: string[];
  missed_dose_guidance: string;
  clinical_reference: string;
}

// --- Appointment Scheduling Schemas ---
export interface DoctorSlot {
  doctor_id: string;
  doctor_name: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_type?: string;
  formatted_time?: string;
  formatted_date?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  start_time?: string;
  end_time?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | string;
  appointment_type: 'ROUTINE_PRENATAL' | 'URGENT_REVIEW' | 'TELEHEALTH' | 'POSTPARTUM_FOLLOWUP' | string;
  reason?: string;
  patient_notes?: string;
  clinician_notes?: string;
  booked_via?: string;
  booking_channel?: string;
  doctor_name?: string;
  patient_name?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  formatted_time?: string;
  formatted_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface DoctorScheduleDay {
  id?: string;
  doctor_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

// --- Notification Center Schemas ---
export interface AppNotification {
  id: string;
  user_id: string;
  patient_id?: string;
  title: string;
  message: string;
  category: 'MEDICATION_REMINDER' | 'MISSED_DOSE_ALERT' | 'APPOINTMENT_UPDATE' | 'EMERGENCY_ALERT' | 'CLINICIAN_MESSAGE' | 'SYSTEM_UPDATE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_EMERGENCY';
  action_url?: string;
  metadata_json?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationCount {
  unread_count: number;
  critical_unread: number;
}

// --- Emergency Workflow Schemas ---
export interface EmergencyEventRecord {
  id: string;
  patient_id: string;
  reported_by_id: string;
  severity: string;
  symptoms_summary: string;
  detected_rules: string[];
  trigger_message?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'ESCALATED_BACKUP' | 'RESOLVED';
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by_id?: string;
  resolution_notes?: string;
  patient_name?: string;
  mrn?: string;
  acknowledged_by_name?: string;
}

// --- AI Assistant Schemas ---
export interface AIChatRequest {
  patient_id: string;
  message: string;
  conversation_context?: { role: string; content: string }[];
}

export interface AIChatResponse {
  id?: string;
  message_id?: string;
  patient_id: string;
  intent_category: string;
  assistant_reply: string;
  mascot_expression: 'friendly' | 'caring' | 'attentive' | 'alert' | 'encouraging' | 'celebrating' | string;
  is_emergency: boolean;
  emergency_event_id?: string;
  emergency_instructions?: string;
  suggested_followups?: string[];
  grounding_sources: string[];
  suggested_slots?: DoctorSlot[];
  doctor_slots?: DoctorSlot[];
  action_taken?: {
    appointment_booked?: boolean;
    appointment_id?: string;
    doctor_name?: string;
    start_time?: string;
    formatted_date?: string;
    formatted_time?: string;
    appointment_type?: string;
    status?: string;
    [key: string]: any;
  };
  active_orders?: MedicationOrder[];
  created_at: string;
}

export interface AIChatMessageItem {
  id: string;
  patient_id: string;
  sender_user_id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  intent_category?: string;
  is_emergency: boolean;
  mascot_expression?: string;
  grounding_sources: string[];
  created_at: string;
}

class ApiClient {
  private getHeaders(isMultipart = false): HeadersInit {
    const token = localStorage.getItem('pregtwin_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Local AI inference or processing is taking longer than expected.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.detail) {
          errorMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        }
      } catch {
        // Fallback to text
      }
      throw new Error(errorMsg);
    }
    return res.json();
  }

  // Auth
  async login(formData: { email: string; password: string }): Promise<AuthResponse> {
    const res = await this.fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }, 30000);
    return this.handleResponse<AuthResponse>(res);
  }

  async getMe(): Promise<User> {
    const res = await this.fetchWithTimeout(`${API_BASE}/auth/me`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<User>(res);
  }

  // Patients
  async listPatients(): Promise<PatientProfile[]> {
    const res = await this.fetchWithTimeout(`${API_BASE}/patients`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<PatientProfile[]>(res);
  }

  async getPatient(id: string): Promise<PatientProfile> {
    const res = await this.fetchWithTimeout(`${API_BASE}/patients/${id}`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<PatientProfile>(res);
  }

  async getPatientTimeline(id: string): Promise<{ patient_id: string; patient_name: string; mrn: string; events: TimelineEvent[] }> {
    const res = await this.fetchWithTimeout(`${API_BASE}/patients/${id}/timeline`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<{ patient_id: string; patient_name: string; mrn: string; events: TimelineEvent[] }>(res);
  }

  // Documents
  async uploadDocument(formData: FormData): Promise<MedicalDocument> {
    // 3 minutes timeout for local Ollama / PyMuPDF OCR on multi-page reports
    const res = await this.fetchWithTimeout(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    }, 180000);
    return this.handleResponse<MedicalDocument>(res);
  }

  async getDocument(id: string): Promise<MedicalDocument> {
    const res = await this.fetchWithTimeout(`${API_BASE}/documents/${id}`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<MedicalDocument>(res);
  }

  async getPatientDocuments(patientId: string): Promise<MedicalDocument[]> {
    const res = await this.fetchWithTimeout(`${API_BASE}/documents/patient/${patientId}`, {
      headers: this.getHeaders(),
    }, 30000);
    return this.handleResponse<MedicalDocument[]>(res);
  }

  async reviewField(docId: string, fieldId: string, decision: string, correction?: string, notes?: string): Promise<any> {
    const res = await this.fetchWithTimeout(`${API_BASE}/documents/${docId}/fields/${fieldId}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ decision, correction_value: correction, clinician_notes: notes }),
    }, 30000);
    return this.handleResponse<any>(res);
  }

  async acceptAllFields(docId: string): Promise<any> {
    const res = await this.fetchWithTimeout(`${API_BASE}/documents/${docId}/accept-all`, {
      method: 'POST',
      headers: this.getHeaders(),
    }, 60000);
    return this.handleResponse<any>(res);
  }

  // Observations
  async getObservations(patientId: string, obsType?: string): Promise<ClinicalObservation[]> {
    const url = obsType ? `${API_BASE}/patients/${patientId}/observations?obs_type=${obsType}` : `${API_BASE}/patients/${patientId}/observations`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<ClinicalObservation[]>(res);
  }

  async getHistoricalComparisons(patientId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/observations/comparisons`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  async createObservation(patientId: string, data: any): Promise<ClinicalObservation> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/observations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ClinicalObservation>(res);
  }

  // Maternal Digital Twin
  async getCurrentTwin(patientId: string): Promise<MaternalTwinState> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/twin`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<MaternalTwinState>(res);
  }

  async getTwinHistory(patientId: string): Promise<MaternalTwinState[]> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/twin/history`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<MaternalTwinState[]>(res);
  }

  // Predictions & Research Model
  async getPredictions(patientId: string): Promise<RiskPrediction[]> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/predictions`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<RiskPrediction[]>(res);
  }

  async recomputePrediction(patientId: string, asOf?: string): Promise<RiskPrediction> {
    const url = asOf ? `${API_BASE}/patients/${patientId}/predictions/recompute?as_of=${encodeURIComponent(asOf)}` : `${API_BASE}/patients/${patientId}/predictions/recompute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<RiskPrediction>(res);
  }

  async getModelEvaluation(): Promise<any> {
    const res = await fetch(`${API_BASE}/models/preeclampsia/evaluation`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  // Simulation Lab & Scenarios
  async simulateScenario(patientId: string, payload: any): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/simulate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<SimulationResult>(res);
  }

  async getScenarios(patientId: string, category?: string): Promise<SimulationScenario[]> {
    const url = category ? `${API_BASE}/patients/${patientId}/scenarios?category=${category}` : `${API_BASE}/patients/${patientId}/scenarios`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return this.handleResponse<SimulationScenario[]>(res);
  }

  async saveScenario(patientId: string, data: { name: string; category: string; description?: string; parameters: any; results: any }): Promise<SimulationScenario> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/scenarios`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<SimulationScenario>(res);
  }

  async getScenario(patientId: string, scenarioId: string): Promise<SimulationScenario> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/scenarios/${scenarioId}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<SimulationScenario>(res);
  }

  async updateScenario(patientId: string, scenarioId: string, data: any): Promise<SimulationScenario> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/scenarios/${scenarioId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<SimulationScenario>(res);
  }

  async deleteScenario(patientId: string, scenarioId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/scenarios/${scenarioId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  exportScenarioUrl(patientId: string, scenarioId: string, format = 'csv'): string {
    const token = localStorage.getItem('pregtwin_token');
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/patients/${patientId}/scenarios/${scenarioId}/export?format=${format}${tokenParam}`;
  }

  async downloadScenarioExport(patientId: string, scenarioId: string, format = 'csv'): Promise<void> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/scenarios/${scenarioId}/export?format=${format}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Export failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario_${scenarioId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async downloadDocument(documentId: string, filename = 'document.pdf'): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/download`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Download failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async getDocumentBlobUrl(documentId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/file`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const resDl = await fetch(`${API_BASE}/documents/${documentId}/download`, {
        headers: this.getHeaders(),
      });
      if (!resDl.ok) {
        const err = await resDl.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch document file`);
      }
      const blob = await resDl.blob();
      return window.URL.createObjectURL(blob);
    }
    const blob = await res.blob();
    return window.URL.createObjectURL(blob);
  }

  // IoT Devices & Multi-Sensor
  async getDevices(patientId: string): Promise<DeviceConnection[]> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/devices`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DeviceConnection[]>(res);
  }

  async connectMockDevice(patientId: string, deviceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/devices/mock/connect?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  async disconnectMockDevice(patientId: string, deviceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/devices/mock/disconnect?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  async generateMockReadings(patientId: string, deviceId: string, count = 1): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/devices/mock/generate?device_id=${encodeURIComponent(deviceId)}&reading_count=${count}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  async getDeviceSpecs(patientId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/devices/specs`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  // Normalized Measurements
  async getMeasurements(
    patientId: string,
    params?: { measurement_type?: string; source_type?: string; limit?: number; offset?: number }
  ): Promise<DeviceMeasurement[]> {
    const searchParams = new URLSearchParams();
    if (params?.measurement_type) searchParams.append('measurement_type', params.measurement_type);
    if (params?.source_type) searchParams.append('source_type', params.source_type);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));

    const qs = searchParams.toString();
    const url = qs ? `${API_BASE}/patients/${patientId}/measurements?${qs}` : `${API_BASE}/patients/${patientId}/measurements`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return this.handleResponse<DeviceMeasurement[]>(res);
  }

  async createMeasurement(patientId: string, data: any): Promise<DeviceMeasurement> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/measurements`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<DeviceMeasurement>(res);
  }

  // Camera Signal Research
  async getCameraResearchStatus(patientId: string): Promise<CameraResearchStatus> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/camera-research/status`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CameraResearchStatus>(res);
  }

  async logCameraSignal(patientId: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/camera-research/signals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<any>(res);
  }

  async getCameraResearchSessions(patientId: string, limit = 20): Promise<CameraResearchSessionRecord[]> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/camera-research/sessions?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CameraResearchSessionRecord[]>(res);
  }

  // Clinician Workspace
  async getClinicianReviewQueue(patientId?: string): Promise<any> {
    const url = patientId
      ? `${API_BASE}/clinician/review-queue?patient_id=${patientId}`
      : `${API_BASE}/clinician/review-queue`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any>(res);
  }

  async getClinicianPatientsOverview(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/clinician/patients-overview`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any[]>(res);
  }

  // Audit & Diagnostics
  async getAuditHistory(limit = 50, offset = 0): Promise<any[]> {
    const res = await fetch(`${API_BASE}/audit-history?limit=${limit}&offset=${offset}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<any[]>(res);
  }

  async getSystemDiagnostics(): Promise<SystemDiagnostics> {
    const res = await fetch(`${API_BASE}/system/diagnostics`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<SystemDiagnostics>(res);
  }

  // ==========================================
  // Medication Management Endpoints
  // ==========================================
  async getMedicationOrders(patientId: string, status?: string): Promise<MedicationOrder[]> {
    const qs = status ? `?patient_id=${patientId}&status=${status}` : `?patient_id=${patientId}`;
    const res = await fetch(`${API_BASE}/medications/orders${qs}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<MedicationOrder[]>(res);
  }

  async createMedicationOrder(orderData: Partial<MedicationOrder>): Promise<MedicationOrder> {
    const res = await fetch(`${API_BASE}/medications/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(orderData),
    });
    return this.handleResponse<MedicationOrder>(res);
  }

  async approveMedicationOrder(orderId: string): Promise<MedicationOrder> {
    const res = await fetch(`${API_BASE}/medications/orders/${orderId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<MedicationOrder>(res);
  }

  async discontinueMedicationOrder(orderId: string): Promise<MedicationOrder> {
    const res = await fetch(`${API_BASE}/medications/orders/${orderId}/discontinue`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<MedicationOrder>(res);
  }

  async logMedicationDose(
    orderId: string,
    data: {
      scheduled_time: string;
      status: string;
      patient_notes?: string;
      side_effect_severity?: string;
      side_effect_description?: string;
    }
  ): Promise<MedicationDoseLog> {
    const res = await fetch(`${API_BASE}/medications/orders/${orderId}/log-dose`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<MedicationDoseLog>(res);
  }

  async getMedicationSummary(patientId: string): Promise<MedicationSummary> {
    const res = await fetch(`${API_BASE}/medications/patient/${patientId}/summary`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<MedicationSummary>(res);
  }

  async getAllDrugMonographs(): Promise<Record<string, DrugMonograph>> {
    const res = await fetch(`${API_BASE}/medications/monographs`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<Record<string, DrugMonograph>>(res);
  }

  async getDrugMonograph(medicationName: string): Promise<DrugMonograph> {
    const res = await fetch(`${API_BASE}/medications/monographs/${encodeURIComponent(medicationName)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DrugMonograph>(res);
  }

  async generateMedicationReminders(patientId: string): Promise<{ reminders_created: number }> {
    const res = await fetch(`${API_BASE}/medications/patient/${patientId}/generate-reminders`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ reminders_created: number }>(res);
  }

  // ==========================================
  // Appointment Scheduling Endpoints
  // ==========================================
  async getDoctorSlots(doctorId: string, startDate?: string, endDate?: string): Promise<DoctorSlot[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/appointments/doctor/${doctorId}/slots${qs}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DoctorSlot[]>(res);
  }

  async getAppointments(patientId?: string, doctorId?: string, status?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    if (doctorId) params.append('doctor_id', doctorId);
    if (status) params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/appointments${qs}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<Appointment[]>(res);
  }

  async bookAppointment(bookingData: {
    patient_id: string;
    doctor_id: string;
    scheduled_start?: string;
    scheduled_end?: string;
    start_time?: string;
    end_time?: string;
    appointment_type?: string;
    reason?: string;
    patient_notes?: string;
    booked_via?: string;
    booking_channel?: string;
  }): Promise<Appointment> {
    const startTime = bookingData.start_time || bookingData.scheduled_start;
    const endTime = bookingData.end_time || bookingData.scheduled_end;
    const channel = bookingData.booking_channel || bookingData.booked_via || 'ui_web';
    const payload = {
      ...bookingData,
      start_time: startTime,
      scheduled_start: startTime,
      end_time: endTime,
      scheduled_end: endTime,
      booking_channel: channel,
      booked_via: channel,
      reason: bookingData.reason || bookingData.patient_notes || 'Routine prenatal consultation',
    };
    const res = await fetch(`${API_BASE}/appointments/book`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<Appointment>(res);
  }

  async rescheduleAppointment(
    appointmentId: string,
    newStart: string,
    newEnd: string,
    reason?: string
  ): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        new_start_time: newStart,
        new_scheduled_start: newStart,
        new_scheduled_end: newEnd,
        reason: reason || 'Patient requested reschedule',
        reschedule_reason: reason || 'Patient requested reschedule',
      }),
    });
    return this.handleResponse<Appointment>(res);
  }

  async cancelAppointment(appointmentId: string, reason?: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        cancellation_reason: reason || 'Patient requested cancellation',
        reason: reason || 'Patient requested cancellation',
      }),
    });
    return this.handleResponse<Appointment>(res);
  }

  async getDoctorAvailability(doctorId: string): Promise<DoctorScheduleDay[]> {
    const res = await fetch(`${API_BASE}/appointments/doctor/${doctorId}/availability`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DoctorScheduleDay[]>(res);
  }

  async saveDoctorAvailability(doctorId: string, schedule: DoctorScheduleDay[]): Promise<DoctorScheduleDay[]> {
    const res = await fetch(`${API_BASE}/appointments/doctor/${doctorId}/availability`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(schedule),
    });
    return this.handleResponse<DoctorScheduleDay[]>(res);
  }

  // ==========================================
  // Notification Center Endpoints
  // ==========================================
  async getNotifications(limit = 40, unreadOnly = false): Promise<AppNotification[]> {
    const res = await fetch(`${API_BASE}/notifications?limit=${limit}&unread_only=${unreadOnly}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<AppNotification[]>(res);
  }

  async getUnreadNotificationCount(): Promise<NotificationCount> {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<NotificationCount>(res);
  }

  async markNotificationRead(notificationId: string): Promise<AppNotification> {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<AppNotification>(res);
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ updated: number }>(res);
  }

  // ==========================================
  // Emergency Events Endpoints
  // ==========================================
  async getActiveEmergencies(): Promise<EmergencyEventRecord[]> {
    const res = await fetch(`${API_BASE}/emergency/active`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<EmergencyEventRecord[]>(res);
  }

  async acknowledgeEmergency(eventId: string, resolutionNotes?: string): Promise<EmergencyEventRecord> {
    const res = await fetch(`${API_BASE}/emergency/${eventId}/acknowledge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    });
    return this.handleResponse<EmergencyEventRecord>(res);
  }

  // ==========================================
  // AI Assistant Endpoints
  // ==========================================
  async chatWithAIAssistant(req: AIChatRequest): Promise<AIChatResponse> {
    const res = await this.fetchWithTimeout(`${API_BASE}/ai-assistant/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(req),
    }, 45000);
    return this.handleResponse<AIChatResponse>(res);
  }

  async getAIAssistantHistory(patientId: string, limit = 50): Promise<AIChatMessageItem[]> {
    const res = await fetch(`${API_BASE}/ai-assistant/history/${patientId}?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<any>(res);
    const rawList: any[] = Array.isArray(data) ? data : (data?.messages || []);
    return rawList.map((m: any) => ({
      id: m.id || `msg-${Math.random().toString(36).substring(2, 9)}`,
      patient_id: m.patient_id || patientId,
      sender_user_id: m.sender_user_id || '',
      role: (m.role || (m.sender_type === 'patient' || m.sender_type === 'user' ? 'user' : 'assistant')) as 'user' | 'assistant' | 'system',
      message: m.message || m.message_text || '',
      intent_category: m.intent_category,
      is_emergency: Boolean(m.is_emergency),
      mascot_expression: m.mascot_expression || 'friendly',
      grounding_sources: m.grounding_sources || m.sources || [],
      created_at: m.created_at || new Date().toISOString(),
    }));
  }

  async submitAIAssistantFeedback(feedbackData: {
    message_id: string;
    patient_id: string;
    rating: number;
    clinician_notes?: string;
  }): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/ai-assistant/feedback`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(feedbackData),
    });
    return this.handleResponse<{ status: string }>(res);
  }
}

export const api = new ApiClient();
