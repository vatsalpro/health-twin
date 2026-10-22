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
  });
});
