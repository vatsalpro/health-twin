import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.entities import Notification, EmergencyEvent, User, PatientProfile, utc_now

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: str,
        category: str,
        title: str,
        message: str,
        priority: str = "NORMAL",
        patient_id: Optional[str] = None,
        link_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        delivery_status: str = "DELIVERED",
        auto_commit: bool = True
    ) -> Notification:
        """Create and persist a notification in the database."""
        notif = Notification(
            user_id=user_id,
            patient_id=patient_id,
            category=category,
            title=title,
            message=message,
            priority=priority,
            link_url=link_url,
            is_read=False,
            delivery_status=delivery_status,
            metadata_json=json.dumps(metadata) if metadata else None,
            created_at=utc_now()
        )
        db.add(notif)
        if auto_commit:
            db.commit()
            db.refresh(notif)
        return notif

    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Notification]:
        """Retrieve recent notifications for a user."""
        query = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        return query.order_by(desc(Notification.created_at)).limit(limit).all()

    @staticmethod
    def get_unread_count(db: Session, user_id: str) -> Dict[str, Any]:
        """Get unread count breakdown including emergency presence."""
        unread = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).all()
        
        unread_count = len(unread)
        high_priority_count = sum(1 for n in unread if n.priority in ("HIGH", "EMERGENCY"))
        has_emergency = any(n.priority == "EMERGENCY" or n.category == "EMERGENCY_ESCALATION" for n in unread)
        
        return {
            "unread_count": unread_count,
            "high_priority_count": high_priority_count,
            "has_emergency": has_emergency
        }

    @staticmethod
    def mark_as_read(db: Session, notification_id: str, user_id: str) -> Optional[Notification]:
        """Mark a single notification as read if owned by the user."""
        notif = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        if notif and not notif.is_read:
            notif.is_read = True
            notif.read_at = utc_now()
            db.commit()
            db.refresh(notif)
        return notif

    @staticmethod
    def mark_all_as_read(db: Session, user_id: str) -> int:
        """Mark all unread notifications for a user as read."""
        unread = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).all()
        now = utc_now()
        count = len(unread)
        for n in unread:
            n.is_read = True
            n.read_at = now
        if count > 0:
            db.commit()
        return count

    @staticmethod
    def check_emergency_escalations(db: Session, timeout_minutes: int = 15) -> List[EmergencyEvent]:
        """
        Check for unacknowledged critical emergencies that have exceeded the response SLA.
        Escalate to backup care team and generate escalation notifications.
        """
        threshold = utc_now() - timedelta(minutes=timeout_minutes)
        unack_events = db.query(EmergencyEvent).filter(
            EmergencyEvent.status == "ACTIVE",
            EmergencyEvent.created_at <= threshold
        ).all()

        escalated_events = []
        for event in unack_events:
            event.status = "ESCALATED_BACKUP"
            event.escalated_at = utc_now()
            event.delivery_attempts += 1
            escalated_events.append(event)

            # Find all clinician and admin users for backup team notification
            backup_clinicians = db.query(User).filter(
                User.role.in_(["clinician", "admin"]),
                User.is_active == True
            ).all()

            patient = event.patient
            patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"
            mrn = patient.mrn if patient else "Unknown MRN"

            for doc in backup_clinicians:
                NotificationService.create_notification(
                    db=db,
                    user_id=doc.id,
                    patient_id=event.patient_id,
                    category="EMERGENCY_ESCALATION",
                    title=f"BACKUP ESCALATION: Unacknowledged Emergency for {patient_name}",
                    message=(
                        f"CRITICAL ESCALATION: Active emergency reported for {patient_name} ({mrn}) "
                        f"has exceeded the {timeout_minutes}-minute acknowledgement window. "
                        f"Reported symptoms: {event.reported_symptoms}. Urgent clinical review required."
                    ),
                    priority="EMERGENCY",
                    link_url=f"/emergency/{event.id}",
                    metadata={"event_id": event.id, "patient_id": event.patient_id, "escalated": True},
                    auto_commit=False
                )

        if escalated_events:
            db.commit()
            logger.warning(f"Escalated {len(escalated_events)} maternal emergency events to backup team.")

        return escalated_events

notification_service = NotificationService()
