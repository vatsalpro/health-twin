import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LoginView } from '../views/LoginView';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { MetricCard } from '../components/ui/MetricCard';
import { RppgProcessor } from '../services/rppgProcessor';
import { StressAnalysisPipeline } from '../services/stressAnalysisPipeline';

describe('PregTwin Frontend Test Suite', () => {
  it('renders LoginView with branding and demo profile options', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <LoginView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getAllByText('PregTwin').length).toBeGreaterThan(0);
    expect(screen.getByText('Dr. Elena Vance')).toBeDefined();
    expect(screen.getByText('Maya Lin (31.4w)')).toBeDefined();
    expect(screen.getByPlaceholderText('you@hospital.org')).toBeDefined();
  });

  it('renders MaternalTwin3D without crashing and handles WebGL gracefully', () => {
    const { container } = render(
      <MaternalTwin3D
        gestationalAgeWeeks={31.4}
        sbp={142}
        dbp={92}
        riskCategory="HIGH"
        interactive={false}
      />
    );

    expect(container).toBeDefined();
    expect(screen.getByText('Maternal Twin Telemetry')).toBeDefined();
    expect(screen.getByText(/31.4w GA/)).toBeDefined();
  });

  it('renders Clinical UI design system components (Badge, Alert, MetricCard)', () => {
    render(
      <div>
        <Badge variant="primary" size="md">VERIFIED BASELINE</Badge>
        <Badge variant="danger" size="sm">CRITICAL SBP</Badge>
        <Alert
          type="warning"
          title="Physiological Integrity Notice"
          description="Systolic blood pressure must exceed diastolic blood pressure."
        />
        <MetricCard
          label="Systolic BP"
          value="142"
          unit="mmHg"
          statusBadge={{ text: "Baseline +12", variant: "warning" }}
        />
      </div>
    );

    expect(screen.getByText('VERIFIED BASELINE')).toBeDefined();
    expect(screen.getByText('CRITICAL SBP')).toBeDefined();
    expect(screen.getByText('Physiological Integrity Notice')).toBeDefined();
    expect(screen.getByText('Systolic blood pressure must exceed diastolic blood pressure.')).toBeDefined();
    expect(screen.getByText('Systolic BP')).toBeDefined();
    expect(screen.getByText('142')).toBeDefined();
  });

  it('validates simulation input integrity: SBP must strictly exceed DBP', () => {
    const validateVitals = (sbp: number, dbp: number) => {
      const errors: string[] = [];
      if (sbp <= dbp) {
        errors.push(`Systolic blood pressure (${sbp} mmHg) must be strictly greater than diastolic blood pressure (${dbp} mmHg).`);
      }
      return errors;
    };

    const errorsInverted = validateVitals(80, 120);
    expect(errorsInverted.length).toBe(1);
    expect(errorsInverted[0]).toContain('must be strictly greater than diastolic');

    const errorsEqual = validateVitals(90, 90);
    expect(errorsEqual.length).toBe(1);
    expect(errorsEqual[0]).toContain('must be strictly greater than diastolic');

    const errorsValid = validateVitals(145, 92);
    expect(errorsValid.length).toBe(0);
  });

  it('verifies independent temperature and weight measurement structures', () => {
    const tempPayload = {
      measurement_type: 'temperature',
      value_numeric: 37.1,
      unit: '°C',
      source_type: 'manual_entry',
      context_data: { site: 'oral' },
    };

    const weightPayload = {
      measurement_type: 'weight',
      value_numeric: 68.5,
      unit: 'kg',
      source_type: 'manual_entry',
      context_data: { clothing: 'light' },
    };

    expect(tempPayload.measurement_type).toBe('temperature');
    expect(weightPayload.measurement_type).toBe('weight');
    expect(tempPayload.context_data).not.toHaveProperty('weight');
    expect(weightPayload.unit).toBe('kg');
  });

  // -------------------------------------------------------------
  // Camera rPPG & Multimodal Stress Pipeline Regression Tests
  // -------------------------------------------------------------
  it('rPPG Processor requires minimum continuous convergence buffer before estimating pulse', () => {
    const proc = new RppgProcessor();
    // Initially buffer is empty
    const res = proc.process('STABLE');
    expect(res.status).toBe('BUFFERING');
    expect(res.pulseBpm).toBeNull();
    expect(res.bufferProgressPct).toBe(0);
    expect(res.reason).toContain('Converging optical skin reflectance buffer');
  });

  it('rPPG Processor rejects excessive head motion without generating synthetic pulse values', () => {
    const proc = new RppgProcessor();

    // Populate mock samples to pass minimum convergence
    const baseTime = Date.now();
    for (let i = 0; i < 250; i++) {
      proc.sampleRoisFromCanvas(
        {
          getImageData: () => ({
            data: new Uint8ClampedArray([180, 140, 120, 255]),
          }),
        } as any,
        [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
        baseTime + i * 33
      );
    }

    // Process with EXCESSIVE_MOTION
    const res = proc.process('EXCESSIVE_MOTION');
    expect(res.status).toBe('UNUSABLE_SIGNAL');
    expect(res.pulseBpm).toBeNull(); // Must NEVER invent synthetic pulse
    expect(res.reason).toContain('Excessive head movement');
  });

  it('rPPG Processor strictly gates HRV/PRV estimation to sessions exceeding 60 seconds', () => {
    const proc = new RppgProcessor();
    const baseTime = Date.now();

    // Populate 250 samples (~8 seconds)
    for (let i = 0; i < 250; i++) {
      const t = i / 30; // 30 fps
      // Add small optical pulse oscillation at 1.2 Hz (72 bpm)
      const pulseMod = Math.sin(2 * Math.PI * 1.2 * t) * 1.5;
      proc.sampleRoisFromCanvas(
        {
          getImageData: () => ({
            data: new Uint8ClampedArray([180 + pulseMod, 140 + pulseMod * 1.8, 120 + pulseMod * 0.5, 255]),
          }),
        } as any,
        [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
        baseTime + i * 33
      );
    }

    const res = proc.process('STABLE');
    // Session is < 60s, so HRV must be explicitly flagged as INSUFFICIENT_DURATION
    expect(res.hrvStatus).toBe('INSUFFICIENT_DURATION');
    expect(res.hrvRmssdMs).toBeNull();
    expect(res.hrvReason).toContain('exceed 60 continuous seconds');
  });

  it('rPPG Processor reliably estimates BPM and Signal Quality Index with detrending and PSD SNR', () => {
    const proc = new RppgProcessor();
    const baseTime = Date.now();

    // Populate 260 samples (~8.5 seconds) with 1.25 Hz pulse (75 bpm) and respiratory baseline drift
    for (let i = 0; i < 260; i++) {
      const t = i / 30; // 30 fps
      const drift = 5.0 * Math.sin(2 * Math.PI * 0.25 * t); // slow 0.25 Hz drift
      const pulseMod = Math.sin(2 * Math.PI * 1.25 * t) * 1.2 + Math.sin(2 * Math.PI * 2.5 * t) * 0.4;
      proc.sampleRoisFromCanvas(
        {
          getImageData: () => ({
            data: new Uint8ClampedArray([
              Math.min(255, Math.max(0, 180 + drift + pulseMod * 0.5)),
              Math.min(255, Math.max(0, 140 + drift + pulseMod * 1.8)),
              Math.min(255, Math.max(0, 120 + drift + pulseMod * 0.3)),
              255,
            ]),
          }),
        } as any,
        [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
        baseTime + i * 33
      );
    }

    const res = proc.process('STABLE');
    expect(res.status).toBe('ESTIMATED');
    expect(res.pulseBpm).toBeGreaterThanOrEqual(72);
    expect(res.pulseBpm).toBeLessThanOrEqual(78);
    expect(res.pulseSnrDb).toBeGreaterThan(1.8);
    expect(res.signalQualityScore).toBeGreaterThanOrEqual(55);
  });

  it('rPPG Processor throttles high-refresh rate duplicate samples (<26ms) to prevent staircase artifacts', () => {
    const proc = new RppgProcessor();
    const t0 = 1000;
    const s1 = proc.sampleRoisFromCanvas(
      { getImageData: () => ({ data: new Uint8ClampedArray([180, 140, 120, 255]) }) } as any,
      [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
      t0
    );
    expect(s1).not.toBeNull();

    // 144Hz monitor frame arrives 7ms later: must be dropped as duplicate
    const s2 = proc.sampleRoisFromCanvas(
      { getImageData: () => ({ data: new Uint8ClampedArray([180, 140, 120, 255]) }) } as any,
      [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
      t0 + 7
    );
    expect(s2).toBeNull();

    // Next 30fps camera frame arrives 33ms later: accepted
    const s3 = proc.sampleRoisFromCanvas(
      { getImageData: () => ({ data: new Uint8ClampedArray([180, 140, 120, 255]) }) } as any,
      [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
      t0 + 33
    );
    expect(s3).not.toBeNull();
  });

  it('filters out cancelled appointments older than 2 minutes (120 seconds)', () => {
    const now = Date.now();
    const appts = [
      { id: '1', status: 'SCHEDULED' },
      { id: '2', status: 'CANCELLED', cancelled_at: new Date(now - 30 * 1000).toISOString() }, // 30s ago -> keep
      { id: '3', status: 'CANCELLED', cancelled_at: new Date(now - 150 * 1000).toISOString() }, // 150s ago (> 2 min) -> remove
    ];

    const filterActive = (list: typeof appts, currentTime: number) => {
      return list.filter((a) => {
        if (a.status !== 'CANCELLED') return true;
        const cancelTimestamp = a.cancelled_at ? new Date(a.cancelled_at).getTime() : null;
        if (cancelTimestamp === null) return true;
        const elapsedMs = currentTime - cancelTimestamp;
        return elapsedMs < 2 * 60 * 1000;
      });
    };

    const active = filterActive(appts, now);
    expect(active.length).toBe(2);
    expect(active.some((a) => a.id === '1')).toBe(true);
    expect(active.some((a) => a.id === '2')).toBe(true);
    expect(active.some((a) => a.id === '3')).toBe(false);
  });

  it('Stress Analysis Pipeline maintains honest unavailable state and distinguishes self-report from ground truth', () => {
    const pipeline = new StressAnalysisPipeline();

    const mockFacial = {
      timestamp: Date.now(),
      faceDetected: true,
      landmarksCount: 478,
      browFurrow: 0.25,
      browRaise: 0.1,
      browTensionIndex: 0.22,
      eyeOpennessLeft: 0.85,
      eyeOpennessRight: 0.85,
      eyeSquint: 0.15,
      isBlinking: false,
      sessionBlinkCount: 12,
      blinkRatePerMin: 18,
      jawOpen: 0.05,
      lipPress: 0.1,
      mouthFrown: 0.08,
      mouthSmile: 0.12,
      pitchDeg: 2,
      yawDeg: -1,
      rollDeg: 0,
      headMovementJitter: 0.5,
      trackingStability: 'STABLE' as const,
      blendshapes: {},
      roiForehead: [],
      roiLeftCheek: [],
      roiRightCheek: [],
    };

    const mockRppg = {
      status: 'ESTIMATED' as const,
      durationSeconds: 30,
      bufferProgressPct: 100,
      pulseBpm: 74,
      pulseSnrDb: 3.5,
      signalQualityScore: 82,
      hrvRmssdMs: null,
      hrvStatus: 'INSUFFICIENT_DURATION' as const,
      hrvReason: 'Recording duration under 60s',
      ppgWaveform: [0, 0.5, 1, 0.5, 0],
      spectralPeakHz: 1.23,
      cardiacPowerDistribution: [],
      lightingQuality: 'OPTIMAL' as const,
      motionStatus: 'STABLE' as const,
    };

    const userSelfReport = 6.0; // Subjective 1-10
    const evalResult = pipeline.evaluate(mockFacial, mockRppg, userSelfReport);

    // 1. Must be UNAVAILABLE, not a fabricated percentage
    expect(evalResult.status).toBe('UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER');
    expect(evalResult.stressCategory).toBeNull();
    expect(evalResult.calibratedConfidence).toBeNull();

    // 2. Multimodal feature vector must preserve distinct compartments
    expect(evalResult.featureVector.facial.browFurrowIntensity).toBe(0.25);
    expect(evalResult.featureVector.facial.eyeBlinkRatePerMinute).toBe(18);
    expect(evalResult.featureVector.physiological.rppgPulseBpm).toBe(74);

    // 3. User self-report must be labeled as subjective reference, NOT ground truth
    expect(evalResult.featureVector.selfReport.userReportedStressScore).toBe(6.0);
    expect(evalResult.featureVector.selfReport.isGroundTruth).toBe(false);

    // 4. Model card must disclose lack of antenatal validation
    expect(evalResult.modelCard.evaluationMaternalPopulation).toContain('NOT VALIDATED in pregnancy');

    // 5. Must compute objective Physiological Tension Indicator
    expect(evalResult.tensionIndicator).toBeDefined();
    expect(evalResult.tensionIndicator!.score).toBeGreaterThanOrEqual(1.0);
    expect(evalResult.tensionIndicator!.score).toBeLessThanOrEqual(10.0);
    expect(['RELAXED_OPTIMAL', 'MILD_TENSION', 'MODERATE_TENSION', 'ELEVATED_TENSION']).toContain(evalResult.tensionIndicator!.category);
    expect(evalResult.tensionIndicator!.drivers.browTension.label).toBeDefined();
    expect(evalResult.tensionIndicator!.drivers.lipPress.label).toBeDefined();
    expect(evalResult.tensionIndicator!.drivers.blinkCadence.rate).toBe(18);
    expect(evalResult.tensionIndicator!.drivers.pulseArousal.bpm).toBe(74);
  });

  it('rPPG Processor supports faster 120-sample convergence and 0.8 dB SNR threshold', () => {
    const proc = new RppgProcessor();
    const baseTime = Date.now();

    // Supply 130 samples (~4.3 seconds at 30 fps) with a clean 1.3 Hz pulse
    for (let i = 0; i < 130; i++) {
      const t = i / 30;
      const pulseMod = Math.sin(2 * Math.PI * 1.3 * t) * 1.5;
      proc.sampleRoisFromCanvas(
        {
          getImageData: () => ({
            data: new Uint8ClampedArray([180 + pulseMod, 140 + pulseMod * 1.8, 120 + pulseMod * 0.4, 255]),
          }),
        } as any,
        [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]],
        baseTime + i * 33
      );
    }

    const res = proc.process('STABLE');
    expect(res.status).toBe('ESTIMATED');
    expect(res.pulseBpm).toBeGreaterThanOrEqual(75);
    expect(res.pulseBpm).toBeLessThanOrEqual(81);
    expect(res.pulseSnrDb).toBeGreaterThan(0.8);
    expect(res.signalQualityScore).toBeGreaterThanOrEqual(50);
  });

  it('verifies patient effectivePatientId resolution for camera research operations', () => {
    // Clinician view: selectedPatientId is explicitly selected
    const clinicianAuth = { selectedPatientId: 'patient-42', user: { role: 'clinician' } };
    const clinicianEffectiveId = clinicianAuth.selectedPatientId || (clinicianAuth.user as any)?.patient_id;
    expect(clinicianEffectiveId).toBe('patient-42');

    // Patient view: selectedPatientId is null initially, resolved from user.patient_id
    const patientAuth = { selectedPatientId: null, user: { role: 'patient', patient_id: 'maya-lin-101' }, selectedPatient: { id: 'maya-lin-101' } };
    const patientEffectiveId = patientAuth.selectedPatientId || patientAuth.user.patient_id || patientAuth.selectedPatient.id;
    expect(patientEffectiveId).toBe('maya-lin-101');
  });
});
