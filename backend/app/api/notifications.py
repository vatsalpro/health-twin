import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.entities import User, Notification
from app.schemas.models import NotificationResponse, NotificationUnreadCountResponse
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def map_notification_to_response(n: Notification) -> NotificationResponse:
    meta = {}
    if n.metadata_json:
        try:
            meta = json.loads(n.metadata_json)
        except Exception:
            meta = {}
    return NotificationResponse(
        id=n.id,
        user_id=n.user_id,
        patient_id=n.patient_id,
        category=n.category,
        title=n.title,
        message=n.message,
        priority=n.priority,
        link_url=n.link_url,
        is_read=n.is_read,
        read_at=n.read_at,
        delivery_status=n.delivery_status,
        metadata=meta,
        created_at=n.created_at
    )

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve notifications for the authenticated user."""
    # Also trigger background escalation check for unacknowledged emergencies
    notification_service.check_emergency_escalations(db, timeout_minutes=15)

    notifications = notification_service.get_user_notifications(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit
    )
    return [map_notification_to_response(n) for n in notifications]

@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of unread and high-priority notifications for the shaking bell badge."""
    counts = notification_service.get_unread_count(db=db, user_id=current_user.id)
    return NotificationUnreadCountResponse(
        unread_count=counts["unread_count"],
        high_priority_count=counts["high_priority_count"],
        has_emergency=counts["has_emergency"]
    )

@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a single notification as read."""
    notif = notification_service.mark_as_read(db=db, notification_id=notification_id, user_id=current_user.id)
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return map_notification_to_response(notif)

@router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all unread notifications for the authenticated user as read."""
    count = notification_service.mark_all_as_read(db=db, user_id=current_user.id)
    return {"status": "success", "marked_read_count": count}
