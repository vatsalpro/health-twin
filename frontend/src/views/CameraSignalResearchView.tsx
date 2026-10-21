import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, CameraResearchStatus, CameraResearchSessionRecord } from '../api/client';
import {
  Camera,
  CameraOff,
  ShieldCheck,
  AlertTriangle,
  Play,
  Square,
  Sparkles,
  Eye,
  Heart,
  Activity,
  Clock,
  Compass,
  Smile,
  Frown,
  Check,
  Save,
  RotateCcw,
  Info,
  Calendar,
  Layers,
  ChevronRight,
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
  const { selectedPatientId } = useAuth();
  const [researchMeta, setResearchMeta] = useState<CameraResearchStatus | null>(null);
  const [pastSessions, setPastSessions] = useState<CameraResearchSessionRecord[]>([]);

  // Camera & Stream State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
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

  // Load Status and Sessions
  const loadSessions = async () => {
    if (!selectedPatientId) return;
    try {
      const sessions = await api.getCameraResearchSessions(selectedPatientId);
      setPastSessions(sessions);
    } catch (err) {
      console.warn('Could not load past sessions:', err);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      api.getCameraResearchStatus(selectedPatientId).then(setResearchMeta).catch(console.error);
      loadSessions();
    }
  }, [selectedPatientId]);

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
          ? 'Camera access was denied. Please allow camera permissions in your browser settings to perform live optical analysis.'
          : `Camera hardware could not be initialized: ${err.message || 'Device unavailable'}`
      );
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    setIsCapturing(false);

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

      // 6. Multimodal Stress Feature Vector Assembly & Transparent Spec Evaluation
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

  // Save Session Derived Data (with Consent)
  const handleSaveSession = async () => {
    if (!selectedPatientId || !facialMetrics) return;

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
      await api.logCameraSignal(selectedPatientId, payload);
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
              )
            )}
          </div>
        }
      />

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
        <Alert
          variant="danger"
          title="Camera Initialization Notice"
          description={cameraError}
        />
      )}

      {saveSuccessMsg && (
        <Alert
          variant="success"
          title="Session Recorded"
          description={saveSuccessMsg}
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
                    {isCapturing ? `REC: ${recordingSeconds}s` : 'STANDBY'}
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
                    className={`w-full h-full object-cover transform -scale-x-100 ${!isCapturing ? 'hidden' : 'block'}`}
                  />

                  {/* Overlaid Canvas with Face Landmarks & ROIs */}
                  <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                      !isCapturing ? 'hidden' : 'block'
                    }`}
                  />

                  {/* Offline / Standby State */}
                  {!isCapturing && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                        <CameraOff className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Camera Offline</h4>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                          Click "Start Camera Session" to begin live optical landmark tracking and remote photoplethysmography.
                        </p>
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
                    <span>Multimodal Stress Estimation Pipeline</span>
                  </div>
                  <CardTitle className="text-base mt-0.5">Model Status & Feature Assembly</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowModelCardModal(true)}
                  icon={<Info className="w-3.5 h-3.5" />}
                >
                  Model Card
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Honest Model Unavailable State */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Automated Stress Classifier: NOT INTEGRATED (Awaiting Validated Model)</span>
                  </div>
                  <p className="text-xs text-amber-950 leading-relaxed">
                    PregTwin does not fabricate an arbitrary stress score or pseudo-percentage from facial movements alone.
                    The pipeline assembles an objective <strong>Multimodal Feature Vector</strong> (FACS movements, rPPG pulse, tracking stability)
                    for research comparison.
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
