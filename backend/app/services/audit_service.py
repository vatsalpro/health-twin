import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import AuditEvent, User

class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        action: str,
        user: Optional[User] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditEvent:
        event = AuditEvent(
            user_id=user.id if user else None,
            user_email=user.email if user else "system",
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            details_json=json.dumps(details or {}),
            ip_address=ip_address
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

audit_service = AuditService()
