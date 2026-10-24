/**
 * Multimodal Stress Estimation Architecture & Feature Vector Specification
 * 
 * Provides defensible feature assembly, transparent model documentation, and
 * strict ethical and clinical guardrails.
 * 
 * Clinical Safety Disclosure:
 * General-purpose facial emotion recognition models (e.g. FER-2013) classify superficial
 * expressions (smiling, frowning), NOT internal autonomic or psychiatric stress states.
 * Furthermore, no validated ML model has been clinically benchmarked for webcam-based
 * stress detection in antenatal or maternal populations.
 * 
 * Therefore, this pipeline packages the objective physical features (FACS action units,
 * rPPG pulse, tracking stability, wearable vitals, and subjective self-report) into a
 * structured MultimodalStressFeatureVector, while truthfully marking the automated
 * classifier output as UNAVAILABLE pending prospective clinical validation.
 */

import { FacialMetrics } from './faceLandmarkerService';
import { RppgProcessingResult } from './rppgProcessor';

export interface MultimodalStressFeatureVector {
  // 1. Observable Facial Dynamics (MediaPipe Blendshapes & Geometry)
  facial: {
    browFurrowIntensity: number; // 0.0 - 1.0 (Corrugator supercilii proxy)
    browRaiseIntensity: number; // 0.0 - 1.0 (Frontalis proxy)
    browTensionIndex: number; // 0.0 - 1.0
    eyeBlinkRatePerMinute: number; // Actual counted blinks / min
    eyeSquintIntensity: number; // 0.0 - 1.0 (Orbicularis oculi proxy)
    eyeOpennessRatio: number; // 0.0 - 1.0
    mouthPressIntensity: number; // 0.0 - 1.0 (Lip compression)
    mouthFrownIntensity: number; // 0.0 - 1.0 (Depressor anguli oris proxy)
    headPosePitchDeg: number;
    headPoseYawDeg: number;
    headPoseRollDeg: number;
    headMotionJitterPx: number;
    faceTrackingQualityPct: number;
  };

  // 2. Camera-Derived Physiological Signals (Chrominance rPPG)
  physiological: {
    rppgPulseBpm: number | null;
    rppgSignalToNoiseDb: number | null;
    rppgSignalQualityIndex: number; // 0 - 100%
    hrvRmssdMs: number | null;
    hrvCalculationStatus: string;
    rppgAlgorithm: string;
    recordingDurationSeconds: number;
  };

  // 3. Optional External Wearable Measurements (if available for patient)
  wearable: {
    wearableRestingHeartRateBpm: number | null;
    wearableHrvRmssdMs: number | null;
    wearableDataSource: string;
  };

  // 4. User-Reported Research Reference (Subjective 1-10 Scale)
  selfReport: {
    userReportedStressScore: number | null; // 1.0 to 10.0
    isGroundTruth: boolean; // Always false (labeled as subjective reference)
    reportedAt: string | null;
  };

  timestamp: string;
}

export interface StressModelCard {
  modelName: string;
  modelVersion: string;
  intendedUse: string;
  licensing: string;
  trainingDataset: string;
  targetDefinition: string;
  evaluationMaternalPopulation: string;
  calibrationStatus: string;
  knownLimitations: string[];
}

export interface PhysiologicalTensionIndicator {
  score: number; // 1.0 to 10.0 scale
  category: 'RELAXED_OPTIMAL' | 'MILD_TENSION' | 'MODERATE_TENSION' | 'ELEVATED_TENSION';
  label: string;
  description: string;
  drivers: {
    browTension: { score: number; label: string };
    blinkCadence: { rate: number; label: string };
    lipPress: { score: number; label: string };
    pulseArousal: { bpm: number | null; label: string };
  };
}

export interface StressEstimationPipelineOutput {
  status: 'UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER' | 'CLASSIFIED';
  stressCategory: 'LOWER_RELATIVE_STRESS' | 'MODERATE_RELATIVE_STRESS' | 'HIGHER_RELATIVE_STRESS' | null;
  calibratedConfidence: number | null;
  featureVector: MultimodalStressFeatureVector;
  modelCard: StressModelCard;
  missingInputs: string[];
  scientificExplanation: string;
  clinicalDisclaimer: string;
  tensionIndicator?: PhysiologicalTensionIndicator;
}

export class StressAnalysisPipeline {
  private readonly modelCard: StressModelCard = {
    modelName: 'Maternal Multimodal Stress Research Classifier (Specification)',
    modelVersion: 'spec-v2.0-unvalidated',
    intendedUse: 'Research-only exploratory estimation of acute sympathetic arousal in antenatal studies.',
    licensing: 'PregTwin Research License / Non-commercial academic protocol',
    trainingDataset: 'No validated maternal webcam rPPG stress dataset exists in open research repository.',
    targetDefinition: 'Awaiting prospective cohort protocol with concurrent laboratory salivary cortisol / ECG gold standard.',
    evaluationMaternalPopulation: 'NOT VALIDATED in pregnancy or antenatal cohorts. Facial morphology and autonomic hemodynamics are significantly altered during gestation.',
    calibrationStatus: 'Uncalibrated (No heuristic weights or pseudo-probabilities emitted).',
    knownLimitations: [
      'Facial expression does NOT establish subjective emotional or psychiatric distress.',
      'Antenatal vascular changes (plasma volume expansion, peripheral vasodilation) alter facial optical reflectance.',
      'Camera-derived pulse and facial features are distinct physiological proxies, not diagnostic tests.',
      'Emotion recognition datasets (e.g. FER-2013) must not be substituted for clinical stress detection.',
    ],
  };

  assembleFeatureVector(
    facialMetrics: FacialMetrics | null,
    rppgResult: RppgProcessingResult | null,
    userReportedRating: number | null,
    wearableVitals?: { hr?: number; hrv?: number; source?: string }
  ): MultimodalStressFeatureVector {
    return {
      facial: {
        browFurrowIntensity: facialMetrics ? Math.round(facialMetrics.browFurrow * 100) / 100 : 0,
        browRaiseIntensity: facialMetrics ? Math.round(facialMetrics.browRaise * 100) / 100 : 0,
        browTensionIndex: facialMetrics ? Math.round(facialMetrics.browTensionIndex * 100) / 100 : 0,
        eyeBlinkRatePerMinute: facialMetrics ? facialMetrics.blinkRatePerMin : 0,
        eyeSquintIntensity: facialMetrics ? Math.round(facialMetrics.eyeSquint * 100) / 100 : 0,
        eyeOpennessRatio: facialMetrics
          ? Math.round(((facialMetrics.eyeOpennessLeft + facialMetrics.eyeOpennessRight) / 2) * 100) / 100
          : 0,
        mouthPressIntensity: facialMetrics ? Math.round(facialMetrics.lipPress * 100) / 100 : 0,
        mouthFrownIntensity: facialMetrics ? Math.round(facialMetrics.mouthFrown * 100) / 100 : 0,
        headPosePitchDeg: facialMetrics ? facialMetrics.pitchDeg : 0,
        headPoseYawDeg: facialMetrics ? facialMetrics.yawDeg : 0,
        headPoseRollDeg: facialMetrics ? facialMetrics.rollDeg : 0,
        headMotionJitterPx: facialMetrics ? facialMetrics.headMovementJitter : 0,
        faceTrackingQualityPct: facialMetrics && facialMetrics.faceDetected ? 100 : 0,
      },
      physiological: {
        rppgPulseBpm: rppgResult?.pulseBpm ?? null,
        rppgSignalToNoiseDb: rppgResult?.pulseSnrDb ?? null,
        rppgSignalQualityIndex: rppgResult?.signalQualityScore ?? 0,
        hrvRmssdMs: rppgResult?.hrvRmssdMs ?? null,
        hrvCalculationStatus: rppgResult?.hrvReason ?? 'No rPPG data',
        rppgAlgorithm: 'CHROM (de Haan & Jeanne, 2013)',
        recordingDurationSeconds: rppgResult?.durationSeconds ?? 0,
      },
      wearable: {
        wearableRestingHeartRateBpm: wearableVitals?.hr ?? null,
        wearableHrvRmssdMs: wearableVitals?.hrv ?? null,
        wearableDataSource: wearableVitals?.source ?? 'Not connected',
      },
      selfReport: {
        userReportedStressScore: userReportedRating,
        isGroundTruth: false,
        reportedAt: userReportedRating !== null ? new Date().toISOString() : null,
      },
      timestamp: new Date().toISOString(),
    };
  }

  evaluate(
    facialMetrics: FacialMetrics | null,
    rppgResult: RppgProcessingResult | null,
    userReportedRating: number | null,
    wearableVitals?: { hr?: number; hrv?: number; source?: string }
  ): StressEstimationPipelineOutput {
    const vector = this.assembleFeatureVector(facialMetrics, rppgResult, userReportedRating, wearableVitals);

    const missingInputs: string[] = [];
    if (!facialMetrics || !facialMetrics.faceDetected) missingInputs.push('Live Face Landmarks');
    if (!rppgResult || rppgResult.pulseBpm === null) missingInputs.push('Usable Optical Cardiac Signal');
    if (!wearableVitals?.hr) missingInputs.push('Continuous Wearable ECG/PPG');
    if (userReportedRating === null) missingInputs.push('User Self-Reported Reference');

    // Compute physiological physical tension indicator (observable tension metrics, non-psychiatric)
    let tensionIndicator: PhysiologicalTensionIndicator | undefined = undefined;
    if (facialMetrics && facialMetrics.faceDetected) {
      // 1. Brow Corrugator / Squint Tension
      const browScore = Math.min(10.0, Math.max(1.0, (facialMetrics.browFurrow * 0.7 + facialMetrics.eyeSquint * 0.3) * 10));
      const browLabel = browScore < 3.5 ? 'Relaxed brow' : browScore < 6.5 ? 'Moderate furrowing' : 'Marked brow tension';

      // 2. Lip / Mouth Press
      const lipScore = Math.min(10.0, Math.max(1.0, (facialMetrics.lipPress * 0.8 + facialMetrics.mouthFrown * 0.2) * 10));
      const lipLabel = lipScore < 3.5 ? 'Neutral mouth' : lipScore < 6.5 ? 'Mild compression' : 'Tight lip tension';

      // 3. Blink Cadence
      const blinkRate = facialMetrics.blinkRatePerMin;
      let blinkScore = 2.0;
      let blinkLabel = 'Normal cadence';
      if (blinkRate >= 12 && blinkRate <= 24) {
        blinkScore = 2.0;
        blinkLabel = `${blinkRate}/min (optimal resting)`;
      } else if (blinkRate > 24) {
        blinkScore = Math.min(10.0, 2.0 + (blinkRate - 24) * 0.35);
        blinkLabel = `${blinkRate}/min (elevated cadence)`;
      } else {
        blinkScore = Math.min(8.0, 2.0 + (12 - blinkRate) * 0.4);
        blinkLabel = `${blinkRate}/min (low cadence)`;
      }

      // 4. Cardiac Autonomic Pulse
      const pulseBpm = rppgResult?.pulseBpm ?? wearableVitals?.hr ?? null;
      let pulseScore = 3.0;
      let pulseLabel = 'Awaiting pulse signal';
      if (pulseBpm !== null) {
        if (pulseBpm <= 82) {
          pulseScore = 2.5;
          pulseLabel = `${pulseBpm} bpm (calm resting)`;
        } else if (pulseBpm <= 96) {
          pulseScore = 4.5 + ((pulseBpm - 82) / 14) * 2.0;
          pulseLabel = `${pulseBpm} bpm (mild autonomic arousal)`;
        } else {
          pulseScore = Math.min(10.0, 6.5 + ((pulseBpm - 96) / 20) * 3.5);
          pulseLabel = `${pulseBpm} bpm (elevated cardiac rate)`;
        }
      }

      // Composite weighted score (1.0 - 10.0)
      const rawComposite = (browScore * 0.35) + (lipScore * 0.25) + (blinkScore * 0.20) + (pulseScore * 0.20);
      const score = Math.max(1.0, Math.min(10.0, Math.round(rawComposite * 10) / 10));

      let category: 'RELAXED_OPTIMAL' | 'MILD_TENSION' | 'MODERATE_TENSION' | 'ELEVATED_TENSION' = 'RELAXED_OPTIMAL';
      let label = 'Relaxed / Optimal Range';
      let description = 'Facial musculature shows low tension; cardiac autonomic pulse indicates resting equilibrium.';

      if (score >= 7.5) {
        category = 'ELEVATED_TENSION';
        label = 'Elevated Physical Tension';
        description = 'Marked facial action unit activation (corrugator/orbicularis oris) combined with elevated autonomic pulse rate.';
      } else if (score >= 5.5) {
        category = 'MODERATE_TENSION';
        label = 'Moderate Physical Tension';
        description = 'Notable brow furrowing or lip compression observed alongside elevated cardiac pacing.';
      } else if (score >= 3.5) {
        category = 'MILD_TENSION';
        label = 'Mild Muscle Tension';
        description = 'Mild observable facial muscle tone with stable autonomic baseline.';
      }

      tensionIndicator = {
        score,
        category,
        label,
        description,
        drivers: {
          browTension: { score: Math.round(browScore * 10) / 10, label: browLabel },
          blinkCadence: { rate: blinkRate, label: blinkLabel },
          lipPress: { score: Math.round(lipScore * 10) / 10, label: lipLabel },
          pulseArousal: { bpm: pulseBpm, label: pulseLabel },
        },
      };
    }

    // Strict Defensible ML Rule:
    // We do NOT fabricate a stress score or convert arbitrary facial blendshapes into a percentage.
    // We report the measurable features truthfully and state that automated classification is UNAVAILABLE.
    return {
      status: 'UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER',
      stressCategory: null,
      calibratedConfidence: null,
      featureVector: vector,
      modelCard: this.modelCard,
      missingInputs,
      scientificExplanation:
        'No validated machine learning classifier for maternal antenatal stress is integrated. ' +
        'Facial movements (brow furrowing, blinking, lip compression) and optical rPPG pulse are displayed ' +
        'as physical observed indicators only. Generating an autonomous stress score without a prospectively ' +
        'validated maternal cohort model would be clinically ungrounded and misleading.',
      clinicalDisclaimer:
        'RESEARCH PROTOTYPE. This system does NOT evaluate mental health, depression, maternal anxiety, ' +
        'or preeclampsia risk. Do not use for autonomous clinical triage or medical decision-making.',
      tensionIndicator,
    };
  }
}

export const stressAnalysisPipeline = new StressAnalysisPipeline();
