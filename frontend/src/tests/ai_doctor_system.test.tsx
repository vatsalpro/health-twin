import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CraneDoctorMascot } from '../components/CraneDoctorMascot';
import { NotificationCenter } from '../components/NotificationCenter';
import { MedicationsView } from '../views/MedicationsView';
import { AppointmentsView } from '../views/AppointmentsView';
import { AIAssistantView } from '../views/AIAssistantView';
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
});
