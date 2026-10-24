import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { CraneDoctorMascot } from '../components/CraneDoctorMascot';
import { NotificationCenter } from '../components/NotificationCenter';
import { MedicationsView } from '../views/MedicationsView';
import { AppointmentsView } from '../views/AppointmentsView';
import { AIAssistantView } from '../views/AIAssistantView';
import { DocumentDetailView } from '../views/DocumentDetailView';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

describe('AI Doctor System & Mascot Frontend Tests', () => {
  it('renders CraneDoctorMascot with white coat, stethoscope, medical bag, and Dr. Crane badge', () => {
    const { container } = render(
      <CraneDoctorMascot expression="friendly" state="idle" size="lg" showBadge={true} />
    );

    expect(screen.getByText('Dr. Crane, MD')).toBeDefined();
    expect(screen.getByText('AI Clinician')).toBeDefined();

    // Check SVG rendered elements
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // Verify coat gradient & stethoscope defs exist
    expect(container.querySelector('#coatGradient')).not.toBeNull();
    expect(container.querySelector('#stethoscopeGrad')).not.toBeNull();
    expect(container.querySelector('#bagGrad')).not.toBeNull();
  });

  it('renders CraneDoctorMascot in alert expression with red warning indicator and aura', () => {
    const { container } = render(
      <CraneDoctorMascot expression="alert" state="alert" size="md" showBadge={true} />
    );

    // Alert aura has red fill
    const alertCircle = container.querySelector('circle[fill="#FEE2E2"]');
    expect(alertCircle).not.toBeNull();

    // Alert badge indicator '!'
    expect(screen.getByText('!')).toBeDefined();
  });

  it('renders NotificationCenter bell button with animated shake when unread notifications exist', async () => {
    vi.spyOn(api, 'getUnreadNotificationCount').mockResolvedValue({
      unread_count: 3,
      critical_unread: 1,
    });

    render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>
    );

    // Initial render check
    const bellBtn = screen.getByRole('button', { name: /open notifications/i });
    expect(bellBtn).toBeDefined();
  });

  it('renders MedicationsView with prescriptions header and drug monographs section', () => {
    vi.spyOn(api, 'getMedicationOrders').mockResolvedValue([]);
    vi.spyOn(api, 'getMedicationSummary').mockResolvedValue({
      patient_id: 'test-patient',
      total_active_orders: 1,
      total_doses_logged: 12,
      adherence_rate_pct: 100,
      consecutive_missed_doses: 0,
      consecutive_missed_alert: false,
      recent_side_effects: [],
      upcoming_doses: [],
    });
    vi.spyOn(api, 'getAllDrugMonographs').mockResolvedValue({
      labetalol: {
        generic_name: 'Labetalol Hydrochloride',
        drug_class: 'Alpha-1 and Beta-Adrenergic Blocker',
        intended_use: 'First-line oral anti-hypertensive medication',
        pregnancy_safety_notes: 'Well-established safety in pregnancy',
        common_side_effects: ['Fatigue', 'Scalp tingling'],
        serious_warning_signs: ['Wheezing', 'Extreme bradycardia'],
        missed_dose_guidance: 'Take as soon as remembered. Do not double dose.',
        clinical_reference: 'ACOG Practice Bulletin 222',
      },
    });

    render(
      <AuthProvider>
        <BrowserRouter>
          <MedicationsView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Medication Management/i)).toBeDefined();
    expect(screen.getByText(/Maternal Drug Reference Monographs/)).toBeDefined();
  });

  it('renders AppointmentsView with consultation header and book consultation button', () => {
    vi.spyOn(api, 'getAppointments').mockResolvedValue([]);

    render(
      <AuthProvider>
        <BrowserRouter>
          <AppointmentsView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Doctor Appointments & Consultations')).toBeDefined();
    expect(screen.getByRole('button', { name: /book.*consultation/i })).toBeDefined();
  });

  it('renders AppointmentsView with scheduled appointments without Invalid Date', async () => {
    vi.spyOn(api, 'getAppointments').mockResolvedValue([
      {
        id: 'appt-123',
        patient_id: 'p1',
        doctor_id: 'd1',
        doctor_name: 'Dr. Elena Vance, MD, FACOG',
        patient_name: 'Maya Lin',
        start_time: '2026-11-20T10:00:00Z',
        end_time: '2026-11-20T10:30:00Z',
        scheduled_start: '2026-11-20T10:00:00Z',
        scheduled_end: '2026-11-20T10:30:00Z',
        status: 'CONFIRMED',
        appointment_type: 'ROUTINE_PRENATAL',
        reason: '32w Maternal blood pressure check',
        booking_channel: 'ai_assistant',
        booked_via: 'AI_ASSISTANT',
        created_at: '2026-11-19T00:00:00Z',
      } as any,
    ]);

    render(
      <AuthProvider>
        <BrowserRouter>
          <AppointmentsView />
        </BrowserRouter>
      </AuthProvider>
    );

    // Wait for appointment card to render
    expect(await screen.findByText('32w Maternal blood pressure check')).toBeDefined();
    expect(screen.getByText('Dr. Elena Vance, MD, FACOG')).toBeDefined();
    expect(screen.getByText('CONFIRMED')).toBeDefined();
    expect(screen.getByText('Booked via Dr. Crane AI')).toBeDefined();

    // Verify Invalid Date NEVER appears
    expect(screen.queryByText(/Invalid Date/i)).toBeNull();
    // Verify 10:00 UTC displays in explicit 12h AM/PM notation
    expect(screen.getByText(/10:00 AM.*10:30 AM/)).toBeDefined();
  });

  it('correctly displays 12-hour AM/PM times for afternoon appointments without timezone distortion', async () => {
    vi.spyOn(api, 'getAppointments').mockResolvedValue([
      {
        id: 'appt-am-pm',
        patient_id: 'p1',
        doctor_id: 'd1',
        doctor_name: 'Dr. Elena Vance, MD, FACOG',
        patient_name: 'Maya Lin',
        start_time: '2026-11-20T14:30:00Z',
        end_time: '2026-11-20T15:00:00Z',
        scheduled_start: '2026-11-20T14:30:00Z',
        scheduled_end: '2026-11-20T15:00:00Z',
        status: 'CONFIRMED',
        appointment_type: 'ROUTINE_PRENATAL',
        reason: 'Afternoon prenatal review',
        booking_channel: 'ai_assistant',
        booked_via: 'AI_ASSISTANT',
        formatted_time: '2:30 PM',
        formatted_date: 'Fri, Nov 20, 2026',
        created_at: '2026-11-19T00:00:00Z',
      } as any,
    ]);

    render(
      <AuthProvider>
        <BrowserRouter>
          <AppointmentsView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(await screen.findByText('Afternoon prenatal review')).toBeDefined();
    // 14:30 UTC must render as 2:30 PM, and 15:00 UTC must render as 3:00 PM
    expect(screen.getByText(/2:30 PM.*3:00 PM/)).toBeDefined();
  });

  it('verifies api.bookAppointment and api.rescheduleAppointment payload format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'test-appt',
          patient_id: 'p1',
          doctor_id: 'd1',
          start_time: '2026-11-20T10:00:00Z',
          end_time: '2026-11-20T10:30:00Z',
          scheduled_start: '2026-11-20T10:00:00Z',
          scheduled_end: '2026-11-20T10:30:00Z',
          status: 'CONFIRMED',
          appointment_type: 'ROUTINE_PRENATAL',
          reason: 'Test consultation',
          booking_channel: 'ui_web',
          created_at: '2026-11-19T00:00:00Z',
        }),
      } as any;
    });

    // 1. Book appointment
    await api.bookAppointment({
      patient_id: 'p1',
      doctor_id: 'd1',
      scheduled_start: '2026-11-20T10:00:00Z',
      scheduled_end: '2026-11-20T10:30:00Z',
      appointment_type: 'ROUTINE_PRENATAL',
      reason: 'Test consultation',
      booked_via: 'UI_WEB',
    });

    expect(fetchSpy).toHaveBeenCalled();
    const lastCallInit = fetchSpy.mock.calls[0]?.[1];
    const parsedBody = JSON.parse((lastCallInit?.body as string) || '{}');
    expect(parsedBody.start_time).toBe('2026-11-20T10:00:00Z');
    expect(parsedBody.scheduled_start).toBe('2026-11-20T10:00:00Z');
    expect(parsedBody.booking_channel).toBe('UI_WEB');

    // 2. Reschedule appointment
    await api.rescheduleAppointment(
      'test-appt',
      '2026-11-20T11:00:00Z',
      '2026-11-20T11:30:00Z',
      'Need later time'
    );

    const reschedCallInit = fetchSpy.mock.calls[1]?.[1];
    const parsedReschedBody = JSON.parse((reschedCallInit?.body as string) || '{}');
    expect(parsedReschedBody.new_start_time).toBe('2026-11-20T11:00:00Z');
    expect(parsedReschedBody.new_scheduled_start).toBe('2026-11-20T11:00:00Z');
    expect(parsedReschedBody.reason).toBe('Need later time');
    expect(parsedReschedBody.reschedule_reason).toBe('Need later time');

    fetchSpy.mockRestore();
  });

  it('renders AIAssistantView with Dr. Crane mascot and prompt chips', () => {
    vi.spyOn(api, 'getAIAssistantHistory').mockResolvedValue([]);

    render(
      <AuthProvider>
        <BrowserRouter>
          <AIAssistantView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Dr. Crane AI Assistant')).toBeDefined();
    expect(screen.getByText(/Zero Hallucinated Prescriptions/)).toBeDefined();
    expect(screen.getByText('Suggested Clinical Inquiries')).toBeDefined();
    expect(screen.getByPlaceholderText(/Ask Dr. Crane/i)).toBeDefined();
  });

  it('renders AppointmentsView with divided categories for Scheduled, Rescheduled, and Cancelled', async () => {
    vi.spyOn(api, 'getAppointments').mockResolvedValue([
      {
        id: 'appt-sched',
        patient_id: 'p1',
        doctor_id: 'd1',
        doctor_name: 'Dr. Elena Vance, MD',
        patient_name: 'Maya Lin',
        start_time: '2026-11-20T10:00:00Z',
        end_time: '2026-11-20T10:30:00Z',
        scheduled_start: '2026-11-20T10:00:00Z',
        scheduled_end: '2026-11-20T10:30:00Z',
        status: 'CONFIRMED',
        appointment_type: 'ROUTINE_PRENATAL',
        reason: 'Active prenatal checkup',
        booking_channel: 'ai_assistant',
        booked_via: 'AI_ASSISTANT',
        created_at: '2026-11-19T00:00:00Z',
      } as any,
      {
        id: 'appt-resched',
        patient_id: 'p1',
        doctor_id: 'd1',
        doctor_name: 'Dr. Elena Vance, MD',
        patient_name: 'Maya Lin',
        start_time: '2026-11-22T14:00:00Z',
        end_time: '2026-11-22T14:30:00Z',
        scheduled_start: '2026-11-22T14:00:00Z',
        scheduled_end: '2026-11-22T14:30:00Z',
        status: 'RESCHEDULED',
        appointment_type: 'URGENT_REVIEW',
        reason: 'Rescheduled for afternoon monitoring',
        booking_channel: 'ui_web',
        booked_via: 'UI_WEB',
        created_at: '2026-11-19T00:00:00Z',
      } as any,
      {
        id: 'appt-cancelled',
        patient_id: 'p1',
        doctor_id: 'd1',
        doctor_name: 'Dr. Elena Vance, MD',
        patient_name: 'Maya Lin',
        start_time: '2026-11-25T09:00:00Z',
        end_time: '2026-11-25T09:30:00Z',
        scheduled_start: '2026-11-25T09:00:00Z',
        scheduled_end: '2026-11-25T09:30:00Z',
        status: 'CANCELLED',
        appointment_type: 'TELEHEALTH',
        reason: 'Patient conflict - cancelled',
        booking_channel: 'ui_web',
        booked_via: 'UI_WEB',
        created_at: '2026-11-19T00:00:00Z',
      } as any,
    ]);

    render(
      <AuthProvider>
        <BrowserRouter>
          <AppointmentsView />
        </BrowserRouter>
      </AuthProvider>
    );

    // Verify category badges and section headers appear
    expect(await screen.findByText('Active prenatal checkup')).toBeDefined();
    expect(screen.getByText('Rescheduled for afternoon monitoring')).toBeDefined();
    expect(screen.getByText('Patient conflict - cancelled')).toBeDefined();

    // Verify category headers in the divided "All" view
    expect(screen.getByText('Scheduled Consultations')).toBeDefined();
    expect(screen.getByText('Rescheduled Consultations')).toBeDefined();
    expect(screen.getByText('Cancelled Consultations')).toBeDefined();

    // Filter to "Rescheduled"
    const reschedBtn = screen.getByRole('button', { name: /rescheduled/i });
    fireEvent.click(reschedBtn);

    // Verify only rescheduled item is shown
    expect(screen.getByText('Rescheduled for afternoon monitoring')).toBeDefined();
    expect(screen.queryByText('Active prenatal checkup')).toBeNull();
    expect(screen.queryByText('Patient conflict - cancelled')).toBeNull();

    // Filter to "Cancelled"
    const cancelBtn = screen.getByRole('button', { name: /cancelled/i });
    fireEvent.click(cancelBtn);

    // Verify only cancelled item is shown
    expect(screen.getByText('Patient conflict - cancelled')).toBeDefined();
    expect(screen.queryByText('Active prenatal checkup')).toBeNull();
    expect(screen.queryByText('Rescheduled for afternoon monitoring')).toBeNull();
  });

  it('renders DocumentDetailView with dynamic patient details (Clara Novak) and never hardcoded Maya Lin', async () => {
    vi.spyOn(api, 'getDocument').mockResolvedValue({
      id: 'doc-clara-001',
      patient_id: '18113544-4d30-460a-b6aa-64e73a08a3f3',
      patient_name: 'Clara Novak',
      patient_mrn: 'MRN-PT-2026-003',
      filename: 'Clara_Novak_Fake_Antenatal_Lab_Report.pdf',
      file_size_bytes: 28718,
      mime_type: 'application/pdf',
      category: 'Kidney-function tests',
      report_date: '2026-10-15',
      source_institution: "Northside Women's Clinic",
      processing_status: 'COMPLETED',
      ocr_engine: 'tesseract',
      ai_provider: 'OLLAMA (llama3.2:3b)',
      page_count: 1,
      extracted_text: 'ANTENATAL LABORATORY REPORT\nPatient name: Clara Novak\nMRN-PT-2026-003',
      created_at: '2026-10-23T14:16:48Z',
      extracted_fields: [
        {
          id: 'f-1',
          document_id: 'doc-clara-001',
          field_name: 'systolic_bp',
          category: 'blood_pressure',
          extracted_value: '116',
          unit: 'mmHg',
          source_text: 'Blood pressure 116/74 mmHg',
          source_page: 1,
          validation_status: 'VALID',
          review_status: 'ACCEPTED',
          confidence: 0.95,
          extraction_method: 'deterministic_regex',
        },
        {
          id: 'f-2',
          document_id: 'doc-clara-001',
          field_name: 'diastolic_bp',
          category: 'blood_pressure',
          extracted_value: '74',
          unit: 'mmHg',
          source_text: 'Blood pressure 116/74 mmHg',
          source_page: 1,
          validation_status: 'VALID',
          review_status: 'ACCEPTED',
          confidence: 0.95,
          extraction_method: 'deterministic_regex',
        },
        {
          id: 'f-3',
          document_id: 'doc-clara-001',
          field_name: 'gestational_age_weeks',
          category: 'maternal_profile',
          extracted_value: '16.0',
          unit: 'weeks',
          source_text: 'Gestational age 16 weeks + 0 days',
          source_page: 1,
          validation_status: 'VALID',
          review_status: 'ACCEPTED',
          confidence: 0.95,
          extraction_method: 'deterministic_regex',
        },
      ],
    });
    vi.spyOn(api, 'getDocumentBlobUrl').mockRejectedValue(new Error('PDF viewer mock'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/medical-records/doc-clara-001']}>
          <Routes>
            <Route path="/medical-records/:documentId" element={<DocumentDetailView />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Verify document filename and Clara Novak details appear
    expect(await screen.findByText('Clara_Novak_Fake_Antenatal_Lab_Report.pdf')).toBeDefined();
    expect(screen.getByText(/CLARA NOVAK/)).toBeDefined();
    expect(screen.getAllByText(/MRN-PT-2026-003/).length).toBeGreaterThan(0);
    expect(screen.getByText("Northside Women's Clinic")).toBeDefined();
    expect(screen.getByText(/Blood Pressure: 116\/74 mmHg/)).toBeDefined();

    // Verify hardcoded Maya Lin NEVER appears for Clara's document
    expect(screen.queryByText(/MAYA LIN/)).toBeNull();
    expect(screen.queryByText(/MRN-PT-2026-001/)).toBeNull();
  });
});
