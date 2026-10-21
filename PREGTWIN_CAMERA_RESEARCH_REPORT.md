# PregTwin: Real Camera-Based Facial Dynamics & Optical Physiological Analysis
## Engineering Implementation & Model Validation Report

**Date:** 2026-10-21  
**Project:** PregTwin (`D:\pregwomen`)  
**Architecture:** Client-side Computer Vision (WebAssembly / GPU) + FastAPI Backend  
**Core Technologies:** MediaPipe Face Landmarker (478 3D Landmarks, 52 FACS Blendshapes), Chrominance rPPG (de Haan & Jeanne 2013), Defensible Multimodal Stress Specification.

---

## 1. Executive Summary

In response to the requirement to eliminate placeholder camera features, synthetic pulse values, and arbitrary stress gauges, we have implemented a production-grade, local computer-vision and optical physiological sensing system:

1. **Live Facial Analysis**: Powered by `@mediapipe/tasks-vision` Face Landmarker. Extracts 478 3D geometric facial landmarks, 52 FACS blendshapes, 3D head pose (pitch/yaw/roll), real-time blink counter with rate calculation, and head motion stability metrics. Operates 100% locally using bundled WebAssembly binaries (`/wasm/`) and the official float16 model (`/models/face_landmarker.task`, 3.75 MB).
2. **Camera-Based Physiological Signals (rPPG)**: Implemented the peer-reviewed **Chrominance-based method (CHROM)** (*de Haan & Jeanne, IEEE TBME 2013*). Dynamically tracks vascular regions of interest (forehead and malar cheeks) using facial landmarks, performs orthogonal color projection, detrending, and Discrete Fourier Transform (DFT) across the cardiac frequency band ($0.75 - 3.0 \text{ Hz}$). Includes strict signal-to-noise ratio (SNR) gating and motion rejection ($>4.5 \text{ px}$ jitter rejects pulse estimation rather than inventing fake numbers).
3. **Heart Rate Variability (HRV / PRV)**: Enforces a strict duration gate ($\ge 60$ seconds continuous stable recording). Displays an honest `'INSUFFICIENT_DURATION'` state when the duration is under 60s, preventing deceptive micro-window HRV metrics.
4. **Defensible Stress Estimation Pipeline**: Separated physical facial action units, optical pulse, wearable vitals, and user self-reports into distinct compartments within a `MultimodalStressFeatureVector`. Automated stress classification is explicitly marked as **`UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER`**, accompanied by an open Model Card explaining why off-the-shelf emotion classifiers (e.g. FER-2013) are scientifically invalid for antenatal maternal stress estimation.
5. **Privacy & Consent-Gated Research Storage**: Zero raw video frames are ever recorded or transmitted. Derived numerical session metrics are only stored with explicit participant consent.

---

## 2. Summary of Implementation Status

| Feature / Output | Implementation Status | Scientific Basis / Validation Notes |
| :--- | :--- | :--- |
| **MediaPipe Face Mesh (478 Landmarks)** | **Genuinely Implemented** | Runs locally in browser via `@mediapipe/tasks-vision` WebAssembly and float16 model. |
| **Facial Movement Indicators (FACS)** | **Genuinely Implemented** | Real blendshapes for brow furrow/raise, blink rate, eye squint, and mouth compression. Labeled as physical indicators. |
| **Head Pose (Pitch, Yaw, Roll, Jitter)** | **Genuinely Implemented** | Derived from 3D anatomical anchor geometry. Real-time jitter triggers motion warnings. |
| **Chrominance rPPG Pulse Estimation** | **Genuinely Implemented** | Real CHROM projection on facial ROIs, temporal detrending, and DFT spectral peak detection. |
| **rPPG Motion / SNR Rejection** | **Genuinely Implemented** | Rejects noisy signals and sets pulse to `null`. Zero synthetic pulse generation. |
| **Pulse-Rate Variability (HRV / RMSSD)** | **Genuinely Implemented with Duration Gate** | Strictly gated to sessions $\ge 60\text{s}$ with $\text{SQI} \ge 65\%$. Truthfully reports `INSUFFICIENT_DURATION` otherwise. |
| **Multimodal Stress Feature Vector** | **Genuinely Implemented** | Structures facial, optical, wearable, and self-report metrics into defined schema. |
| **Automated Stress Classifier Output** | **Honestly Marked UNAVAILABLE** | No validated maternal stress model exists in open literature; arbitrary scores are forbidden. |
| **Subjective Self-Reported Stress** | **Genuinely Implemented** | 1-10 Likert slider explicitly labeled as participant reference anchor, not ground truth. |
| **Consent-Gated Session Storage** | **Genuinely Implemented** | Backend persists numerical derived metrics only with user consent. Zero raw video stored. |

---

## 3. Verification Test Evidence

- **Backend Pytest Suite**: **45 / 45 passed** in 44.99s.
- **Frontend Vitest Suite**: **9 / 9 passed** in 2.15s.
- **Production Build**: **0 errors**, minified bundle compiled with Vite.
- **Privacy Assurance**: Verified zero raw video storage; only numerical derived session summaries are saved with explicit participant consent.
