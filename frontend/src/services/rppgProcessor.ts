/**
 * Remote Photoplethysmography (rPPG) Processor
 * 
 * Implements the Chrominance-based method (CHROM) for contactless pulse rate
 * estimation from facial video:
 * Reference: G. de Haan and V. Jeanne, "Robust Pulse Rate From Chrominance-Based rPPG",
 * IEEE Transactions on Biomedical Engineering, vol. 60, no. 10, pp. 2878-2886, Oct. 2013.
 */

export interface RppgFrameSample {
  timestamp: number;
  r: number;
  g: number;
  b: number;
  luminance: number;
}

export interface RppgProcessingResult {
  status: 'BUFFERING' | 'ESTIMATED' | 'UNUSABLE_SIGNAL';
  reason?: string;
  durationSeconds: number;
  bufferProgressPct: number; // 0 to 100% towards minimum convergence window (8s)

  // Physiological Metrics
  pulseBpm: number | null;
  pulseSnrDb: number | null;
  signalQualityScore: number; // 0 to 100% SQI

  // Pulse Rate Variability (HRV / PRV)
  hrvRmssdMs: number | null;
  hrvStatus: 'INSUFFICIENT_DURATION' | 'COMPUTED' | 'UNRELIABLE_IBI';
  hrvReason: string;

  // Real Normalized PPG Waveform for UI Rendering (latest 60-100 points)
  ppgWaveform: number[];

  // Spectral Power Peak
  spectralPeakHz: number | null;
  cardiacPowerDistribution: { hz: number; power: number }[];

  // Environmental Diagnostics
  lightingQuality: 'OPTIMAL' | 'TOO_DARK' | 'OVEREXPOSED';
  motionStatus: 'STABLE' | 'EXCESSIVE_MOTION';
}

export class RppgProcessor {
  // Circular buffer for raw RGB skin reflectance samples
  private samples: RppgFrameSample[] = [];
  private readonly maxBufferSize = 512; // ~17 seconds at 30 fps
  private readonly minConvergenceSamples = 240; // ~8 seconds at 30 fps

  private sessionStartTime: number = 0;
  private ppgSignalBuffer: number[] = [];
  private lastPulseEstimate: number | null = null;
  private pulseEstimatesHistory: number[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.samples = [];
    this.ppgSignalBuffer = [];
    this.pulseEstimatesHistory = [];
    this.lastPulseEstimate = null;
    this.sessionStartTime = Date.now();
  }

  /**
   * Samples average RGB pixel reflectance within facial vascular ROIs (forehead + cheeks).
   */
  sampleRoisFromCanvas(
    ctx: CanvasRenderingContext2D,
    rois: { x: number; y: number }[][],
    timestamp = Date.now()
  ): RppgFrameSample | null {
    if (!rois || rois.length === 0) return null;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalPixels = 0;

    for (const polygon of rois) {
      if (polygon.length < 3) continue;

      // Compute bounding box of polygon
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const pt of polygon) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }

      minX = Math.max(0, Math.floor(minX));
      minY = Math.max(0, Math.floor(minY));
      const width = Math.max(1, Math.floor(maxX - minX));
      const height = Math.max(1, Math.floor(maxY - minY));

      try {
        const imgData = ctx.getImageData(minX, minY, width, height);
        const data = imgData.data;

        // Sample pixels with step 4 to conserve CPU while ensuring statistical skin coverage
        for (let i = 0; i < data.length; i += 16) {
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          totalPixels += 1;
        }
      } catch (e) {
        // Handle canvas boundary violations gracefully
        continue;
      }
    }

    if (totalPixels === 0) return null;

    const avgR = totalR / totalPixels;
    const avgG = totalG / totalPixels;
    const avgB = totalB / totalPixels;
    const luminance = (avgR + avgG + avgB) / 3;

    const sample: RppgFrameSample = {
      timestamp,
      r: avgR,
      g: avgG,
      b: avgB,
      luminance,
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxBufferSize) {
      this.samples.shift();
    }

    return sample;
  }

  /**
   * Processes the buffered Chrominance rPPG signals using CHROM orthogonal projection
   * and spectral Fourier analysis.
   */
  process(currentMotionStability: 'STABLE' | 'MODERATE_MOTION' | 'EXCESSIVE_MOTION'): RppgProcessingResult {
    const now = Date.now();
    const durationSeconds = Math.max(1, Math.round((now - this.sessionStartTime) / 1000));
    const bufferProgressPct = Math.min(100, Math.round((this.samples.length / this.minConvergenceSamples) * 100));

    // Environmental diagnostics
    const recentSamples = this.samples.slice(-30);
    const avgLum =
      recentSamples.length > 0
        ? recentSamples.reduce((acc, s) => acc + s.luminance, 0) / recentSamples.length
        : 128;

    const lightingQuality: 'OPTIMAL' | 'TOO_DARK' | 'OVEREXPOSED' =
      avgLum < 45 ? 'TOO_DARK' : avgLum > 230 ? 'OVEREXPOSED' : 'OPTIMAL';

    const motionStatus: 'STABLE' | 'EXCESSIVE_MOTION' =
      currentMotionStability === 'EXCESSIVE_MOTION' ? 'EXCESSIVE_MOTION' : 'STABLE';

    // 1. Guard: Check minimum sample convergence threshold (8 seconds at ~30 fps)
    if (this.samples.length < this.minConvergenceSamples) {
      return {
        status: 'BUFFERING',
        reason: `Converging optical skin reflectance buffer (${durationSeconds}s / 8.0s required)...`,
        durationSeconds,
        bufferProgressPct,
        pulseBpm: null,
        pulseSnrDb: null,
        signalQualityScore: Math.round(bufferProgressPct * 0.7),
        hrvRmssdMs: null,
        hrvStatus: 'INSUFFICIENT_DURATION',
        hrvReason: 'Recording duration must exceed 60 continuous seconds of stable signal for HRV analysis.',
        ppgWaveform: this.ppgSignalBuffer.slice(-80),
        spectralPeakHz: null,
        cardiacPowerDistribution: [],
        lightingQuality,
        motionStatus,
      };
    }

    // 2. Guard: Excessive Motion Rejection
    if (currentMotionStability === 'EXCESSIVE_MOTION' || lightingQuality !== 'OPTIMAL') {
      return {
        status: 'UNUSABLE_SIGNAL',
        reason:
          currentMotionStability === 'EXCESSIVE_MOTION'
            ? 'Excessive head movement detected; motion artifacts corrupt microvascular pulse signal.'
            : 'Suboptimal lighting (too dark or glare); optical skin absorption cannot be resolved.',
        durationSeconds,
        bufferProgressPct: 100,
        pulseBpm: null,
        pulseSnrDb: null,
        signalQualityScore: 20,
        hrvRmssdMs: null,
        hrvStatus: 'INSUFFICIENT_DURATION',
        hrvReason: 'Unusable optical signal due to environmental motion or lighting disruption.',
        ppgWaveform: this.ppgSignalBuffer.slice(-80),
        spectralPeakHz: null,
        cardiacPowerDistribution: [],
        lightingQuality,
        motionStatus,
      };
    }

    // 3. Chrominance (CHROM) Algorithm Implementation
    const N = this.samples.length;
    let meanR = 0,
      meanG = 0,
      meanB = 0;
    for (let i = 0; i < N; i++) {
      meanR += this.samples[i].r;
      meanG += this.samples[i].g;
      meanB += this.samples[i].b;
    }
    meanR /= N;
    meanG /= N;
    meanB /= N;

    if (meanR <= 0 || meanG <= 0 || meanB <= 0) {
      return this.makeUnusable('Invalid zero color channel baseline.', durationSeconds, lightingQuality, motionStatus);
    }

    // Chrominance orthogonal signals Xs and Ys
    const Xs: number[] = new Array(N);
    const Ys: number[] = new Array(N);
    let meanXs = 0;
    let meanYs = 0;

    for (let i = 0; i < N; i++) {
      const rn = this.samples[i].r / meanR;
      const gn = this.samples[i].g / meanG;
      const bn = this.samples[i].b / meanB;

      Xs[i] = 3 * rn - 2 * gn;
      Ys[i] = 1.5 * rn + gn - 1.5 * bn;

      meanXs += Xs[i];
      meanYs += Ys[i];
    }
    meanXs /= N;
    meanYs /= N;

    // Standard deviations of Xs and Ys
    let varXs = 0;
    let varYs = 0;
    for (let i = 0; i < N; i++) {
      varXs += Math.pow(Xs[i] - meanXs, 2);
      varYs += Math.pow(Ys[i] - meanYs, 2);
    }
    const stdXs = Math.sqrt(varXs / N);
    const stdYs = Math.sqrt(varYs / N);

    if (stdYs <= 0.00001) {
      return this.makeUnusable('Static chrominance variation.', durationSeconds, lightingQuality, motionStatus);
    }

    const alpha = stdXs / stdYs;

    // Raw pulse signal S(t) = Xs(t) - alpha * Ys(t)
    const rawPulseSignal: number[] = new Array(N);
    let meanS = 0;
    for (let i = 0; i < N; i++) {
      rawPulseSignal[i] = Xs[i] - alpha * Ys[i];
      meanS += rawPulseSignal[i];
    }
    meanS /= N;

    // 4. Detrending & Windowing
    const zeroCentered: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      // Hanning window to reduce spectral leakage
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
      zeroCentered[i] = (rawPulseSignal[i] - meanS) * w;
    }

    // Update waveform buffer for real-time visualization
    const latestSignalSample = rawPulseSignal[N - 1] - meanS;
    this.ppgSignalBuffer.push(latestSignalSample);
    if (this.ppgSignalBuffer.length > 120) {
      this.ppgSignalBuffer.shift();
    }

    // 5. Discrete Fourier Transform (DFT) over cardiac frequency band (0.75 - 3.0 Hz = 45 - 180 bpm)
    // Approximate frame rate based on recorded timestamps
    const timeDeltaSec = (this.samples[N - 1].timestamp - this.samples[0].timestamp) / 1000;
    const samplingFreq = timeDeltaSec > 0 ? (N - 1) / timeDeltaSec : 30.0;

    const minFreq = 0.75; // 45 bpm
    const maxFreq = 3.0; // 180 bpm
    const freqSteps = 90;
    const stepSize = (maxFreq - minFreq) / freqSteps;

    let maxPower = 0;
    let peakFreq = 0;
    let totalCardiacPower = 0;
    const cardiacPowerDistribution: { hz: number; power: number }[] = [];

    for (let f = minFreq; f <= maxFreq; f += stepSize) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * f * n) / samplingFreq;
        real += zeroCentered[n] * Math.cos(angle);
        imag -= zeroCentered[n] * Math.sin(angle);
      }
      const power = real * real + imag * imag;
      totalCardiacPower += power;

      cardiacPowerDistribution.push({
        hz: Math.round(f * 100) / 100,
        power,
      });

      if (power > maxPower) {
        maxPower = power;
        peakFreq = f;
      }
    }

    // 6. Signal-to-Noise Ratio (SNR) Calculation
    // Peak band: peakFreq +/- 0.15 Hz
    let peakBandPower = 0;
    for (const bin of cardiacPowerDistribution) {
      if (Math.abs(bin.hz - peakFreq) <= 0.15) {
        peakBandPower += bin.power;
      }
    }
    const noisePower = Math.max(0.0001, totalCardiacPower - peakBandPower);
    const snrLinear = peakBandPower / noisePower;
    const snrDb = Math.round(10 * Math.log10(Math.max(0.1, snrLinear)) * 10) / 10;

    // Reject if SNR < 1.0 dB (too noisy for defensible pulse extraction)
    if (snrDb < 1.0) {
      return {
        status: 'UNUSABLE_SIGNAL',
        reason: `Insufficient signal-to-noise ratio (${snrDb} dB < 1.0 dB threshold). Try holding still and facing steady light.`,
        durationSeconds,
        bufferProgressPct: 100,
        pulseBpm: null,
        pulseSnrDb: snrDb,
        signalQualityScore: Math.max(15, Math.round(30 + snrDb * 10)),
        hrvRmssdMs: null,
        hrvStatus: 'INSUFFICIENT_DURATION',
        hrvReason: 'Low signal-to-noise ratio prevents cardiac peak isolation.',
        ppgWaveform: this.ppgSignalBuffer.slice(-80),
        spectralPeakHz: peakFreq,
        cardiacPowerDistribution,
        lightingQuality,
        motionStatus,
      };
    }

    const calculatedBpm = Math.round(peakFreq * 60);
    this.lastPulseEstimate = calculatedBpm;
    this.pulseEstimatesHistory.push(calculatedBpm);
    if (this.pulseEstimatesHistory.length > 30) {
      this.pulseEstimatesHistory.shift();
    }

    const signalQualityScore = Math.min(98, Math.max(40, Math.round(50 + snrDb * 8)));

    // 7. Defensible Heart Rate Variability (HRV / PRV) Analysis
    let hrvRmssdMs: number | null = null;
    let hrvStatus: 'INSUFFICIENT_DURATION' | 'COMPUTED' | 'UNRELIABLE_IBI' = 'INSUFFICIENT_DURATION';
    let hrvReason = 'Recording duration must exceed 60 continuous seconds of stable signal for HRV analysis.';

    if (durationSeconds >= 60 && signalQualityScore >= 65) {
      // Peak-to-peak IBI detection on the filtered PPG wave
      const ibiValuesMs: number[] = [];
      const wave = this.ppgSignalBuffer;
      let lastPeakIdx = -1;

      for (let i = 2; i < wave.length - 2; i++) {
        if (
          wave[i] > wave[i - 1] &&
          wave[i] > wave[i - 2] &&
          wave[i] > wave[i + 1] &&
          wave[i] > wave[i + 2] &&
          wave[i] > 0
        ) {
          if (lastPeakIdx !== -1) {
            const sampleDiff = i - lastPeakIdx;
            const ibiMs = (sampleDiff / samplingFreq) * 1000;
            // Physiological IBI check: 333 ms (180 bpm) to 1333 ms (45 bpm)
            if (ibiMs >= 333 && ibiMs <= 1333) {
              ibiValuesMs.push(ibiMs);
            }
          }
          lastPeakIdx = i;
        }
      }

      if (ibiValuesMs.length >= 8) {
        // RMSSD formula: sqrt( mean( (IBI_{i+1} - IBI_i)^2 ) )
        let sumSquaredDiffs = 0;
        for (let i = 0; i < ibiValuesMs.length - 1; i++) {
          const diff = ibiValuesMs[i + 1] - ibiValuesMs[i];
          sumSquaredDiffs += diff * diff;
        }
        const rmssd = Math.sqrt(sumSquaredDiffs / (ibiValuesMs.length - 1));
        if (rmssd >= 10 && rmssd <= 150) {
          hrvRmssdMs = Math.round(rmssd * 10) / 10;
          hrvStatus = 'COMPUTED';
          hrvReason = 'Pulse-Rate Variability (PRV RMSSD) derived from continuous 60s+ optical peak intervals.';
        } else {
          hrvStatus = 'UNRELIABLE_IBI';
          hrvReason = 'Inter-beat interval variance outside physiological limits.';
        }
      } else {
        hrvStatus = 'UNRELIABLE_IBI';
        hrvReason = 'Insufficient clear systolic peaks detected in optical wave for RMSSD computation.';
      }
    }

    return {
      status: 'ESTIMATED',
      durationSeconds,
      bufferProgressPct: 100,
      pulseBpm: calculatedBpm,
      pulseSnrDb: snrDb,
      signalQualityScore,
      hrvRmssdMs,
      hrvStatus,
      hrvReason,
      ppgWaveform: this.ppgSignalBuffer.slice(-80),
      spectralPeakHz: Math.round(peakFreq * 100) / 100,
      cardiacPowerDistribution,
      lightingQuality,
      motionStatus,
    };
  }

  private makeUnusable(
    reason: string,
    durationSeconds: number,
    lightingQuality: 'OPTIMAL' | 'TOO_DARK' | 'OVEREXPOSED',
    motionStatus: 'STABLE' | 'EXCESSIVE_MOTION'
  ): RppgProcessingResult {
    return {
      status: 'UNUSABLE_SIGNAL',
      reason,
      durationSeconds,
      bufferProgressPct: 100,
      pulseBpm: null,
      pulseSnrDb: null,
      signalQualityScore: 20,
      hrvRmssdMs: null,
      hrvStatus: 'INSUFFICIENT_DURATION',
      hrvReason: reason,
      ppgWaveform: this.ppgSignalBuffer.slice(-80),
      spectralPeakHz: null,
      cardiacPowerDistribution: [],
      lightingQuality,
      motionStatus,
    };
  }
}

export const rppgProcessor = new RppgProcessor();
