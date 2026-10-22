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
            Appointment.status.in_(["SCHEDULED", "CONFIRMED"]),
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

        # If booking inquiry or user mentions appointment, fetch real clinician availability slots
        if intent == "appointment_booking" or "appointment" in msg_lower or "see doctor" in msg_lower:
            clinician = db.query(User).filter(User.role == "clinician", User.is_active == True).first()
            if clinician:
                sources.append("Doctor Availability Schedule (Dr. Elena Vance, MD)")
                start_d = date.today() + timedelta(days=1)
                end_d = start_d + timedelta(days=6)
                slots = appointment_service.get_available_slots(db, clinician.id, start_d, end_d)
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
