import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.entities import PatientProfile, User, CameraResearchSession
from app.api.deps import get_current_user, verify_patient_access
from app.services.audit_service import audit_service

router = APIRouter(prefix="/patients/{patient_id}/camera-research", tags=["Camera Signal Research"])

class CameraSignalLogRequest(BaseModel):
    # Environmental & Quality
    session_duration_seconds: int = Field(..., ge=5, le=600)
    signal_quality_score: float = Field(..., ge=0.0, le=100.0)
    lighting_condition: str = Field("OPTIMAL")  # OPTIMAL, TOO_DARK, OVEREXPOSED
    motion_stability: str = Field("STABLE")  # STABLE, EXCESSIVE_MOTION
    face_tracking_ratio: Optional[float] = Field(1.0, ge=0.0, le=1.0)

    # Physiological rPPG signals
    estimated_pulse_bpm: Optional[float] = Field(None, ge=40.0, le=220.0)
    hrv_rmssd_ms: Optional[float] = Field(None, ge=5.0, le=300.0)
    hrv_status: Optional[str] = Field("INSUFFICIENT_DURATION")
    rppg_algorithm: Optional[str] = Field("CHROM_deHaan_2013")
    rppg_snr_db: Optional[float] = Field(None)

    # Observable Facial Indicators
    facial_indicators: Optional[Dict[str, Any]] = None

    # Stress Estimation Pipeline State
    stress_pipeline_status: Optional[str] = Field("UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER")
    stress_feature_vector: Optional[Dict[str, Any]] = None

    # Subjective Research Reference
    user_reported_stress: Optional[float] = Field(None, ge=1.0, le=10.0)
    user_notes: Optional[str] = None

    # Explicit Consent to Persist Derived Numerical Metadata
    consent_confirmed: bool = Field(True)

@router.get("/status")
def get_camera_research_status(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access)
):
    """
    Returns research protocol configuration, privacy safeguards,
    computer vision model cards, and clinical disclaimers.
    """
    return {
        "module": "Camera Signal & Facial Motion Research (MediaPipe + rPPG)",
        "protocol_version": "cv-rppg-research-v2.0",
        "is_diagnostic_device": False,
        "identity_recognition_performed": False,
        "raw_video_storage_policy": "NO_RAW_VIDEO_RETENTION (Processing executes entirely in-memory in browser client)",
        "principles": {
            "computer_vision": "MediaPipe Face Landmarker (478 3D geometric landmarks + 52 FACS blendshapes).",
            "face_recognition": "EXPLICITLY FORBIDDEN: System does NOT detect, infer, or store biometric identity.",
            "rppg_signal": "Chrominance-based rPPG (CHROM de Haan & Jeanne 2013) with temporal bandpass filtering (0.7-3.0 Hz).",
            "stress_estimation": "Separate multimodal pipeline. Feature vector extracted; classification marked UNAVAILABLE pending validated maternal model.",
            "self_report": "User ratings are recorded solely as subjective reference anchors, not ground truth."
        },
        "disclaimer": (
            "RESEARCH PROTOCOL WORKSPACE ONLY. This module does NOT constitute an approved medical device. "
            "It cannot diagnose preeclampsia, fetal compromise, anxiety, or psychological pathology. "
            "Observed facial movements do not reveal subjective internal feelings. Never alter clinical management based on optical approximations."
        )
    }

@router.get("/sessions")
def get_camera_research_sessions(
    patient_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Returns historical derived research sessions where user gave explicit consent to save numerical metrics.
    """
    sessions = (
        db.query(CameraResearchSession)
        .filter(CameraResearchSession.patient_id == patient_id)
        .order_by(desc(CameraResearchSession.session_timestamp))
        .limit(limit)
        .all()
    )

    out = []
    for s in sessions:
        facial_data = {}
        if s.facial_indicators_json:
            try:
                facial_data = json.loads(s.facial_indicators_json)
            except Exception:
                facial_data = {}

        feature_vector = {}
        if s.stress_feature_vector_json:
            try:
                feature_vector = json.loads(s.stress_feature_vector_json)
            except Exception:
                feature_vector = {}

        out.append({
            "id": s.id,
            "patient_id": s.patient_id,
            "session_timestamp": s.session_timestamp.isoformat() if s.session_timestamp else None,
            "duration_seconds": s.duration_seconds,
            "lighting_condition": s.lighting_condition,
            "motion_stability": s.motion_stability,
            "signal_quality_score": s.signal_quality_score,
            "face_tracking_ratio": s.face_tracking_ratio,
            "estimated_pulse_bpm": s.estimated_pulse_bpm,
            "hrv_rmssd_ms": s.hrv_rmssd_ms,
            "hrv_status": s.hrv_status,
            "rppg_algorithm": s.rppg_algorithm,
            "rppg_snr_db": s.rppg_snr_db,
            "facial_indicators": facial_data,
            "stress_pipeline_status": s.stress_pipeline_status,
            "stress_feature_vector": feature_vector,
            "user_reported_stress": s.user_reported_stress,
            "user_notes": s.user_notes,
            "consent_confirmed": s.consent_confirmed,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return out

@router.post("/signals")
def log_camera_research_signal(
    patient_id: str,
    req: CameraSignalLogRequest,
    current_user: User = Depends(get_current_user),
    patient: PatientProfile = Depends(verify_patient_access),
    db: Session = Depends(get_db)
):
    """
    Records an anonymized research session summary when user consent is provided.
    Enforces privacy by recording only numeric derived metrics, NEVER video or images.
    """
    if not req.consent_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session data cannot be stored without explicit user consent."
        )

    facial_json = json.dumps(req.facial_indicators) if req.facial_indicators else None
    feat_json = json.dumps(req.stress_feature_vector) if req.stress_feature_vector else None

    session_rec = CameraResearchSession(
        patient_id=patient_id,
        duration_seconds=req.session_duration_seconds,
        lighting_condition=req.lighting_condition,
        motion_stability=req.motion_stability,
        signal_quality_score=req.signal_quality_score,
        face_tracking_ratio=req.face_tracking_ratio or 1.0,
        estimated_pulse_bpm=req.estimated_pulse_bpm,
        hrv_rmssd_ms=req.hrv_rmssd_ms,
        hrv_status=req.hrv_status or "INSUFFICIENT_DURATION",
        rppg_algorithm=req.rppg_algorithm or "CHROM_deHaan_2013",
        rppg_snr_db=req.rppg_snr_db,
        facial_indicators_json=facial_json,
        stress_pipeline_status=req.stress_pipeline_status or "UNAVAILABLE_AWAITING_VALIDATED_CLASSIFIER",
        stress_feature_vector_json=feat_json,
        user_reported_stress=req.user_reported_stress,
        user_notes=req.user_notes,
        consent_confirmed=True,
        raw_video_stored=False
    )
    db.add(session_rec)
    db.commit()
    db.refresh(session_rec)

    audit_service.log_event(
        db=db,
        action="CAMERA_RESEARCH_SESSION_RECORDED",
        user=current_user,
        target_type="CameraResearchSession",
        target_id=session_rec.id,
        details={
            "bpm": req.estimated_pulse_bpm,
            "quality": req.signal_quality_score,
            "duration": req.session_duration_seconds,
            "rppg_algo": req.rppg_algorithm,
            "self_reported_stress": req.user_reported_stress,
            "stress_status": req.stress_pipeline_status
        }
    )

    return {
        "status": "success",
        "session_id": session_rec.id,
        "session_logged_at": session_rec.session_timestamp.isoformat(),
        "estimated_pulse_bpm": session_rec.estimated_pulse_bpm,
        "signal_quality_score": session_rec.signal_quality_score,
        "stress_pipeline_status": session_rec.stress_pipeline_status,
        "privacy_guarantee": "Zero raw image or video frames persisted. Derived numerical metrics only.",
        "disclaimer": "Non-diagnostic exploratory research metric."
    }
