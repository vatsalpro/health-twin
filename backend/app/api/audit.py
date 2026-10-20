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
def get_system_diagnostics(
    current_user: User = Depends(get_current_user)
):
    """
    Returns system status, active integrations, and clear explanations
    of any unconfigured external services without masking.
    """
    ocr_installed = bool(settings.TESSERACT_CMD and os.path.exists(settings.TESSERACT_CMD)) or bool(shutil.which("tesseract"))
    openai_configured = bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY.strip()) > 5)

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
            "fallback_active": not openai_configured,
            "notice": "Using Deterministic Obstetric Rule Engine with coordinate mapping (OpenAI API key not supplied in .env)" if not openai_configured else "OpenAI integration active"
        },
        "ocr_engine": {
            "configured_engine": settings.OCR_ENGINE,
            "is_installed": ocr_installed,
            "notice": "Tesseract binary detected" if ocr_installed else "Tesseract OCR not detected in system path. Native PyMuPDF text & vector block extraction active."
        },
        "preeclampsia_model": {
            "version": settings.MODEL_VERSION,
            "default_horizon_days": settings.DEFAULT_PREDICTION_HORIZON_DAYS,
            "calibration": "Platt Scaling (logistic sigmoid) with patient-level evaluation",
            "target_outcome": "Clinician-confirmed preeclampsia within 14-day window in patients >= 20.0 weeks GA"
        }
    }
