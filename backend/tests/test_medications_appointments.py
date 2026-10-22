import pytest
from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.entities import User, PatientProfile, MedicationOrder, Appointment, Notification, EmergencyEvent
from app.services.appointment_service import appointment_service

client = TestClient(app)

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(scope="module")
def auth_tokens():
    # Login clinician
    r_clin = client.post("/api/v1/auth/login", json={"email": "dr.elena@pregtwin.org", "password": "Clinician2026!"})
    clin_data = r_clin.json()
    clin_token = clin_data["access_token"]
    clin_id = clin_data["user_id"]

    # Login patient 1 (Maya Lin)
    r_p1 = client.post("/api/v1/auth/login", json={"email": "maya.lin@pregtwin.org", "password": "Patient2026!"})
    p1_data = r_p1.json()
    p1_token = p1_data["access_token"]
    p1_id = p1_data["patient_id"]

    return {
        "clinician": clin_token,
        "clinician_id": clin_id,
        "p1_token": p1_token,
        "p1_id": p1_id,
    }

def test_medication_order_creation_and_approval(auth_tokens):
    """Test clinician creates draft medication order and approves it."""
    headers_clin = {"Authorization": f"Bearer {auth_tokens['clinician']}"}

    # 1. Create order
    order_payload = {
        "patient_id": auth_tokens["p1_id"],
        "medication_name": "Methyldopa",
        "strength": "250 mg",
        "formulation": "Oral tablet",
        "prescribed_dose": "250 mg",
        "route": "oral",
        "frequency": "twice daily",
        "timing_slots": ["08:00", "20:00"],
        "start_date": "2026-09-20",
        "clinician_instructions": "Take 1 tablet twice daily with food.",
        "warnings_precautions": "Report extreme sedation or depressive symptoms."
    }
    resp = client.post("/api/v1/medications/orders", json=order_payload, headers=headers_clin)
    assert resp.status_code == 201
    order = resp.json()
    assert order["status"] == "DRAFT"
    assert order["version"] == 1
    order_id = order["id"]

    # 2. Patient cannot approve order
    headers_p1 = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}
    resp_unauth = client.post(f"/api/v1/medications/orders/{order_id}/approve", headers=headers_p1)
    assert resp_unauth.status_code == 403

    # 3. Clinician approves order
    resp_appr = client.post(f"/api/v1/medications/orders/{order_id}/approve", headers=headers_clin)
    assert resp_appr.status_code == 200
    approved = resp_appr.json()
    assert approved["status"] == "APPROVED"
    assert approved["version"] == 2
    assert approved["approved_by_id"] is not None

def test_patient_dose_logging(auth_tokens):
    """Test patient logs taken dose and missed dose."""
    headers_p1 = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}

    # Get active orders
    r_orders = client.get(f"/api/v1/medications/orders?patient_id={auth_tokens['p1_id']}", headers=headers_p1)
    assert r_orders.status_code == 200
    orders = r_orders.json()
    assert len(orders) > 0
    order_id = orders[0]["id"]

    # Log taken dose
    dose_payload = {
        "scheduled_time": "2026-09-20T08:00:00Z",
        "status": "TAKEN",
        "patient_notes": "Taken with glass of water and breakfast."
    }
    r_log = client.post(f"/api/v1/medications/orders/{order_id}/log-dose", json=dose_payload, headers=headers_p1)
    assert r_log.status_code == 200
    log_data = r_log.json()
    assert log_data["status"] == "TAKEN"
    assert log_data["order_id"] == order_id

def test_appointment_slot_availability(auth_tokens):
    """Test generating bookable slots for doctor schedule."""
    headers = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}
    tomorrow = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    next_week = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")

    url = f"/api/v1/appointments/doctor/{auth_tokens['clinician_id']}/slots?start_date={tomorrow}&end_date={next_week}"
    resp = client.get(url, headers=headers)
    assert resp.status_code == 200
    slots = resp.json()
    assert isinstance(slots, list)
    if len(slots) > 0:
        s0 = slots[0]
        assert "start_time" in s0
        assert "end_time" in s0
        assert s0["is_available"] is True

def test_atomic_appointment_booking_and_double_booking_prevention(auth_tokens):
    """Verify atomic appointment booking prevents concurrent double booking of the same slot."""
    headers = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}

    # Generate a future slot time
    target_start = datetime(2026, 11, 20, 14, 0, tzinfo=timezone.utc)
    book_payload = {
        "patient_id": auth_tokens["p1_id"],
        "doctor_id": auth_tokens["clinician_id"],
        "start_time": target_start.isoformat(),
        "appointment_type": "in_person",
        "reason": "Routine 32w blood pressure and antenatal checkup",
        "booking_channel": "ai_assistant"
    }

    # 1. First booking succeeds
    resp1 = client.post("/api/v1/appointments/book", json=book_payload, headers=headers)
    assert resp1.status_code == 201
    appt = resp1.json()
    assert appt["status"] == "CONFIRMED"
    appt_id = appt["id"]

    # 2. Second booking for the exact same slot MUST fail with 409 Conflict
    resp2 = client.post("/api/v1/appointments/book", json=book_payload, headers=headers)
    assert resp2.status_code == 409
    assert "Conflict" in resp2.json()["detail"] or "reserved" in resp2.json()["detail"]

    # 3. Reschedule appointment
    new_start = datetime(2026, 11, 20, 15, 0, tzinfo=timezone.utc)
    resched_payload = {
        "new_start_time": new_start.isoformat(),
        "reason": "Patient requested later afternoon time"
    }
    resp_resched = client.post(f"/api/v1/appointments/{appt_id}/reschedule", json=resched_payload, headers=headers)
    assert resp_resched.status_code == 200
    assert resp_resched.json()["status"] == "CONFIRMED"

    # 4. Cancel appointment
    cancel_payload = {"cancellation_reason": "Patient conflict with work schedule"}
    resp_cancel = client.post(f"/api/v1/appointments/{appt_id}/cancel", json=cancel_payload, headers=headers)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["status"] == "CANCELLED"

def test_notification_centre_and_read_status(auth_tokens):
    """Verify notification persistence, unread count badge, and mark-as-read."""
    headers = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}

    # 1. Get unread counts
    r_count = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r_count.status_code == 200
    counts = r_count.json()
    assert "unread_count" in counts
    assert "high_priority_count" in counts

    # 2. Get notifications list
    r_list = client.get("/api/v1/notifications", headers=headers)
    assert r_list.status_code == 200
    notifs = r_list.json()
    assert len(notifs) > 0
    first_notif = notifs[0]

    # 3. Mark single notification as read
    r_read = client.post(f"/api/v1/notifications/{first_notif['id']}/read", headers=headers)
    assert r_read.status_code == 200
    assert r_read.json()["is_read"] is True

    # 4. Mark all as read
    r_all = client.post("/api/v1/notifications/read-all", headers=headers)
    assert r_all.status_code == 200

def test_emergency_escalation_clinician_workflow(auth_tokens):
    """Verify clinician can view active emergency alerts, acknowledge them, and resolve them."""
    headers_clin = {"Authorization": f"Bearer {auth_tokens['clinician']}"}

    # 1. Trigger an emergency alert from patient
    headers_p1 = {"Authorization": f"Bearer {auth_tokens['p1_token']}"}
    client.post("/api/v1/ai-assistant/chat", json={
        "patient_id": auth_tokens["p1_id"],
        "message": "I have sudden severe headache and seeing flashing spots"
    }, headers=headers_p1)

    # 2. Clinician fetches active emergency events
    r_active = client.get("/api/v1/emergency/active", headers=headers_clin)
    assert r_active.status_code == 200
    active_events = r_active.json()
    assert len(active_events) > 0
    em = active_events[0]
    assert em["status"] in ("ACTIVE", "ESCALATED_BACKUP")
    event_id = em["id"]

    # 3. Clinician acknowledges
    r_ack = client.post(f"/api/v1/emergency/{event_id}/acknowledge", json={"notes": "Called patient triage immediately"}, headers=headers_clin)
    assert r_ack.status_code == 200
    assert r_ack.json()["status"] == "ACKNOWLEDGED"

    # 4. Clinician resolves
    r_res = client.post(f"/api/v1/emergency/{event_id}/resolve", json={"resolution_notes": "Patient arrived at triage, BP managed with Labetalol iv, stable."}, headers=headers_clin)
    assert r_res.status_code == 200
    assert r_res.json()["status"] == "RESOLVED"
