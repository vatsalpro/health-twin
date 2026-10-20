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
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    return this.handleResponse<AuthResponse>(res);
  }

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<User>(res);
  }

  // Patients
  async listPatients(): Promise<PatientProfile[]> {
    const res = await fetch(`${API_BASE}/patients`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<PatientProfile[]>(res);
  }

  async getPatient(id: string): Promise<PatientProfile> {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<PatientProfile>(res);
  }

  async getPatientTimeline(id: string): Promise<{ patient_id: string; patient_name: string; mrn: string; events: TimelineEvent[] }> {
    const res = await fetch(`${API_BASE}/patients/${id}/timeline`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ patient_id: string; patient_name: string; mrn: string; events: TimelineEvent[] }>(res);
  }

  // Documents
  async uploadDocument(formData: FormData): Promise<MedicalDocument> {
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse<MedicalDocument>(res);
  }

  async getDocument(id: string): Promise<MedicalDocument> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<MedicalDocument>(res);
  }

  async reviewField(docId: string, fieldId: string, decision: string, correction?: string, notes?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/documents/${docId}/fields/${fieldId}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ decision, correction_value: correction, clinician_notes: notes }),
    });
    return this.handleResponse<any>(res);
  }

  async acceptAllFields(docId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/documents/${docId}/accept-all`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
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

  // Simulation Lab
  async simulateScenario(patientId: string, payload: any): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/simulate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<SimulationResult>(res);
  }

  // Clinician Workspace
  async getClinicianReviewQueue(): Promise<any> {
    const res = await fetch(`${API_BASE}/clinician/review-queue`, {
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
}

export const api = new ApiClient();
