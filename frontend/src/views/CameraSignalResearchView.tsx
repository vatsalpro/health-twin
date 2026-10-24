import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, CameraResearchStatus, CameraResearchSessionRecord } from '../api/client';
import {
  Camera,
  CameraOff,
  AlertTriangle,
  Play,
  Square,
  Sparkles,
  Heart,
  Activity,
  Save,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';
import { faceLandmarkerService, FacialMetrics } from '../services/faceLandmarkerService';
import { rppgProcessor, RppgProcessingResult } from '../services/rppgProcessor';
import { stressAnalysisPipeline, StressEstimationPipelineOutput } from '../services/stressAnalysisPipeline';

export const CameraSignalResearchView: React.FC = () => {
  const { selectedPatientId, selectedPatient, user, allPatients, setSelectedPatientId } = useAuth();
  const effectivePatientId = selectedPatientId || user?.patient_id || selectedPatient?.id || (allPatients && allPatients.length > 0 ? allPatients[0].id : null);

  const [researchMeta, setResearchMeta] = useState<CameraResearchStatus | null>(null);
  const [pastSessions, setPastSessions] = useState<CameraResearchSessionRecord[]>([]);

  // Camera & Stream State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [modelReady, setModelReady] = useState<boolean>(false);

  // Overlay options
  const [showFaceMesh, setShowFaceMesh] = useState<boolean>(true);
  const [showRois, setShowRois] = useState<boolean>(true);

  // Live Metrics State
  const [facialMetrics, setFacialMetrics] = useState<FacialMetrics | null>(null);
  const [rppgResult, setRppgResult] = useState<RppgProcessingResult | null>(null);
  const [stressOutput, setStressOutput] = useState<StressEstimationPipelineOutput | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // Vitals direct sync state
  const [isSavingObservation, setIsSavingObservation] = useState<boolean>(false);
  const [obsSavedMsg, setObsSavedMsg] = useState<string | null>(null);

  // Research Self-Report & Consent
  const [userReportedStress, setUserReportedStress] = useState<number>(5);
  const [userNotes, setUserNotes] = useState<string>('');
  const [consentConfirmed, setConsentConfirmed] = useState<boolean>(true);
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showModelCardModal, setShowModelCardModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'HISTORY'>('WORKSPACE');

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenProcessingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);
  const simulationTickRef = useRef<number>(0);

  // Synchronize patient ID if user is a logged-in patient without explicit selector change
  useEffect(() => {
    if (!selectedPatientId && effectivePatientId) {
      setSelectedPatientId(effectivePatientId);
    }
  }, [selectedPatientId, effectivePatientId, setSelectedPatientId]);

  // Load Status and Sessions
  const loadSessions = async () => {
    if (!effectivePatientId) return;
    try {
      const sessions = await api.getCameraResearchSessions(effectivePatientId);
      setPastSessions(sessions);
    } catch (err) {
      console.warn('Could not load past sessions:', err);
    }
  };

  useEffect(() => {
    if (effectivePatientId) {
      api.getCameraResearchStatus(effectivePatientId).then(setResearchMeta).catch(console.error);
      loadSessions();
    }
  }, [effectivePatientId]);

  // Initialize MediaPipe Face Landmarker on mount
  useEffect(() => {
    let isMounted = true;
    setIsModelLoading(true);
    faceLandmarkerService.initialize().then((success) => {
      if (isMounted) {
        setModelReady(success);
        setIsModelLoading(false);
      }
    });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    stopCamera();
    setIsSimulating(false);
    setCameraError(null);
    setSaveSuccessMsg(null);
    rppgProcessor.reset();
    faceLandmarkerService.resetSession();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCapturing(true);
          setCameraPermission('granted');
          startProcessingLoop();
        };
      }

      setRecordingSeconds(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Webcam error:', err);
      setCameraPermission('denied');
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser settings to perform live optical analysis, or click "Simulate Optical Scan" below.'
          : `Camera hardware could not be initialized: ${err.message || 'Device unavailable'}`
      );
    }
  };

  // Start Simulation / Demo Mode (ideal for offline devices or lighting tests)
  const startSimulation = () => {
    stopCamera();
    setIsSimulating(true);
    setIsCapturing(true);
    setCameraPermission('granted');
    setCameraError(null);
    setSaveSuccessMsg(null);
    setRecordingSeconds(0);
    simulationTickRef.current = 0;

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      overlay.width = 640;
      overlay.height = 480;
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const syntheticWave: number[] = [];

    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    simulationIntervalRef.current = window.setInterval(() => {
      simulationTickRef.current += 1;
      const tick = simulationTickRef.current;
      const t = tick * 0.033; // ~30 fps

      const blinkMod = tick % 110;
      const isBlinking = blinkMod > 104;
      const browFurrow = Math.max(0.08, 0.16 + Math.sin(t * 0.4) * 0.06);
      const lipPress = Math.max(0.05, 0.12 + Math.cos(t * 0.3) * 0.05);
      const pitchDeg = Math.round(Math.sin(t * 0.6) * 1.5 * 10) / 10;
      const yawDeg = Math.round(Math.cos(t * 0.5) * 2.0 * 10) / 10;

      const simMetrics: FacialMetrics = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarksCount: 478,
        browFurrow,
        browRaise: 0.12,
        browTensionIndex: browFurrow,
        eyeOpennessLeft: isBlinking ? 0.05 : 0.88,
        eyeOpennessRight: isBlinking ? 0.05 : 0.88,
        eyeSquint: 0.14,
        isBlinking,
        sessionBlinkCount: Math.floor(tick / 110) + 1,
        blinkRatePerMin: 18,
        jawOpen: 0.04,
        lipPress,
        mouthFrown: 0.06,
        mouthSmile: 0.14,
        pitchDeg,
        yawDeg,
        rollDeg: 0,
        headMovementJitter: 0.4,
        trackingStability: 'STABLE',
        blendshapes: {},
        roiForehead: [
          { x: 260, y: 110 }, { x: 380, y: 110 }, { x: 380, y: 170 }, { x: 260, y: 170 }
        ],
        roiLeftCheek: [
          { x: 210, y: 240 }, { x: 280, y: 240 }, { x: 280, y: 310 }, { x: 210, y: 310 }
        ],
        roiRightCheek: [
          { x: 360, y: 240 }, { x: 430, y: 240 }, { x: 430, y: 310 }, { x: 360, y: 310 }
        ],
      };
      setFacialMetrics(simMetrics);

      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 640, 480);
          drawSyntheticOverlays(ctx, simMetrics);
        }
      }

      const cardiacFreq = 1.233; // 74 bpm
      const pulsePt = Math.sin(2 * Math.PI * cardiacFreq * t) + 0.35 * Math.sin(4 * Math.PI * cardiacFreq * t);
      syntheticWave.push(pulsePt);
      if (syntheticWave.length > 80) syntheticWave.shift();

      const pulseBpm = 74 + Math.round(Math.sin(t * 0.1) * 2);
      const simRppg: RppgProcessingResult = {
        status: 'ESTIMATED',
        durationSeconds: Math.max(1, Math.round(t)),
        bufferProgressPct: 100,
        pulseBpm,
        pulseSnrDb: 3.4,
        signalQualityScore: 86,
        hrvRmssdMs: tick > 600 ? 32.4 : null,
        hrvStatus: tick > 600 ? 'COMPUTED' : 'INSUFFICIENT_DURATION',
        hrvReason: tick > 600
          ? 'Pulse-Rate Variability derived from continuous 60s+ optical peak intervals.'
          : 'Recording duration must exceed 60 continuous seconds of stable signal for HRV analysis.',
        ppgWaveform: [...syntheticWave],
        spectralPeakHz: 1.23,
        cardiacPowerDistribution: [
          { hz: 1.1, power: 0.15 },
          { hz: 1.23, power: 0.95 },
          { hz: 1.35, power: 0.12 },
        ],
        lightingQuality: 'OPTIMAL',
        motionStatus: 'STABLE',
      };
      setRppgResult(simRppg);
      drawPpgWaveform(syntheticWave);

      const stressEval = stressAnalysisPipeline.evaluate(simMetrics, simRppg, userReportedStress);
      setStressOutput(stressEval);
    }, 33);
  };

  const drawSyntheticOverlays = (ctx: CanvasRenderingContext2D, metrics: FacialMetrics) => {
    const cx = 320;
    const cy = 240;

    // Silhouette face contour
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 110, 150, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // Eyes
    const leftEyeOpen = metrics.eyeOpennessLeft;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - 45, cy - 25, 14, Math.max(1, 10 * leftEyeOpen), 0, 0, 2 * Math.PI);
    ctx.ellipse(cx + 45, cy - 25, 14, Math.max(1, 10 * leftEyeOpen), 0, 0, 2 * Math.PI);
    ctx.fill();

    // Eyebrows
    const browY = cy - 45 + metrics.browFurrow * 8;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 65, browY + 2);
    ctx.lineTo(cx - 25, browY);
    ctx.moveTo(cx + 25, browY);
    ctx.lineTo(cx + 65, browY + 2);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 65, 25, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // ROIs
    if (showRois) {
      // Forehead ROI
      ctx.strokeStyle = '#10B981';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - 60, cy - 130, 120, 50);
      ctx.strokeRect(cx - 60, cy - 130, 120, 50);
      ctx.fillStyle = '#10B981';
      ctx.font = '10px monospace';
      ctx.fillText('Forehead ROI', cx - 55, cy - 115);

      // Left Cheek ROI
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(cx - 95, cy + 5, 55, 55);
      ctx.strokeRect(cx - 95, cy + 5, 55, 55);
      ctx.fillStyle = '#10B981';
      ctx.fillText('L Cheek', cx - 90, cy + 25);

      // Right Cheek ROI
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(cx + 40, cy + 5, 55, 55);
      ctx.strokeRect(cx + 40, cy + 5, 55, 55);
      ctx.fillStyle = '#10B981';
      ctx.fillText('R Cheek', cx + 45, cy + 25);
    }
  };

  // Stop Camera & Simulation Stream
  const stopCamera = () => {
    setIsCapturing(false);
    setIsSimulating(false);

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  // Continuous Video Processing Loop
  const startProcessingLoop = () => {
    const loop = () => {
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !overlayCanvas || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
      }

      // 1. Process Frame via MediaPipe Face Landmarker
      const { metrics, rawLandmarks } = faceLandmarkerService.processVideoFrame(video, width, height);
      setFacialMetrics(metrics);

      // 2. Draw Landmark Overlays & ROIs on Canvas
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        faceLandmarkerService.drawOverlays(
          overlayCtx,
          rawLandmarks,
          metrics,
          width,
          height,
          showFaceMesh,
          showRois
        );
      }

      // 3. Process rPPG Chrominance Signal from Skin ROIs
      if (metrics && metrics.faceDetected) {
        let hiddenCanvas = hiddenProcessingCanvasRef.current;
        if (!hiddenCanvas) {
          hiddenCanvas = document.createElement('canvas');
          hiddenProcessingCanvasRef.current = hiddenCanvas;
        }
        if (hiddenCanvas.width !== width || hiddenCanvas.height !== height) {
          hiddenCanvas.width = width;
          hiddenCanvas.height = height;
        }

        const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
        if (hiddenCtx) {
          hiddenCtx.drawImage(video, 0, 0, width, height);

          // Pass the live skin ROIs (forehead + left/right cheeks)
          rppgProcessor.sampleRoisFromCanvas(
            hiddenCtx,
            [metrics.roiForehead, metrics.roiLeftCheek, metrics.roiRightCheek],
            Date.now()
          );
        }
      }

      // 4. Compute rPPG pulse, SNR, and defensible HRV
      const rppgRes = rppgProcessor.process(metrics?.trackingStability || 'STABLE');
      setRppgResult(rppgRes);

      // 5. Draw live PPG Waveform Canvas
      drawPpgWaveform(rppgRes.ppgWaveform);

      // 6. Multimodal Stress Feature Vector Assembly & Spec Evaluation
      const stressEval = stressAnalysisPipeline.evaluate(metrics, rppgRes, userReportedStress);
      setStressOutput(stressEval);

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // Draw Live PPG Waveform
  const drawPpgWaveform = (wave: number[]) => {
    const canvas = ppgCanvasRef.current;
    if (!canvas || wave.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Find min and max for normalization
    let min = Infinity;
    let max = -Infinity;
    for (const val of wave) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
    const range = max - min || 1;

    // Draw smooth pulse waveform
    ctx.beginPath();
    ctx.strokeStyle = '#0284C7'; // Sky-600
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < wave.length; i++) {
      const x = (i / (wave.length - 1)) * w;
      // Invert y: highest blood volume creates peak
      const normY = (wave[i] - min) / range;
      const y = h - 6 - normY * (h - 12);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // Record Heart Rate Directly to Clinical Observation Chart
  const handleRecordVitals = async () => {
    if (!effectivePatientId || !rppgResult?.pulseBpm) return;
    setIsSavingObservation(true);
    setObsSavedMsg(null);
    try {
      await api.createObservation(effectivePatientId, {
        observation_type: 'vital_signs',
        test_name: 'Heart Rate (Optical rPPG)',
        value_numeric: rppgResult.pulseBpm,
        unit: 'bpm',
        reference_range: '60-100 bpm',
        source_type: 'camera_rppg',
      });
      setObsSavedMsg(`Recorded ${rppgResult.pulseBpm} bpm directly into maternal observation vitals chart.`);
      setTimeout(() => setObsSavedMsg(null), 5000);
    } catch (err: any) {
      alert(`Could not record observation: ${err.message || err}`);
    } finally {
      setIsSavingObservation(false);
    }
  };

  // Save Session Derived Data (with Consent)
  const handleSaveSession = async () => {
    if (!effectivePatientId || !facialMetrics) return;

    setIsSavingSession(true);
    setSaveSuccessMsg(null);

    const payload = {
      session_duration_seconds: Math.max(5, recordingSeconds),
      signal_quality_score: rppgResult?.signalQualityScore || 50,
      lighting_condition: rppgResult?.lightingQuality || 'OPTIMAL',
      motion_stability: facialMetrics.trackingStability,
      face_tracking_ratio: 1.0,
      estimated_pulse_bpm: rppgResult?.pulseBpm || undefined,
      hrv_rmssd_ms: rppgResult?.hrvRmssdMs || undefined,
      hrv_status: rppgResult?.hrvStatus || 'INSUFFICIENT_DURATION',
      rppg_algorithm: 'CHROM_deHaan_2013',
      rppg_snr_db: rppgResult?.pulseSnrDb || undefined,
      facial_indicators: {
        brow_furrow: facialMetrics.browFurrow,
        brow_raise: facialMetrics.browRaise,
        eye_openness: (facialMetrics.eyeOpennessLeft + facialMetrics.eyeOpennessRight) / 2,
        blink_rate_bpm: facialMetrics.blinkRatePerMin,
        session_blinks: facialMetrics.sessionBlinkCount,
        jaw_open: facialMetrics.jawOpen,
        lip_press: facialMetrics.lipPress,
        mouth_frown: facialMetrics.mouthFrown,
        head_jitter: facialMetrics.headMovementJitter,
        pitch_deg: facialMetrics.pitchDeg,
        yaw_deg: facialMetrics.yawDeg,
        roll_deg: facialMetrics.rollDeg,
      },
      stress_pipeline_status: stressOutput?.status || 'UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER',
      stress_feature_vector: stressOutput?.featureVector,
      user_reported_stress: userReportedStress,
      user_notes: userNotes || undefined,
      consent_confirmed: consentConfirmed,
    };

    try {
      await api.logCameraSignal(effectivePatientId, payload);
      setSaveSuccessMsg('Derived session metrics and feature vector recorded successfully (Zero raw video persisted).');
      await loadSessions();
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Error saving research session: ${err.message || err}`);
    } finally {
      setIsSavingSession(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="COMPUTER VISION & PHYSIOLOGICAL SENSING"
        title="Facial Dynamics & Remote PPG Research Lab"
        description="Local browser-executed facial landmark tracking (MediaPipe FaceMesh), Chrominance rPPG pulse estimation, and defensible stress feature vector assembly."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab('WORKSPACE')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  activeTab === 'WORKSPACE'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Analysis Workspace
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  activeTab === 'HISTORY'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consented Sessions ({pastSessions.length})
              </button>
            </div>

            {activeTab === 'WORKSPACE' && (
              isCapturing ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Square className="w-4 h-4 fill-white" />}
                  onClick={stopCamera}
                >
                  Stop Session ({recordingSeconds}s)
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="w-4 h-4 fill-white" />}
                    onClick={startCamera}
                    disabled={!modelReady && isModelLoading}
                    isLoading={isModelLoading}
                  >
                    {isModelLoading ? 'Loading Vision Models...' : 'Start Camera Session'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Sparkles className="w-4 h-4 text-sky-600" />}
                    onClick={startSimulation}
                  >
                    Simulate Optical Scan
                  </Button>
                </div>
              )
            )}
          </div>
        }
      />

      {/* Active Participant Header Badge */}
      {effectivePatientId && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Active Maternal Participant:</span>
            <span className="font-mono font-bold text-sky-900">
              {selectedPatient ? selectedPatient.first_name + ' ' + selectedPatient.last_name : user?.full_name || 'Maya Lin'}
            </span>
            <span className="text-slate-500 font-mono">
              ({selectedPatient?.mrn || 'MRN-88421'})
            </span>
          </div>
          <Badge variant="neutral">Longitudinal Cohort Session</Badge>
        </div>
      )}

      {/* Mandatory Non-Diagnostic Clinical Research Disclaimer */}
      <Alert
        variant="warning"
        title="Non-Diagnostic Research Tool & Behavioral Notice"
        description={
          <div>
            <p>
              This workspace extracts <strong>observable physical facial movements</strong> and <strong>optical skin reflectance (rPPG)</strong>.
              Facial expressions do <em>not</em> establish subjective internal feelings or clinical distress.
              No automated stress classifier has been validated in maternal populations, and automated stress scoring is kept strictly unavailable.
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-amber-900">
              <span>• Zero raw video retention</span>
              <span>• No facial identity recognition</span>
              <span>• Non-diagnostic research prototype</span>
            </div>
          </div>
        }
      />

      {cameraError && (
        <div className="space-y-2">
          <Alert
            variant="danger"
            title="Camera Initialization Notice"
            description={cameraError}
          />
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-sky-900 font-medium">Want to evaluate without a physical webcam?</span>
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5 text-sky-600" />}
              onClick={startSimulation}
              className="bg-white"
            >
              Run Synthetic Optical Demo
            </Button>
          </div>
        </div>
      )}

      {saveSuccessMsg && (
        <Alert
          variant="success"
          title="Session Recorded"
          description={saveSuccessMsg}
        />
      )}

      {obsSavedMsg && (
        <Alert
          variant="success"
          title="Vitals Chart Updated"
          description={obsSavedMsg}
        />
      )}

      {activeTab === 'WORKSPACE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 1. Live Camera Workspace Panel */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <CardTitle className="text-sm">Webcam Stream & Landmark Mesh</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isCapturing ? 'success' : 'neutral'}>
                    {isCapturing ? (isSimulating ? `SIM: ${recordingSeconds}s` : `REC: ${recordingSeconds}s`) : 'STANDBY'}
                  </Badge>
                  {isCapturing && (
                    <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-500">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showFaceMesh}
                          onChange={(e) => setShowFaceMesh(e.target.checked)}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span>Mesh</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={showRois}
                          onChange={(e) => setShowRois(e.target.checked)}
                          className="rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span>ROIs</span>
                      </label>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-300 overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Live Video */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover transform -scale-x-100 ${!isCapturing || isSimulating ? 'hidden' : 'block'}`}
                  />

                  {/* Overlaid Canvas with Face Landmarks & ROIs */}
                  <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                      !isCapturing ? 'hidden' : 'block'
                    }`}
                  />

                  {/* Synthetic Mode Badge Overlay */}
                  {isCapturing && isSimulating && (
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-sky-950/85 backdrop-blur border border-sky-400/40 text-sky-200 px-2.5 py-1 rounded-full text-xs font-mono shadow-md">
                      <Sparkles className="w-3.5 h-3.5 text-sky-300 animate-spin" />
                      <span>Synthetic Optical Scan Mode</span>
                    </div>
                  )}

                  {/* Offline / Standby State */}
                  {!isCapturing && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                        <CameraOff className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Camera Offline</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                          Click "Start Camera Session" to begin live optical tracking, or run a simulated optical scan without a webcam.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Play className="w-4 h-4 fill-white" />}
                            onClick={startCamera}
                            disabled={!modelReady && isModelLoading}
                          >
                            Start Camera
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Sparkles className="w-4 h-4 text-sky-400" />}
                            onClick={startSimulation}
                            className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
                          >
                            Simulate Optical Scan
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Real-time Environmental & Tracking Diagnostics */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Ambient Lighting</span>
                    <span
                      className={`font-semibold font-mono ${
                        rppgResult?.lightingQuality === 'OPTIMAL'
                          ? 'text-emerald-700'
                          : rppgResult?.lightingQuality === 'TOO_DARK'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {rppgResult?.lightingQuality || 'STANDBY'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Motion Stability</span>
                    <span
                      className={`font-semibold font-mono ${
                        facialMetrics?.trackingStability === 'STABLE'
                          ? 'text-emerald-700'
                          : facialMetrics?.trackingStability === 'MODERATE_MOTION'
                          ? 'text-amber-700'
                          : facialMetrics?.trackingStability === 'EXCESSIVE_MOTION'
                          ? 'text-rose-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {facialMetrics?.trackingStability || 'STANDBY'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Face Landmarks</span>
                    <span className="font-semibold font-mono text-sky-800">
                      {facialMetrics?.landmarksCount ? `${facialMetrics.landmarksCount} 3D pts` : 'No face detected'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Observable Facial Action Indicators (MediaPipe FACS Analysis) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Observable Facial Movement Indicators</CardTitle>
                    <CardDescription>
                      Physical movement features measured directly by MediaPipe Blendshapes & geometry.
                    </CardDescription>
                  </div>
                  <Badge variant="neutral">FACS Action Units</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Eyebrows */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Brow Furrow</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {facialMetrics ? `${Math.round(facialMetrics.browFurrow * 100)}%` : '--'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">AU4 Corrugator</span>
                  </div>

                  {/* Blinks */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Blink Rate</span>
                    <span className="text-lg font-bold font-mono text-sky-800">
                      {facialMetrics ? `${facialMetrics.blinkRatePerMin}` : '--'}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">/min</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Total: {facialMetrics?.sessionBlinkCount || 0} blinks
                    </span>
                  </div>

                  {/* Eye Openness */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Eye Squint (AU7)</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {facialMetrics ? `${Math.round(facialMetrics.eyeSquint * 100)}%` : '--'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Orbicularis oculi</span>
                  </div>

                  {/* Mouth Compression */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Lip Compression</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {facialMetrics ? `${Math.round(facialMetrics.lipPress * 100)}%` : '--'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">AU24 Orbicularis oris</span>
                  </div>
                </div>

                {/* 3D Head Orientation & Stability */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">Head Pose (Pitch, Yaw, Roll):</span>
                    <span className="font-mono text-slate-600 text-xs">
                      {facialMetrics
                        ? `Pitch: ${facialMetrics.pitchDeg}° • Yaw: ${facialMetrics.yawDeg}° • Roll: ${facialMetrics.rollDeg}°`
                        : 'Pitch: -- • Yaw: -- • Roll: --'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Tracking Jitter</span>
                    <span className="font-mono font-bold text-slate-800">
                      {facialMetrics?.headMovementJitter !== undefined ? `${facialMetrics.headMovementJitter} px` : '--'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Physiological rPPG & Stress Analysis Panels */}
          <div className="lg:col-span-5 space-y-6">
            {/* 3. Physiological Signal Panel (Chrominance rPPG) */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                    <Heart className={`w-4 h-4 text-rose-500 ${isCapturing && rppgResult?.pulseBpm ? 'animate-pulse' : ''}`} />
                    <span>Remote Photoplethysmography (CHROM)</span>
                  </div>
                  <CardTitle className="text-base mt-0.5">Optical Hemodynamic Signal</CardTitle>
                </div>
                <Badge variant={rppgResult?.status === 'ESTIMATED' ? 'success' : 'neutral'}>
                  {rppgResult?.status || 'STANDBY'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pulse Rate display */}
                <div className="flex items-baseline justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Estimated Pulse Rate</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-4xl font-extrabold font-mono text-slate-900">
                        {rppgResult?.pulseBpm ? rppgResult.pulseBpm : '--'}
                      </span>
                      <span className="text-xs font-mono text-slate-500">bpm</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-500 block">Signal-to-Noise Ratio</span>
                    <span className="text-sm font-bold font-mono text-sky-800">
                      {rppgResult?.pulseSnrDb !== null && rppgResult?.pulseSnrDb !== undefined
                        ? `${rppgResult.pulseSnrDb} dB`
                        : '--'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Quality: {rppgResult?.signalQualityScore || 0}% SQI
                    </span>
                  </div>
                </div>

                {/* Direct Sync to Maternal Vitals Chart */}
                {rppgResult?.pulseBpm && (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-sky-950 block">Sync to Clinical Chart</span>
                      <span className="text-[11px] text-sky-700">Record measured optical pulse ({rppgResult.pulseBpm} bpm) into observations.</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs bg-white text-sky-800 border-sky-300 hover:bg-sky-100"
                      icon={<Activity className="w-3.5 h-3.5 text-sky-600" />}
                      onClick={handleRecordVitals}
                      isLoading={isSavingObservation}
                      disabled={isSavingObservation}
                    >
                      Record to Vitals
                    </Button>
                  </div>
                )}

                {/* Status Callout / Convergence Progress */}
                {rppgResult?.status === 'BUFFERING' && (
                  <div className="space-y-1.5 p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900">
                    <div className="flex justify-between font-semibold">
                      <span>Converging optical skin buffer...</span>
                      <span>{rppgResult.bufferProgressPct}%</span>
                    </div>
                    <div className="w-full bg-sky-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-600 h-full transition-all duration-300"
                        style={{ width: `${rppgResult.bufferProgressPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-sky-700 mt-1">{rppgResult.reason}</p>
                  </div>
                )}

                {rppgResult?.status === 'UNUSABLE_SIGNAL' && (
                  <Alert
                    variant="warning"
                    title="Optical Signal Suboptimal"
                    description={rppgResult.reason}
                  />
                )}

                {/* Live Normalized PPG Waveform Canvas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Live Chrominance Pulse Wave (CHROM S-signal)</span>
                    <span className="font-mono text-[10px]">Cardiac Band: 0.75 - 3.0 Hz</span>
                  </div>
                  <div className="h-20 bg-white border border-slate-200 rounded-lg overflow-hidden p-1 shadow-sm">
                    <canvas ref={ppgCanvasRef} width={380} height={72} className="w-full h-full" />
                  </div>
                </div>

                {/* HRV / PRV Status Box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Pulse-Rate Variability (PRV / RMSSD):</span>
                    <Badge variant={rppgResult?.hrvStatus === 'COMPUTED' ? 'success' : 'neutral'}>
                      {rppgResult?.hrvStatus === 'COMPUTED'
                        ? `${rppgResult.hrvRmssdMs} ms`
                        : 'INSUFFICIENT DURATION'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {rppgResult?.hrvReason || 'Requires >= 60 seconds continuous recording without motion.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4. Stress Estimation Pipeline Panel (Defensible ML Approach) */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Sparkles className="w-4 h-4" />
                    <span>Autonomic Arousal & Facial Tension Analysis</span>
                  </div>
                  <CardTitle className="text-base mt-0.5">Physiological Tension & Stress State</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {stressOutput?.tensionIndicator && (
                    <Badge
                      variant={
                        stressOutput.tensionIndicator.category === 'RELAXED_OPTIMAL'
                          ? 'success'
                          : stressOutput.tensionIndicator.category === 'MILD_TENSION'
                          ? 'info'
                          : stressOutput.tensionIndicator.category === 'MODERATE_TENSION'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {stressOutput.tensionIndicator.label.toUpperCase()}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowModelCardModal(true)}
                    icon={<Info className="w-3.5 h-3.5" />}
                  >
                    Model Card
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live Physiological Tension Gauge Meter */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block">Observable Physical Tension Index</span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-extrabold font-mono text-slate-900">
                          {stressOutput?.tensionIndicator?.score !== undefined ? `${stressOutput.tensionIndicator.score}` : '--'}
                        </span>
                        <span className="text-xs font-mono text-slate-500">/ 10</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800 block">
                        {stressOutput?.tensionIndicator?.label || (isCapturing ? 'Analyzing movements...' : 'Standby')}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {stressOutput?.tensionIndicator?.description || 'Start session or run simulation to compute live tension index.'}
                      </span>
                    </div>
                  </div>

                  {/* Tension Meter Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${
                          (stressOutput?.tensionIndicator?.score || 0) < 3.5
                            ? 'bg-emerald-500'
                            : (stressOutput?.tensionIndicator?.score || 0) < 5.5
                            ? 'bg-sky-500'
                            : (stressOutput?.tensionIndicator?.score || 0) < 7.5
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, ((stressOutput?.tensionIndicator?.score || 0) / 10) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>1.0 (Relaxed)</span>
                      <span>5.0 (Moderate)</span>
                      <span>10.0 (Elevated)</span>
                    </div>
                  </div>

                  {/* Component Drivers */}
                  {stressOutput?.tensionIndicator && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Brow Furrow AU4</span>
                        <span className="font-semibold text-slate-800">{stressOutput.tensionIndicator.drivers.browTension.label}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Lip Compression AU24</span>
                        <span className="font-semibold text-slate-800">{stressOutput.tensionIndicator.drivers.lipPress.label}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Blink Cadence</span>
                        <span className="font-semibold text-slate-800">{stressOutput.tensionIndicator.drivers.blinkCadence.label}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Autonomic Cardiac</span>
                        <span className="font-semibold text-slate-800">{stressOutput.tensionIndicator.drivers.pulseArousal.label}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Honest Model Research State Notice */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Maternal Research Specification: Feature Assembly vs. Psychiatric Assessment</span>
                  </div>
                  <p className="text-[11px] text-amber-950 leading-relaxed">
                    PregTwin does not fabricate speculative psychological diagnoses from camera movements alone.
                    Observable facial dynamics and optical cardiac pulses are mapped to physical tension indexes, while automated maternal psychiatric stress classification remains officially marked as awaiting validated prospective clinical cohorts.
                  </p>
                </div>

                {/* Multimodal Feature Vector Breakdown */}
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-slate-800 block">Assembled Feature Vector Dimensions:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-500 block">Facial Action Units</span>
                      <span className="font-bold text-slate-900">
                        {facialMetrics?.faceDetected ? '12 parameters active' : 'Awaiting face'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="text-slate-500 block">Optical Pulse (rPPG)</span>
                      <span className="font-bold text-slate-900">
                        {rppgResult?.pulseBpm ? `${rppgResult.pulseBpm} bpm (${rppgResult.pulseSnrDb} dB)` : 'Converging...'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User-Reported Research Reference */}
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Self-Reported Stress Rating (Subjective Research Anchor):
                    </span>
                    <span className="font-bold font-mono text-sky-800 text-sm">
                      {userReportedStress} / 10
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={userReportedStress}
                    onChange={(e) => setUserReportedStress(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1 (Completely relaxed)</span>
                    <span>5 (Moderate)</span>
                    <span>10 (Extremely high stress)</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Session Research Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Post-resting observation, natural room illumination..."
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  {/* Explicit Consent & Save Controls */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={consentConfirmed}
                        onChange={(e) => setConsentConfirmed(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 mt-0.5"
                      />
                      <span>Consent to save derived numeric metrics (Zero video stored).</span>
                    </label>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveSession}
                      disabled={isSavingSession || !consentConfirmed || !facialMetrics}
                      isLoading={isSavingSession}
                      icon={<Save className="w-3.5 h-3.5" />}
                    >
                      Save Derived Session
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Tab 2: Historical Consented Sessions */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consented Longitudinal Camera Research Sessions ({pastSessions.length})</CardTitle>
            <CardDescription>
              Inspection of derived numerical features and optical pulse measurements recorded with explicit participant consent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pastSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No research sessions recorded yet for this participant. Start an optical session and click "Save Derived Session".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                      <th className="py-2.5 px-3">Session Date</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Optical Pulse (rPPG)</th>
                      <th className="py-2.5 px-3">Signal Quality</th>
                      <th className="py-2.5 px-3">Blink Rate</th>
                      <th className="py-2.5 px-3">Self-Report Stress</th>
                      <th className="py-2.5 px-3">Model State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pastSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {s.session_timestamp ? new Date(s.session_timestamp).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-medium">
                          {s.duration_seconds}s
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-sky-800">
                          {s.estimated_pulse_bpm ? `${s.estimated_pulse_bpm} bpm` : 'Unusable'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={s.signal_quality_score >= 60 ? 'success' : 'warning'}>
                            {s.signal_quality_score}% SQI
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {s.facial_indicators?.blink_rate_bpm ? `${s.facial_indicators.blink_rate_bpm} /min` : '--'}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {s.user_reported_stress !== null && s.user_reported_stress !== undefined ? (
                            <span className="font-semibold text-slate-900">{s.user_reported_stress} / 10</span>
                          ) : (
                            'None'
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="neutral">
                            {s.stress_pipeline_status?.replace('UNAVAILABLE_', '') || 'AWAITING_MODEL'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Model Card Modal */}
      <Modal
        isOpen={showModelCardModal}
        onClose={() => setShowModelCardModal(false)}
        title="Stress Classifier Model Card & Scientific Specification"
        description="Comprehensive technical card detailing why general-purpose emotion models must not be used as stress detectors."
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">Intended Use & Clinical Scope:</span>
            <p>
              Exploratory research protocol for longitudinal sympathetic arousal monitoring.
              This system does <strong>not</strong> detect psychiatric disorders, depression, or clinical preeclampsia.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">Why General Emotion Models Are Disallowed:</span>
            <p>
              Off-the-shelf facial emotion recognition models (e.g. FER-2013, AffectNet) classify momentary superficial facial expressions
              (smiling, frowning) in clean benchmark conditions. They correlate poorly with internal autonomic nervous system activation,
              hormonal stress biomarkers (cortisol, alpha-amylase), or maternal cardiovascular strain.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">Antenatal Cohort Caveats:</span>
            <p>
              Pregnancy involves profound hemodynamic remodeling: maternal blood volume increases by 40-50%, systemic vascular resistance decreases,
              and baseline cardiac output increases. Optical reflectance and pulse transit times differ significantly from non-pregnant cohorts.
              No commercial facial stress detector has been clinically benchmarked or cleared for pregnancy.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">Input Vector Architecture:</span>
            <p className="font-mono text-[11px] text-slate-600">
              [AU4_furrow, AU1_inner_raise, AU7_squint, blink_rate, AU24_lip_press, head_jitter_px, rppg_pulse_bpm, rppg_snr_db, rppg_rmssd_ms, wearable_hr_bpm, user_reported_anchor]
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
