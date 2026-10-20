import json
import os
import shutil
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.config import settings
from app.models.entities import AuditEvent, User
from app.schemas.models import AuditEventSchema
from app.api.deps import require_clinician, get_current_user
from app.services.document_processor import get_tesseract_cmd
from app.services.ai_extractor import ai_extractor

router = APIRouter(tags=["Audit & Diagnostics"])

@router.get("/audit-history", response_model=List[AuditEventSchema])
def get_audit_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    events = (
        db.query(AuditEvent)
        .order_by(desc(AuditEvent.timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )
    result = []
    for ev in events:
        details = {}
        if ev.details_json:
            try:
                details = json.loads(ev.details_json)
            except Exception:
                pass
        result.append(
            AuditEventSchema(
                id=ev.id,
                user_id=ev.user_id,
                user_email=ev.user_email,
                action=ev.action,
                target_type=ev.target_type,
                target_id=ev.target_id,
                details=details,
                ip_address=ev.ip_address,
                timestamp=ev.timestamp,
            )
        )
    return result

@router.get("/system/diagnostics")
async def get_system_diagnostics(
    current_user: User = Depends(get_current_user)
):
    """
    Returns system status, active integrations, Ollama availability, and clear
    explanations of any unconfigured external services without masking or leaking secrets.
    """
    ocr_cmd = get_tesseract_cmd()
    ocr_installed = bool(ocr_cmd)
    openai_configured = bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY.strip()) > 5)

    # Check local Ollama status
    ollama_status = await ai_extractor.check_ollama_availability()

    is_ollama_active = (
        settings.AI_PROVIDER == "ollama"
        and ollama_status["reachable"]
        and ollama_status["model_available"]
    )

    if is_ollama_active:
        ai_notice = f"Local Ollama active on {settings.OLLAMA_BASE_URL} with model '{settings.OLLAMA_MODEL}' (Latency: {ollama_status.get('latency_ms')}ms)"
        fallback_active = False
    elif settings.AI_PROVIDER == "openai" and openai_configured:
        ai_notice = f"OpenAI integration active with {settings.OPENAI_MODEL}"
        fallback_active = False
    else:
        reason = ollama_status.get("error") if settings.AI_PROVIDER == "ollama" else "OpenAI API key not configured"
        ai_notice = f"Using Deterministic Obstetric Rule Engine with coordinate mapping ({reason})"
        fallback_active = True

    return {
        "status": "OPERATIONAL",
        "demo_mode": settings.DEMO_MODE,
        "database": {
            "type": "SQLite" if settings.DATABASE_URL.startswith("sqlite") else "PostgreSQL",
            "url": settings.DATABASE_URL.split("?")[0]
        },
        "ai_provider": {
            "configured_provider": settings.AI_PROVIDER,
            "openai_api_key_set": openai_configured,
            "openai_model": settings.OPENAI_MODEL if openai_configured else None,
            "ollama_base_url": settings.OLLAMA_BASE_URL,
            "ollama_model": settings.OLLAMA_MODEL,
            "ollama_reachable": ollama_status["reachable"],
            "ollama_model_available": ollama_status["model_available"],
            "ollama_installed_models": ollama_status.get("installed_models", []),
            "ollama_latency_ms": ollama_status.get("latency_ms"),
            "fallback_active": fallback_active,
            "notice": ai_notice
        },
        "ocr_engine": {
            "configured_engine": settings.OCR_ENGINE,
            "is_installed": ocr_installed,
            "tesseract_cmd": ocr_cmd,
            "notice": (
                f"Tesseract OCR binary detected at '{ocr_cmd}'"
                if ocr_installed
                else "Tesseract OCR not detected in system path. Native PyMuPDF text & vector block extraction active for digital PDFs. "
                     "To enable scanned image OCR on Windows, install Tesseract (e.g. from UB-Mannheim: https://github.com/UB-Mannheim/tesseract/wiki) "
                     "and set TESSERACT_CMD='C:\\Program Files\\Tesseract-OCR\\tesseract.exe' in backend/.env."
            )
        },
        "preeclampsia_model": {
            "version": settings.MODEL_VERSION,
            "default_horizon_days": settings.DEFAULT_PREDICTION_HORIZON_DAYS,
            "calibration": "Platt Scaling (logistic sigmoid) with patient-level evaluation",
            "target_outcome": "Clinician-confirmed preeclampsia within 14-day window in patients >= 20.0 weeks GA",
            "evaluation_status": "not_evaluated"
        }
    }
