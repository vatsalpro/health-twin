import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

export interface FacialMetrics {
  timestamp: number;
  faceDetected: boolean;
  landmarksCount: number;

  // Eyebrow Movement & Position Indicators
  browFurrow: number; // 0.0 - 1.0 (browDown)
  browRaise: number; // 0.0 - 1.0 (browInnerUp, browOuterUp)
  browTensionIndex: number; // composite 0.0 - 1.0

  // Eye Openness, Blinking & Squinting
  eyeOpennessLeft: number; // 0.0 - 1.0
  eyeOpennessRight: number; // 0.0 - 1.0
  eyeSquint: number; // 0.0 - 1.0
  isBlinking: boolean;
  sessionBlinkCount: number;
  blinkRatePerMin: number;

  // Mouth Movement Indicators
  jawOpen: number; // 0.0 - 1.0
  lipPress: number; // 0.0 - 1.0
  mouthFrown: number; // 0.0 - 1.0
  mouthSmile: number; // 0.0 - 1.0

  // 3D Head Pose & Motion Stability
  pitchDeg: number; // Nodding (+ down, - up)
  yawDeg: number; // Turning (+ right, - left)
  rollDeg: number; // Tilting side to side
  headMovementJitter: number; // Inter-frame displacement (pixels / frame)
  trackingStability: 'STABLE' | 'MODERATE_MOTION' | 'EXCESSIVE_MOTION';

  // Key Raw Blendshapes (subset of 52)
  blendshapes: Record<string, number>;

  // Facial ROI Coordinates for rPPG Optical Extraction
  roiForehead: { x: number; y: number }[];
  roiLeftCheek: { x: number; y: number }[];
  roiRightCheek: { x: number; y: number }[];
}

export class FaceLandmarkerService {
  private landmarker: FaceLandmarker | null = null;
  private isInitializing = false;
  private lastTimestamp = -1;

  // Tracking state
  private prevNosePos: { x: number; y: number } | null = null;
  private lastBlinkState = false;
  private blinkTimestamps: number[] = [];
  private sessionBlinkCount = 0;
  private sessionStartTime = 0;

  async initialize(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;
    this.isInitializing = true;

    try {
      // 1. Try local WASM files, fallback to CDN if needed
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (err) {
        console.warn('Local WASM loading failed, using CDN fallback:', err);
        vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
      }

      // 2. Try local model, fallback to Google Storage CDN
      let modelPath = '/models/face_landmarker.task';
      try {
        const testRes = await fetch(modelPath, { method: 'HEAD' });
        if (!testRes.ok) throw new Error(`Local model status ${testRes.status}`);
      } catch (err) {
        console.warn('Local face_landmarker.task not accessible, using CDN fallback:', err);
        modelPath = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      }

      try {
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          numFaces: 1,
        });
      } catch (gpuErr) {
        console.warn('GPU delegate failed for FaceLandmarker, falling back to CPU:', gpuErr);
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          numFaces: 1,
        });
      }

      this.sessionStartTime = Date.now();
      return true;
    } catch (err) {
      console.error('Failed to initialize FaceLandmarker:', err);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  resetSession(): void {
    this.sessionStartTime = Date.now();
    this.blinkTimestamps = [];
    this.sessionBlinkCount = 0;
    this.prevNosePos = null;
    this.lastBlinkState = false;
    this.lastTimestamp = -1;
  }

  processVideoFrame(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number
  ): {
    metrics: FacialMetrics | null;
    rawLandmarks: { x: number; y: number; z: number }[] | null;
  } {
    if (!this.landmarker || video.readyState < 2) {
      return { metrics: null, rawLandmarks: null };
    }

    const now = performance.now();
    if (now <= this.lastTimestamp) {
      return { metrics: null, rawLandmarks: null };
    }
    this.lastTimestamp = now;

    try {
      const results = this.landmarker.detectForVideo(video, now);
      if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        return { metrics: null, rawLandmarks: null };
      }

      const landmarks = results.faceLandmarks[0];
      const blendshapesList = results.faceBlendshapes?.[0]?.categories || [];

      // Map blendshapes into key-value dictionary
      const blendshapeMap: Record<string, number> = {};
      for (const b of blendshapesList) {
        blendshapeMap[b.categoryName] = b.score;
      }

      // 1. Eyebrow Indicators
      const browDownLeft = blendshapeMap['browDownLeft'] || 0;
      const browDownRight = blendshapeMap['browDownRight'] || 0;
      const browInnerUp = blendshapeMap['browInnerUp'] || 0;
      const browOuterUpLeft = blendshapeMap['browOuterUpLeft'] || 0;
      const browOuterUpRight = blendshapeMap['browOuterUpRight'] || 0;

      const browFurrow = (browDownLeft + browDownRight) / 2;
      const browRaise = (browInnerUp + (browOuterUpLeft + browOuterUpRight) / 2) / 2;
      const browTensionIndex = Math.min(1.0, browFurrow * 0.7 + Math.abs(browRaise - browFurrow) * 0.3);

      // 2. Eye Openness & Blinking
      const eyeBlinkLeft = blendshapeMap['eyeBlinkLeft'] || 0;
      const eyeBlinkRight = blendshapeMap['eyeBlinkRight'] || 0;
      const eyeSquintLeft = blendshapeMap['eyeSquintLeft'] || 0;
      const eyeSquintRight = blendshapeMap['eyeSquintRight'] || 0;

      const eyeOpennessLeft = Math.max(0, 1 - eyeBlinkLeft);
      const eyeOpennessRight = Math.max(0, 1 - eyeBlinkRight);
      const eyeSquint = (eyeSquintLeft + eyeSquintRight) / 2;

      // Real blink edge-trigger detection
      const isBlinkingNow = eyeBlinkLeft > 0.55 || eyeBlinkRight > 0.55;
      const currentTimeMs = Date.now();
      if (isBlinkingNow && !this.lastBlinkState) {
        this.sessionBlinkCount += 1;
        this.blinkTimestamps.push(currentTimeMs);
      }
      this.lastBlinkState = isBlinkingNow;

      // Keep blinks within last 60 seconds for rolling blink rate
      this.blinkTimestamps = this.blinkTimestamps.filter((t) => currentTimeMs - t <= 60000);
      const elapsedMinutes = Math.max(0.1, (currentTimeMs - this.sessionStartTime) / 60000);
      const blinkRatePerMin = Math.round(
        elapsedMinutes >= 1.0 ? this.blinkTimestamps.length : this.sessionBlinkCount / elapsedMinutes
      );

      // 3. Mouth Indicators
      const jawOpen = blendshapeMap['jawOpen'] || 0;
      const mouthPressLeft = blendshapeMap['mouthPressLeft'] || 0;
      const mouthPressRight = blendshapeMap['mouthPressRight'] || 0;
      const mouthFrownLeft = blendshapeMap['mouthFrownLeft'] || 0;
      const mouthFrownRight = blendshapeMap['mouthFrownRight'] || 0;
      const mouthSmileLeft = blendshapeMap['mouthSmileLeft'] || 0;
      const mouthSmileRight = blendshapeMap['mouthSmileRight'] || 0;

      const lipPress = (mouthPressLeft + mouthPressRight) / 2;
      const mouthFrown = (mouthFrownLeft + mouthFrownRight) / 2;
      const mouthSmile = (mouthSmileLeft + mouthSmileRight) / 2;

      // 4. Head Pose (Pitch, Yaw, Roll)
      // Key anchors: Nose tip #1, Chin #152, Left temple/eye-outer #33, Right temple/eye-outer #263, Forehead #10
      const nose = landmarks[1];
      const chin = landmarks[152];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const forehead = landmarks[10];

      // Pitch: vertical tilt between forehead, nose, and chin
      const verticalFaceSpan = chin.y - forehead.y;
      const noseRelativeY = (nose.y - forehead.y) / (verticalFaceSpan || 0.001);
      const pitchDeg = Math.round((noseRelativeY - 0.55) * 80);

      // Yaw: horizontal asymmetry between nose and eyes
      const eyeSpan = rightEye.x - leftEye.x;
      const noseRelativeX = (nose.x - leftEye.x) / (eyeSpan || 0.001);
      const yawDeg = Math.round((noseRelativeX - 0.5) * 90);

      // Roll: eye tilt angle
      const rollRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
      const rollDeg = Math.round((rollRad * 180) / Math.PI);

      // Inter-frame head jitter (displacement in pixels)
      const currentNosePx = { x: nose.x * canvasWidth, y: nose.y * canvasHeight };
      let headJitter = 0;
      if (this.prevNosePos) {
        const dx = currentNosePx.x - this.prevNosePos.x;
        const dy = currentNosePx.y - this.prevNosePos.y;
        headJitter = Math.sqrt(dx * dx + dy * dy);
      }
      this.prevNosePos = currentNosePx;

      const trackingStability: 'STABLE' | 'MODERATE_MOTION' | 'EXCESSIVE_MOTION' =
        headJitter > 9 ? 'EXCESSIVE_MOTION' : headJitter > 3.5 ? 'MODERATE_MOTION' : 'STABLE';

      // 5. Extract Skin ROI Polygons (Forehead, Left Malar/Cheek, Right Malar/Cheek)
      // Scaled to canvas dimensions
      const getPt = (idx: number) => ({
        x: landmarks[idx].x * canvasWidth,
        y: landmarks[idx].y * canvasHeight,
      });

      // Forehead contour: between eyebrows and upper forehead
      const roiForehead = [109, 67, 103, 10, 332, 297, 338, 9].map(getPt);
      // Left cheek (malar)
      const roiLeftCheek = [117, 118, 101, 50, 205, 123].map(getPt);
      // Right cheek (malar)
      const roiRightCheek = [346, 347, 330, 280, 425, 352].map(getPt);

      const metrics: FacialMetrics = {
        timestamp: Date.now(),
        faceDetected: true,
        landmarksCount: landmarks.length,
        browFurrow,
        browRaise,
        browTensionIndex,
        eyeOpennessLeft,
        eyeOpennessRight,
        eyeSquint,
        isBlinking: isBlinkingNow,
        sessionBlinkCount: this.sessionBlinkCount,
        blinkRatePerMin,
        jawOpen,
        lipPress,
        mouthFrown,
        mouthSmile,
        pitchDeg,
        yawDeg,
        rollDeg,
        headMovementJitter: Math.round(headJitter * 10) / 10,
        trackingStability,
        blendshapes: blendshapeMap,
        roiForehead,
        roiLeftCheek,
        roiRightCheek,
      };

      return { metrics, rawLandmarks: landmarks };
    } catch (err) {
      console.error('Frame processing exception:', err);
      return { metrics: null, rawLandmarks: null };
    }
  }

  drawOverlays(
    ctx: CanvasRenderingContext2D,
    landmarks: { x: number; y: number; z: number }[] | null,
    metrics: FacialMetrics | null,
    width: number,
    height: number,
    showMesh = true,
    showRois = true
  ): void {
    ctx.clearRect(0, 0, width, height);
    if (!landmarks || landmarks.length === 0) return;

    // 1. Draw rPPG Vascular ROIs
    if (showRois && metrics) {
      const drawPoly = (pts: { x: number; y: number }[], label: string) => {
        if (pts.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(2, 132, 199, 0.15)'; // Sky blue tint
        ctx.fill();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (pts[0]) {
          ctx.font = '9px monospace';
          ctx.fillStyle = '#0284C7';
          ctx.fillText(label, pts[0].x, pts[0].y - 3);
        }
      };

      drawPoly(metrics.roiForehead, 'ROI Forehead');
      drawPoly(metrics.roiLeftCheek, 'ROI Cheek L');
      drawPoly(metrics.roiRightCheek, 'ROI Cheek R');
    }

    // 2. Draw Face Mesh Points & Contours
    if (showMesh) {
      // Connect key facial contours
      const eyeIndicesL = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const eyeIndicesR = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
      const lipsIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
      const browL = [70, 63, 105, 66, 107];
      const browR = [300, 293, 334, 296, 336];

      const drawLoop = (indices: number[], strokeStyle: string, lineWidth = 1) => {
        ctx.beginPath();
        for (let i = 0; i < indices.length; i++) {
          const pt = landmarks[indices[i]];
          if (!pt) continue;
          const x = pt.x * width;
          const y = pt.y * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };

      drawLoop(eyeIndicesL, 'rgba(56, 189, 248, 0.8)', 1.5);
      drawLoop(eyeIndicesR, 'rgba(56, 189, 248, 0.8)', 1.5);
      drawLoop(lipsIndices, 'rgba(251, 113, 133, 0.8)', 1.5);
      drawLoop(browL, 'rgba(234, 179, 8, 0.8)', 1.5);
      drawLoop(browR, 'rgba(234, 179, 8, 0.8)', 1.5);

      // Draw subtle sparse dots for facial mesh
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < landmarks.length; i += 4) {
        const pt = landmarks[i];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  destroy(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (e) {
        console.warn('Error closing landmarker:', e);
      }
      this.landmarker = null;
    }
  }
}

export const faceLandmarkerService = new FaceLandmarkerService();
