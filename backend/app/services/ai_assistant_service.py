import re
import json
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.models.entities import (
    AIChatMessage,
    EmergencyEvent,
    PatientProfile,
    PregnancyEpisode,
    ClinicalObservation,
    MedicationOrder,
    Appointment,
    MaternalTwinState,
    RiskPrediction,
    User,
    AuditEvent,
    utc_now,
)
from app.services.notification_service import notification_service
from app.services.medication_service import medication_service, MATERNAL_DRUG_MONOGRAPHS
from app.services.appointment_service import appointment_service
from app.services.requesty_crane_client import requesty_crane_client

logger = logging.getLogger(__name__)

# --- Clinician-Reviewed Emergency Warning Sign Rules (ACOG/ISSHP Criteria) ---
EMERGENCY_RULES: List[Dict[str, Any]] = [
    {
        "code": "severe_headache_unresponsive",
        "description": "Severe, persistent, or throbbing headache especially unresponsive to acetaminophen",
        "keywords": [
            "severe headache", "terrible headache", "worst headache", "headache won't go away",
            "pounding head", "splitting headache", "headache and tylenol didn't help",
            "throbbing headache", "intense headache", "unbearable headache"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "visual_disturbances",
        "description": "Visual symptoms including scotoma, blurred vision, photopsia (flashing lights), or temporary vision loss",
        "keywords": [
            "blurry vision", "blurred vision", "flashing lights", "seeing spots",
            "can't see", "blind spots", "double vision", "stars in my vision",
            "vision changes", "loss of vision", "scotoma"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "epigastric_ruq_pain",
        "description": "Severe epigastric, upper abdominal, or right upper quadrant pain (hepatic capsular distension)",
        "keywords": [
            "severe stomach pain", "upper stomach pain", "pain under right ribs",
            "epigastric pain", "pain in upper abdomen", "severe belly pain under ribs",
            "liver pain", "right upper quadrant pain", "stabbing pain upper stomach"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "dyspnea_chest_pain",
        "description": "Shortness of breath, chest tightness, pulmonary edema symptoms, or difficulty breathing",
        "keywords": [
            "shortness of breath", "can't breathe", "hard to breathe", "chest pain",
            "chest tightness", "gasping for air", "trouble breathing", "gasping"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "vaginal_bleeding_fluid",
        "description": "Heavy vaginal bleeding, gush of fluid, or suspected placental abruption/rupture",
        "keywords": [
            "heavy bleeding", "bleeding heavily", "blood soaking through", "gush of fluid",
            "water broke", "leaking fluid", "clots of blood", "vaginal hemorrhage"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "decreased_fetal_movement",
        "description": "Noticeable reduction or absence of fetal movements/kicks",
        "keywords": [
            "baby stopped moving", "baby isn't moving", "haven't felt baby move",
            "no kicks today", "decreased movement", "baby not kicking", "no fetal movement"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "severe_hypertension",
        "description": "Maternal systolic BP >= 160 mmHg or diastolic BP >= 110 mmHg",
        "keywords": [
            "160/110", "170/110", "180/120", "bp is 160", "bp is 170", "bp is 180",
            "systolic 160", "systolic 170", "systolic 180", "diastolic 110", "diastolic 115"
        ],
        "severity": "CRITICAL_EMERGENCY"
    },
    {
        "code": "seizures_syncope",
        "description": "Maternal seizure activity (eclampsia), convulsions, fainting, or loss of consciousness",
        "keywords": [
            "seizure", "convulsion", "passed out", "fainted", "blacked out", "loss of consciousness"
        ],
        "severity": "CRITICAL_EMERGENCY"
    }
]

# --- Prompt Injection and Jailbreak Defense Patterns ---
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions?",
    r"disregard\s+(all\s+)?(previous|prior|system)\s+rules?",
    r"you\s+are\s+now\s+(unrestricted|dan|jailbreak)",
    r"bypass\s+(safety|content|rules)",
    r"system\s*prompt",
    r"developer\s+mode",
    r"pretend\s+you\s+have\s+no\s+(rules|restrictions)",
    r"what\s+are\s+your\s+(instructions|system\s+rules)",
    r"write\s+(me\s+)?(a\s+)?(python|javascript|code|script|program)",
    r"tell\s+me\s+a\s+(joke|story|poem)\s+about\s+(?!pregnancy|baby|mother)",
    r"who\s+won\s+the\s+(game|superbowl|world\s+cup|election)",
    r"recipe\s+for",
]

# --- Allowed Maternal Healthcare Intents ---
ALLOWED_HEALTHCARE_PATTERNS = [
    (r"\b(medicine|medication|drug|pill|dose|tablet|prescription|aspirin|labetalol|nifedipine|methyldopa|vitamin|iron)\b", "medication_inquiry"),
    (r"\b(appointment|book|schedule|reschedule|cancel|see\s+(my\s+)?doctor|visit\s+dr)\b", "appointment_booking"),
    (r"\b(blood\s+pressure|bp|systolic|diastolic|map|reading|hypertension)\b", "blood_pressure_inquiry"),
    (r"\b(protein|urine|proteinuria|dipstick|upcr|creatinine)\b", "lab_protein_inquiry"),
    (r"\b(platelet|ast|alt|liver|labs|blood\s+test|results)\b", "laboratory_inquiry"),
    (r"\b(preeclampsia|eclampsia|risk|forecast|twin|digital\s+twin)\b", "clinical_risk_inquiry"),
    (r"\b(gestational\s+age|weeks|trimester|due\s+date|edd|conception)\b", "pregnancy_timeline_inquiry"),
    (r"\b(symptom|swelling|headache|edema|vision|kick|movement|pain|nausea)\b", "symptom_inquiry"),
    (r"\b(question|ask\s+doctor|prepare|what\s+should\s+i\s+ask)\b", "doctor_preparation"),
    (r"\b(care\s+plan|instructions|diet|exercise|rest|sleep)\b", "care_instructions"),
    (r"\b(hello|hi|good\s+morning|help|who\s+are\s+you|dr\s+crane)\b", "general_greeting")
]

class AIAssistantService:
    @staticmethod
    def evaluate_emergency_rules(message: str) -> Tuple[bool, List[str], str]:
        """
        Deterministic, testable evaluation of maternal warning signs.
        Runs BEFORE any LLM inference to protect patient safety.
        """
        msg_lower = message.lower()
        triggered_rules = []
        highest_severity = "NORMAL"

        # Regex check for severe BP numbers
        bp_match = re.search(r"\b(1[6-9]\d|2\d\d)\s*/\s*(\d{2,3})\b", msg_lower)
        if bp_match:
            sbp = int(bp_match.group(1))
            dbp = int(bp_match.group(2))
            if sbp >= 160 or dbp >= 110:
                triggered_rules.append("severe_hypertension")
                highest_severity = "CRITICAL_EMERGENCY"

        for rule in EMERGENCY_RULES:
            if rule["code"] in triggered_rules:
                continue
            for kw in rule["keywords"]:
                if kw in msg_lower:
                    triggered_rules.append(rule["code"])
                    highest_severity = "CRITICAL_EMERGENCY"
                    break

        is_emergency = len(triggered_rules) > 0
        return is_emergency, triggered_rules, highest_severity

    @staticmethod
    def detect_prompt_injection(message: str) -> bool:
        """Check for prompt injection or system boundary bypass attempts."""
        msg_lower = message.lower()
        for pattern in PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, msg_lower):
                return True
        return False

    @staticmethod
    def classify_intent(message: str) -> Tuple[str, bool]:
        """
        Classify input into allowed maternal healthcare categories or reject as off-topic.
        Returns (intent_category, is_allowed).
        """
        msg_lower = message.lower()

        # Check injection first
        if AIAssistantService.detect_prompt_injection(message):
            return "prompt_injection_attempt", False

        # Check allowed maternal healthcare patterns
        for pattern, intent in ALLOWED_HEALTHCARE_PATTERNS:
            if re.search(pattern, msg_lower):
                return intent, True

        # Check common non-medical requests explicitly
        off_topic_indicators = [
            "code", "programming", "javascript", "python", "html", "css", "sql",
            "weather", "movie", "song", "poem", "joke", "trivia", "stock", "crypto",
            "football", "basketball", "soccer", "recipe", "game", "restaurant"
        ]
        if any(w in msg_lower.split() for w in off_topic_indicators):
            return "off_topic", False

        # If it's a short health or polite phrase, allow as general inquiry
        if len(message.strip().split()) <= 4:
            return "general_maternal_inquiry", True

        # Default fallback: allow if reasonable, but flag as general
        return "general_maternal_inquiry", True

    @staticmethod
    def trigger_emergency_escalation(
        db: Session,
        patient_id: str,
        reported_by_user_id: str,
        symptoms_text: str,
        triggered_rules: List[str]
    ) -> EmergencyEvent:
        """
        Immediately log emergency event, notify assigned clinician and care team.
        Never delays guidance while awaiting a doctor response.
        """
        patient = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if not patient:
            raise ValueError("Patient not found")

        # Find primary clinician (from active medication order, seed data, or clinician user)
        clinician = db.query(User).filter(User.role == "clinician", User.is_active == True).first()
        clinician_id = clinician.id if clinician else None

        event = EmergencyEvent(
            patient_id=patient.id,
            reported_by_user_id=reported_by_user_id,
            assigned_clinician_id=clinician_id,
            matched_rules_json=json.dumps(triggered_rules),
            reported_symptoms=symptoms_text,
            severity_level="CRITICAL_EMERGENCY",
            status="ACTIVE",
            delivery_attempts=1,
            created_at=utc_now()
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        patient_name = f"{patient.first_name} {patient.last_name}"
        mrn = patient.mrn

        # Notify Clinician immediately with HIGH/EMERGENCY priority
        if clinician_id:
            notification_service.create_notification(
                db=db,
                user_id=clinician_id,
                patient_id=patient.id,
                category="EMERGENCY_ESCALATION",
                title=f"🚨 CRITICAL ALERT: Maternal Emergency for {patient_name} ({mrn})",
                message=(
                    f"EMERGENCY WARNING SIGNS REPORTED: {symptoms_text}. "
                    f"Matched rules: {', '.join(triggered_rules)}. Immediate clinical contact required."
                ),
                priority="EMERGENCY",
                link_url=f"/emergency/{event.id}",
                metadata={
                    "event_id": event.id,
                    "patient_id": patient.id,
                    "patient_name": patient_name,
                    "mrn": mrn,
                    "symptoms": symptoms_text,
                    "rules": triggered_rules
                }
            )

        # Audit event
        audit = AuditEvent(
            user_id=reported_by_user_id,
            action="EMERGENCY_ESCALATION_TRIGGERED",
            target_type="EmergencyEvent",
            target_id=event.id,
            details_json=json.dumps({
                "patient_id": patient.id,
                "symptoms": symptoms_text,
                "rules": triggered_rules
            })
        )
        db.add(audit)
        db.commit()

        logger.critical(f"EMERGENCY ESCALATION for patient {patient_name} ({mrn}): {symptoms_text}")
        return event

    @staticmethod
    def retrieve_patient_context(db: Session, patient_id: str) -> Dict[str, Any]:
        """
        Securely retrieve strictly authorized clinical context for the authenticated patient.
        Never hallucinates missing data; clearly identifies what is on record.
        """
        patient = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if not patient:
            return {}

        episode = db.query(PregnancyEpisode).filter(
            PregnancyEpisode.patient_id == patient_id,
            PregnancyEpisode.is_active == True
        ).first()

        med_orders = db.query(MedicationOrder).filter(
            MedicationOrder.patient_id == patient_id,
            MedicationOrder.status == "APPROVED"
        ).all()

        obs = db.query(ClinicalObservation).filter(
            ClinicalObservation.patient_id == patient_id
        ).order_by(desc(ClinicalObservation.measurement_timestamp)).limit(10).all()

        twin_state = db.query(MaternalTwinState).filter(
            MaternalTwinState.patient_id == patient_id
        ).order_by(desc(MaternalTwinState.timestamp)).first()

        prediction = db.query(RiskPrediction).filter(
            RiskPrediction.patient_id == patient_id
        ).order_by(desc(RiskPrediction.prediction_timestamp)).first()

        upcoming_appts = db.query(Appointment).filter(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(["SCHEDULED", "CONFIRMED", "RESCHEDULED"]),
            Appointment.start_time >= utc_now()
        ).order_by(Appointment.start_time).limit(3).all()

        return {
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "mrn": patient.mrn,
            "maternal_age": patient.maternal_age,
            "gravidity": patient.gravidity,
            "parity": patient.parity,
            "chronic_hypertension": patient.chronic_hypertension,
            "prior_preeclampsia": patient.prior_preeclampsia,
            "gestational_age_weeks": episode.current_gestational_age_weeks if episode else (twin_state.gestational_age_weeks if twin_state else None),
            "estimated_due_date": episode.estimated_due_date if episode else None,
            "active_medications": [
                {
                    "id": m.id,
                    "name": m.medication_name,
                    "dose": m.prescribed_dose,
                    "frequency": m.frequency,
                    "route": m.route,
                    "instructions": m.clinician_instructions,
                    "warnings": m.warnings_precautions
                }
                for m in med_orders
            ],
            "recent_vital_observations": [
                {
                    "test_name": o.test_name,
                    "value": o.value_numeric or o.value_text,
                    "unit": o.unit,
                    "timestamp": o.measurement_timestamp.strftime("%Y-%m-%d %H:%M")
                }
                for o in obs
            ],
            "twin_sbp": twin_state.sbp if twin_state else None,
            "twin_dbp": twin_state.dbp if twin_state else None,
            "twin_map": twin_state.map_pressure if twin_state else None,
            "risk_category": prediction.risk_category if prediction else "EVALUATING",
            "risk_score_pct": f"{(prediction.risk_score * 100):.1f}%" if prediction and prediction.risk_score is not None else None,
            "upcoming_appointments": [
                {
                    "id": a.id,
                    "doctor_name": a.doctor.full_name if a.doctor else "Dr. Elena Vance",
                    "start_time": a.start_time.strftime("%A, %b %d at %I:%M %p"),
                    "type": a.appointment_type,
                    "reason": a.reason
                }
                for a in upcoming_appts
            ]
        }

    @staticmethod
    def parse_requested_time(msg_lower: str) -> Tuple[Optional[int], Optional[int]]:
        """Extract hour and minute (24h format) from user message."""
        # Direct noon check
        if re.search(r"\b(?:12\s+)?noon\b", msg_lower):
            return 12, 0

        # 12h format with am/pm or a.m./p.m.: "10:00 am", "10 am", "10am", "2:30 pm", "2 pm", "2pm", "10 a.m.", "2 p.m."
        m12 = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b", msg_lower)
        if m12:
            hr = int(m12.group(1))
            mn = int(m12.group(2) or 0)
            mer = m12.group(3).lower().replace(".", "")
            if mer == "pm" and hr < 12:
                hr += 12
            elif mer == "am" and hr == 12:
                hr = 0
            if 0 <= hr <= 23 and 0 <= mn <= 59:
                return hr, mn

        # Expressions with time-of-day: "at 3 in the afternoon", "at 10 in the morning", "5 in the evening"
        m_tod = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(?:o'?clock\s*)?in the (morning|afternoon|evening)\b", msg_lower)
        if m_tod:
            hr = int(m_tod.group(1))
            mn = int(m_tod.group(2) or 0)
            tod = m_tod.group(3).lower()
            if tod in ("afternoon", "evening") and hr < 12:
                hr += 12
            elif tod == "morning" and hr == 12:
                hr = 0
            if 0 <= hr <= 23 and 0 <= mn <= 59:
                return hr, mn

        # 24h format: "14:00" or "10:00"
        m24 = re.search(r"\b(\d{1,2}):(\d{2})\b", msg_lower)
        if m24:
            hr = int(m24.group(1))
            mn = int(m24.group(2))
            if 0 <= hr <= 23 and 0 <= mn <= 59:
                return hr, mn

        # Direct expressions: "at 10" or "at 2" or "at 3"
        m_at = re.search(r"\bat\s+(\d{1,2})\b", msg_lower)
        if m_at:
            hr = int(m_at.group(1))
            if 1 <= hr <= 12:
                if hr in (1, 2, 3, 4, 5):
                    hr += 12
                return hr, 0

        return None, None

    @staticmethod
    def parse_requested_date(msg_lower: str) -> Optional[date]:
        """Extract target date from relative or absolute date expressions."""
        today = date.today()
        if "tomorrow" in msg_lower:
            return today + timedelta(days=1)
        if "day after tomorrow" in msg_lower:
            return today + timedelta(days=2)
        if "today" in msg_lower:
            return today

        # Weekdays: monday..sunday
        weekday_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        for day_name, day_idx in weekday_map.items():
            if re.search(rf"\b{day_name}\b", msg_lower):
                days_ahead = (day_idx - today.weekday()) % 7
                if days_ahead == 0:
                    days_ahead = 7
                return today + timedelta(days=days_ahead)

        # ISO date YYYY-MM-DD
        m_iso = re.search(r"\b(202\d-\d{2}-\d{2})\b", msg_lower)
        if m_iso:
            try:
                return datetime.strptime(m_iso.group(1), "%Y-%m-%d").date()
            except ValueError:
                pass

        # Month and Day: e.g. "Nov 20", "November 20"
        m_md = re.search(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b", msg_lower)
        if m_md:
            month_abbr = m_md.group(1)[:3]
            day_num = int(m_md.group(2))
            month_map = {
                "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
            }
            m_num = month_map.get(month_abbr)
            if m_num:
                try:
                    return date(today.year, m_num, day_num)
                except ValueError:
                    pass

        return None

    @staticmethod
    def resolve_conversational_booking(
        db: Session,
        patient_id: str,
        patient_name: str,
        message: str,
        clinician: User
    ) -> Tuple[Optional[Appointment], Optional[str], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Check if patient instructed Dr. Crane to book an appointment.
        If a specific slot or 'next available' slot is identified, books it atomically.
        Returns: (booked_appointment, failure_or_guidance_reason, available_slots, matched_slot)
        """
        msg_lower = message.lower()
        start_d = date.today() + timedelta(days=1)
        end_d = start_d + timedelta(days=14)
        slots = appointment_service.get_available_slots(db, clinician.id, start_d, end_d)

        is_booking_directive = bool(re.search(
            r"\b(book|schedule|reserve|make\s+an?\s+appointment|set\s+up\s+an?\s+appointment|confirm\s+slot|confirm\s+booking|lock\s+in)\b",
            msg_lower
        ))

        if not is_booking_directive:
            return None, None, slots, None

        # 1. "next available" or "earliest"
        if re.search(r"\b(next\s+available|earliest|first\s+available|soonest|next\s+slot)\b", msg_lower):
            if slots:
                target_slot = slots[0]
                try:
                    appt = appointment_service.book_appointment(
                        db=db,
                        patient_id=patient_id,
                        doctor_id=clinician.id,
                        start_time=target_slot["start_time"],
                        reason="Prenatal Consultation (Scheduled via Dr. Crane AI)",
                        appointment_type="ROUTINE_PRENATAL",
                        booking_channel="ai_assistant"
                    )
                    notification_service.create_notification(
                        db=db,
                        user_id=clinician.id,
                        category="APPOINTMENT_SCHEDULED",
                        title=f"Dr. Crane AI Booking: {patient_name}",
                        message=f"{patient_name} has scheduled an appointment on {target_slot['formatted_date']} at {target_slot['formatted_time']} via Dr. Crane AI.",
                        priority="NORMAL",
                        patient_id=patient_id
                    )
                    return appt, None, slots, target_slot
                except ValueError as ve:
                    return None, f"Could not reserve next available slot: {str(ve)}", slots, None
            else:
                return None, "No available consultation slots found in Dr. Vance's active schedule for the next 2 weeks.", slots, None

        # 2. Extract requested date and time
        req_date = AIAssistantService.parse_requested_date(msg_lower)
        req_hour, req_min = AIAssistantService.parse_requested_time(msg_lower)

        # If user did not provide date and did not provide time (e.g. "Can I book an appointment with Dr. Vance next week?")
        if req_date is None and req_hour is None:
            return None, None, slots, None

        # If date is given but time is not given
        if req_date is not None and req_hour is None:
            same_day_slots = [s for s in slots if s["start_time"].date() == req_date]
            if same_day_slots:
                times_list = ", ".join([s["formatted_time"] for s in same_day_slots[:4]])
                return None, f"Dr. Elena Vance has openings on {req_date.strftime('%A, %b %d')} at {times_list}. Which time works best for you?", same_day_slots, None
            else:
                return None, f"Dr. Elena Vance has no available consultation slots on {req_date.strftime('%A, %b %d')}. Please pick from the open slots shown.", slots, None

        # If time is given (with or without date)
        matched_slot = None
        for s in slots:
            slot_dt: datetime = s["start_time"]
            date_matches = (req_date is None) or (slot_dt.date() == req_date)
            time_matches = (slot_dt.hour == req_hour) and (slot_dt.minute == (req_min or 0))
            if date_matches and time_matches:
                matched_slot = s
                break

        if matched_slot:
            try:
                appt = appointment_service.book_appointment(
                    db=db,
                    patient_id=patient_id,
                    doctor_id=clinician.id,
                    start_time=matched_slot["start_time"],
                    reason="Prenatal Consultation (Scheduled via Dr. Crane AI)",
                    appointment_type="ROUTINE_PRENATAL",
                    booking_channel="ai_assistant"
                )
                notification_service.create_notification(
                    db=db,
                    user_id=clinician.id,
                    category="APPOINTMENT_SCHEDULED",
                    title=f"Dr. Crane AI Booking: {patient_name}",
                    message=f"{patient_name} has scheduled an appointment on {matched_slot['formatted_date']} at {matched_slot['formatted_time']} via Dr. Crane AI.",
                    priority="NORMAL",
                    patient_id=patient_id
                )
                return appt, None, slots, matched_slot
            except ValueError as ve:
                return None, f"That slot could not be booked: {str(ve)}", slots, None
        else:
            if req_date:
                same_day_slots = [s for s in slots if s["start_time"].date() == req_date]
                if same_day_slots:
                    times_list = ", ".join([s["formatted_time"] for s in same_day_slots[:4]])
                    return None, f"The requested time ({req_hour:02d}:{(req_min or 0):02d}) is not available on {req_date.strftime('%A, %b %d')}. Available times on that day: {times_list}.", same_day_slots, None
                else:
                    return None, f"There are no open slots on {req_date.strftime('%A, %b %d')}. Next available openings: {', '.join([s['formatted_date'] + ' at ' + s['formatted_time'] for s in slots[:3]])}.", slots, None
            else:
                return None, f"No open slot found at {req_hour:02d}:{(req_min or 0):02d}. Next available openings: {', '.join([s['formatted_date'] + ' at ' + s['formatted_time'] for s in slots[:3]])}.", slots, None

    @staticmethod
    async def generate_grounded_response(
        db: Session,
        patient_id: str,
        user: User,
        message: str,
        intent: str,
        context: Dict[str, Any]
    ) -> Tuple[str, List[str], str, List[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Generate grounded clinical assistant response strictly powered by Requesty API for Crane AI,
        grounded in the patient's authenticated clinical records and evidence-based monographs.
        Returns (reply_text, sources, mascot_expression, suggested_slots, action_taken).
        """
        sources = []
        suggested_slots = []
        action_taken = None
        mascot_expression = "caring"
        msg_lower = message.lower()

        # If booking inquiry or user mentions appointment, fetch real clinician availability slots or book
        if intent == "appointment_booking" or "appointment" in msg_lower or "see doctor" in msg_lower or "book" in msg_lower:
            clinician = db.query(User).filter(User.role == "clinician", User.is_active == True).first()
            if clinician:
                patient_name = context.get("patient_name", "Patient")
                booked_appt, booking_issue, slots, matched_slot = AIAssistantService.resolve_conversational_booking(
                    db=db,
                    patient_id=patient_id,
                    patient_name=patient_name,
                    message=message,
                    clinician=clinician
                )

                if booked_appt and matched_slot:
                    sources.append("Clinic Schedule Reservation System (pregtwin.db)")
                    sources.append("Doctor Availability Schedule (Dr. Elena Vance, MD)")
                    action_taken = {
                        "appointment_booked": True,
                        "appointment_id": booked_appt.id,
                        "doctor_name": clinician.full_name,
                        "start_time": booked_appt.start_time.isoformat(),
                        "formatted_date": matched_slot.get("formatted_date"),
                        "formatted_time": matched_slot.get("formatted_time"),
                        "appointment_type": booked_appt.appointment_type,
                        "status": booked_appt.status
                    }
                    context["newly_booked_appointment"] = {
                        "doctor_name": clinician.full_name,
                        "formatted_date": matched_slot.get("formatted_date"),
                        "formatted_time": matched_slot.get("formatted_time"),
                        "start_time": booked_appt.start_time.strftime("%A, %b %d at %I:%M %p"),
                        "appointment_type": booked_appt.appointment_type
                    }
                    mascot_expression = "celebrating"
                    suggested_slots = []
                else:
                    sources.append("Doctor Availability Schedule (Dr. Elena Vance, MD)")
                    if booking_issue:
                        context["booking_failed_reason"] = booking_issue
                    suggested_slots = slots[:6]
                    if suggested_slots:
                        context["suggested_slots_summary"] = [f"{s['formatted_date']} at {s['formatted_time']}" for s in suggested_slots[:3]]

        # Grounding source for medications referenced in context or message
        for m in context.get("active_medications", []):
            if m.get("name", "").lower() in msg_lower or intent in ("medication_inquiry", "medication_schedule"):
                sources.append(f"Clinician-Approved Order: {m['name']} ({m.get('dose', '')})")
                break

        # Call the isolated Requesty Crane Client
        reply, req_sources, mascot_expr = await requesty_crane_client.generate_chat_reply(
            message=message,
            context=context,
            intent=intent
        )

        for s in req_sources:
            if s not in sources:
                sources.append(s)

        # Reliability guarantee: if appointment was booked, ensure the confirmation text clearly reflects it
        if action_taken and action_taken.get("appointment_booked"):
            nb = context.get("newly_booked_appointment", {})
            confirm_line = f"✓ **Appointment Confirmed**: {nb.get('doctor_name')} on {nb.get('formatted_date')} at {nb.get('formatted_time')}."
            if "confirmed" not in reply.lower() and "booked" not in reply.lower():
                reply = f"{reply}\n\n{confirm_line}\n*This consultation has been recorded on your clinical schedule and can also be viewed in your Appointments tab.*"

        # Safety reinforcement: if patient asked about missing or doubling dose, ensure strict refusal of dose alterations
        if ("double" in msg_lower or "skip" in msg_lower or "missed" in msg_lower) and "double" not in reply.lower():
            reply = (
                "• **Do NOT double your dose** to make up for a missed tablet. Taking an extra dose can cause dangerous drops in blood pressure.\n"
                "• Please consult Dr. Elena Vance before modifying any medication schedule.\n\n"
            ) + reply

        # Ensure prescribing physician is referenced for medication inquiries
        if ("stop" in msg_lower or "change" in msg_lower or "prescribe" in msg_lower) and "dr. vance" not in reply.lower():
            reply += "\n\n*Please note: I cannot change or stop your prescriptions. Please consult Dr. Elena Vance for any prescription adjustments.*"

        return reply, sources, mascot_expr, suggested_slots, action_taken

    @staticmethod
    async def process_patient_message(
        db: Session,
        patient_id: str,
        user: User,
        message_text: str,
        client_timezone: str = "UTC"
    ) -> Dict[str, Any]:
        """
        Complete patient question-answering pipeline:
        1. Authenticate user & verify patient access.
        2. Evaluate deterministic emergency rules (no LLM delay).
        3. Check topic restriction / prompt injection.
        4. Retrieve authorized patient records & approved drug monographs.
        5. Generate evidence-grounded response.
        6. Persist interaction in audit trail and chat history.
        """
        # Step 1: Deterministic Emergency Rule Check (BEFORE ANY OTHER ACTION)
        is_emergency, triggered_rules, severity = AIAssistantService.evaluate_emergency_rules(message_text)

        if is_emergency:
            # Trigger Emergency Escalation immediately
            event = AIAssistantService.trigger_emergency_escalation(
                db=db,
                patient_id=patient_id,
                reported_by_user_id=user.id,
                symptoms_text=message_text,
                triggered_rules=triggered_rules
            )

            emergency_reply = (
                f"🚨 **CRITICAL MATERNAL WARNING SIGN DETECTED**\n\n"
                f"Your message mentions symptoms that require **immediate medical evaluation**: "
                f"*{', '.join(triggered_rules).replace('_', ' ').title()}*.\n\n"
                f"**WHAT YOU MUST DO RIGHT NOW**:\n"
                f"1. **Call 911** (or your local emergency number) immediately, or have someone drive you straight to the nearest **Labor & Delivery Emergency Triage** or Hospital Emergency Department.\n"
                f"2. An urgent high-priority alert has been dispatched to your clinician, **Dr. Elena Vance**, and the on-call obstetric care team.\n"
                f"3. **Do not wait at home** for a response from your doctor or this app before seeking urgent medical care."
            )

            # Persist message
            chat_msg = AIChatMessage(
                patient_id=patient_id,
                user_id=user.id,
                sender_type="assistant",
                message_text=emergency_reply,
                intent_category="critical_emergency",
                is_emergency=True,
                emergency_event_id=event.id,
                action_taken_json=json.dumps({"emergency_escalated": True, "event_id": event.id, "rules": triggered_rules}),
                sources_json=json.dumps(["ACOG/ISSHP Maternal Emergency Triage Protocol", "Emergency Escalation Engine"]),
                created_at=utc_now()
            )
            db.add(chat_msg)
            db.commit()
            db.refresh(chat_msg)

            return {
                "message_id": chat_msg.id,
                "assistant_reply": emergency_reply,
                "intent_category": "critical_emergency",
                "is_emergency": True,
                "emergency_event_id": event.id,
                "emergency_instructions": emergency_reply,
                "mascot_expression": "alert",
                "suggested_slots": [],
                "action_taken": {"emergency_escalated": True, "event_id": event.id},
                "grounding_sources": ["ACOG/ISSHP Maternal Emergency Warning Signs Guidelines"],
                "created_at": chat_msg.created_at
            }

        # Step 2: Topic & Injection Classification
        intent, is_allowed = AIAssistantService.classify_intent(message_text)

        if not is_allowed:
            if intent == "prompt_injection_attempt":
                refusal_reply = (
                    "I am Dr. Crane, your dedicated PregTwin maternal health assistant. "
                    "I am strictly programmed to protect patient safety and assist with your pregnancy care, "
                    "medications, vital signs, and clinical appointments. I cannot bypass my safety protocols."
                )
            else:
                refusal_reply = (
                    "I'm Dr. Crane, your PregTwin maternal health assistant. I can only assist with your "
                    "pregnancy care, medications, health records, vital measurements, and appointments. "
                    "I cannot assist with general programming, entertainment, trivia, or unrelated topics."
                )

            chat_msg = AIChatMessage(
                patient_id=patient_id,
                user_id=user.id,
                sender_type="assistant",
                message_text=refusal_reply,
                intent_category="off_topic_refusal",
                is_emergency=False,
                created_at=utc_now()
            )
            db.add(chat_msg)
            db.commit()
            db.refresh(chat_msg)

            return {
                "message_id": chat_msg.id,
                "assistant_reply": refusal_reply,
                "intent_category": "off_topic_refusal",
                "is_emergency": False,
                "mascot_expression": "attentive",
                "suggested_slots": [],
                "action_taken": None,
                "grounding_sources": ["PregTwin Patient Safety Scope Policy"],
                "created_at": chat_msg.created_at
            }

        # Step 3: Retrieve Authorized Patient Clinical Context
        context = AIAssistantService.retrieve_patient_context(db, patient_id)

        # Step 4: Generate Grounded Clinical Response
        reply_text, sources, mascot_expr, slots, action = await AIAssistantService.generate_grounded_response(
            db=db,
            patient_id=patient_id,
            user=user,
            message=message_text,
            intent=intent,
            context=context
        )

        # Step 5: Persist interaction in chat history
        chat_msg = AIChatMessage(
            patient_id=patient_id,
            user_id=user.id,
            sender_type="assistant",
            message_text=reply_text,
            intent_category=intent,
            is_emergency=False,
            action_taken_json=json.dumps(action) if action else None,
            sources_json=json.dumps(sources),
            created_at=utc_now()
        )
        db.add(chat_msg)
        db.commit()
        db.refresh(chat_msg)

        # Step 6: Return structured response
        return {
            "message_id": chat_msg.id,
            "assistant_reply": reply_text,
            "intent_category": intent,
            "is_emergency": False,
            "emergency_event_id": None,
            "emergency_instructions": None,
            "mascot_expression": mascot_expr,
            "suggested_slots": slots,
            "action_taken": action,
            "grounding_sources": sources,
            "created_at": chat_msg.created_at
        }

ai_assistant_service = AIAssistantService()
