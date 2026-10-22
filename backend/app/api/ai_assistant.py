import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, verify_patient_access
from app.models.entities import User, AIChatMessage, PatientProfile
from app.schemas.models import AIChatRequest, AIChatResponse, TimeSlotResponse
from app.services.ai_assistant_service import ai_assistant_service

router = APIRouter(prefix="/ai-assistant", tags=["AI Crane Doctor Assistant"])

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_crane_doctor(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Interact with Dr. Crane, the AI Maternal Doctor Assistant:
    1. Authenticate user & verify patient access.
    2. Runs deterministic emergency warning sign detection before LLM.
    3. Enforces strict maternal healthcare topic boundary & prompt injection defenses.
    4. Retrieves authorized clinical context & approved drug monographs.
    5. Returns grounded, personalized clinical answer with mascot animations & slot suggestions.
    """
    verify_patient_access(payload.patient_id, current_user, db)

    try:
        result = await ai_assistant_service.process_patient_message(
            db=db,
            patient_id=payload.patient_id,
            user=current_user,
            message_text=payload.message,
            client_timezone=payload.client_timezone or "UTC"
        )

        formatted_slots = [
            TimeSlotResponse(
                doctor_id=s["doctor_id"],
                doctor_name=s["doctor_name"],
                start_time=s["start_time"],
                end_time=s["end_time"],
                formatted_time=s["formatted_time"],
                formatted_date=s["formatted_date"],
                is_available=s["is_available"]
            )
            for s in result.get("suggested_slots", [])
        ]

        return AIChatResponse(
            message_id=result["message_id"],
            assistant_reply=result["assistant_reply"],
            intent_category=result["intent_category"],
            is_emergency=result.get("is_emergency", False),
            emergency_event_id=result.get("emergency_event_id"),
            emergency_instructions=result.get("emergency_instructions"),
            mascot_expression=result.get("mascot_expression", "caring"),
            suggested_slots=formatted_slots,
            action_taken=result.get("action_taken"),
            grounding_sources=result.get("grounding_sources", []),
            created_at=result["created_at"]
        )
    except Exception as ex:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI processing error: {str(ex)}")

@router.get("/history/{patient_id}")
def get_chat_history(
    patient_id: str,
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve recent chat history with Dr. Crane for an authorized patient."""
    verify_patient_access(patient_id, current_user, db)

    messages = db.query(AIChatMessage).filter(
        AIChatMessage.patient_id == patient_id
    ).order_by(AIChatMessage.created_at.asc()).limit(limit).all()

    formatted = []
    for m in messages:
        sources = []
        if m.sources_json:
            try:
                sources = json.loads(m.sources_json)
            except Exception:
                sources = []

        formatted.append({
            "id": m.id,
            "sender_type": m.sender_type,
            "message_text": m.message_text,
            "intent_category": m.intent_category,
            "is_emergency": m.is_emergency,
            "sources": sources,
            "created_at": m.created_at.isoformat()
        })

    return {"patient_id": patient_id, "messages": formatted}

@router.post("/clear-history/{patient_id}")
def clear_chat_history(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear chat history for a patient (privacy & consent control)."""
    verify_patient_access(patient_id, current_user, db)

    db.query(AIChatMessage).filter(
        AIChatMessage.patient_id == patient_id
    ).delete()
    db.commit()

    return {"status": "success", "message": "Chat history cleared"}
