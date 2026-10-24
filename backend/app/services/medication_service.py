import json
import logging
import httpx
from datetime import datetime, timezone, timedelta, date, time
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.models.entities import (
    MedicationOrder,
    MedicationDoseLog,
    PatientProfile,
    User,
    AuditEvent,
    EmergencyEvent,
    Notification,
    utc_now,
)
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

# --- Verified Evidence-Based Maternal Drug Monographs (Clinician-Reviewed Reference) ---
MATERNAL_DRUG_MONOGRAPHS: Dict[str, Dict[str, Any]] = {
    "labetalol": {
        "generic_name": "Labetalol Hydrochloride",
        "drug_class": "Combined Alpha-1 and Non-Selective Beta-Adrenergic Blocker",
        "intended_use": (
            "First-line oral anti-hypertensive medication recommended by ACOG and ISSHP guidelines "
            "for managing gestational hypertension, chronic hypertension in pregnancy, and preeclampsia. "
            "It lowers maternal systemic vascular resistance and blood pressure without compromising "
            "uteroplacental blood flow."
        ),
        "standard_administration": (
            "Take with or immediately after meals to improve gastrointestinal tolerance and maintain consistent absorption. "
            "Do not stop taking or change the dose abruptly without clinical direction."
        ),
        "pregnancy_safety_notes": (
            "Extensively studied and established as safe throughout second and third trimesters. "
            "Does not impair fetal growth or cause congenital malformations when monitored clinically."
        ),
        "pregnancy_safety_summary": (
            "Extensively studied and established as safe throughout second and third trimesters. "
            "Does not impair fetal growth or cause congenital malformations when monitored clinically."
        ),
        "common_side_effects": [
            "Mild dizziness or lightheadedness when standing",
            "Maternal fatigue or sluggishness",
            "Transient scalp tingling sensation",
            "Nausea or stomach upset",
            "Nasal congestion"
        ],
        "serious_warning_signs": [
            "Resting maternal heart rate under 55 bpm",
            "Wheezing, bronchospasm, or shortness of breath",
            "Severe lightheadedness or sudden fainting",
            "Cold, pale hands or feet"
        ],
        "key_warnings": [
            "Report heart rate under 55 bpm, severe dizziness, lightheadedness, or wheezing.",
            "Contraindicated in patients with active maternal asthma, uncompensated cardiac failure, or severe bradycardia.",
            "Do not skip doses or double up if a dose is missed."
        ],
        "missed_dose_guidance": "Take as soon as remembered unless it is nearly time for your next scheduled dose. Never double up doses.",
        "clinical_reference": "ACOG Practice Bulletin No. 222 (Gestational Hypertension and Preeclampsia); ISSHP 2021 Clinical Standards.",
        "source": "verified_clinician_library"
    },
    "nifedipine": {
        "generic_name": "Nifedipine Extended Release",
        "drug_class": "Dihydropyridine Calcium Channel Blocker (Long-Acting)",
        "intended_use": (
            "Recommended first-line medication for blood pressure control in pregnant patients with "
            "gestational hypertension or preeclampsia. Relaxes smooth muscles in peripheral vascular walls, "
            "reducing systemic arterial resistance."
        ),
        "standard_administration": (
            "Swallow tablets whole once daily with water. Do not crush, chew, or divide extended-release tablets. "
            "Avoid grapefruit or grapefruit juice, which can substantially increase drug concentration."
        ),
        "pregnancy_safety_notes": (
            "Strong evidence profile supporting safety and efficacy in pregnancy; preferred oral agent "
            "especially when beta-blockers like Labetalol are contraindicated by maternal asthma."
        ),
        "pregnancy_safety_summary": (
            "Strong evidence profile supporting safety and efficacy in pregnancy; preferred oral agent "
            "especially when beta-blockers like Labetalol are contraindicated by maternal asthma."
        ),
        "common_side_effects": [
            "Peripheral ankle or foot swelling (edema)",
            "Warmth or redness in the face/neck (flushing)",
            "Mild transient headache upon initiation",
            "Mild dizziness or lightheadedness",
            "Occasional rapid heart rate (palpitations)"
        ],
        "serious_warning_signs": [
            "Sudden severe lightheadedness or fainting spells",
            "Chest pain, pressure, or irregular heart palpitations",
            "Severe shortness of breath",
            "Extreme facial swelling or hives"
        ],
        "key_warnings": [
            "May cause mild peripheral edema, flushing, or transient headache upon initiation.",
            "Report severe sudden lightheadedness, palpitations, or fainting.",
            "Do not administer sublingual immediate-release nifedipine due to precipitous hypotensive risk."
        ],
        "missed_dose_guidance": "Take the missed dose on the same day as soon as remembered. Do not take two doses at the same time.",
        "clinical_reference": "ACOG Practice Bulletin No. 222; SMFM Clinical Guideline (Antihypertensive Therapy in Pregnancy).",
        "source": "verified_clinician_library"
    },
    "methyldopa": {
        "generic_name": "Methyldopa",
        "drug_class": "Centrally Acting Alpha-2 Adrenergic Agonist",
        "intended_use": (
            "Established agent for maintenance management of non-severe gestational and chronic hypertension in pregnancy. "
            "Stimulates central inhibitory alpha-adrenergic receptors, reducing sympathetic outflow to cardiac and peripheral vascular beds."
        ),
        "standard_administration": (
            "Take consistently with or without food. Mild sedation may occur during dose initiation or titration; evening dosing is often preferred."
        ),
        "pregnancy_safety_notes": (
            "Longest established track record of pediatric safety through long-term childhood neurodevelopmental follow-up studies."
        ),
        "pregnancy_safety_summary": (
            "Longest established track record of pediatric safety through long-term childhood neurodevelopmental follow-up studies."
        ),
        "common_side_effects": [
            "Drowsiness, fatigue, or sedation (usually transient)",
            "Dry mouth",
            "Nasal stuffiness",
            "Mild headache",
            "Mild lightheadedness upon standing"
        ],
        "serious_warning_signs": [
            "Persistent depressed mood, extreme sadness, or emotional changes",
            "Yellowing of skin or eyes (jaundice)",
            "Unexplained persistent fever or chills",
            "Pale stools or unusually dark tea-colored urine"
        ],
        "key_warnings": [
            "Report persistent depressive mood, jaundice, unexplained fever, or severe fatigue.",
            "Periodic monitoring of liver function tests and complete blood counts is clinically indicated."
        ],
        "missed_dose_guidance": "Take as soon as remembered. If close to next dose, skip and resume regular schedule. Never double up.",
        "clinical_reference": "ACOG Clinical Practice Guideline No. 5; CHIPS Randomized Clinical Trial Longitudinal Follow-Up.",
        "source": "verified_clinician_library"
    },
    "aspirin": {
        "generic_name": "Low-Dose Aspirin (81 mg - 150 mg)",
        "drug_class": "Platelet Aggregation Inhibitor / Cyclooxygenase-1 Inhibitor",
        "intended_use": (
            "Prophylactic therapy recommended by USPSTF and ACOG for pregnant individuals at high or moderate risk "
            "of preeclampsia. Initiated between 12 and 16 weeks of gestation and continued until 36-37 weeks, "
            "it inhibits platelet thromboxane A2 synthesis to promote healthy placental vascular remodeling."
        ),
        "standard_administration": (
            "Take once daily in the evening at bedtime with a glass of water and food. Bedtime dosing has demonstrated "
            "superior chronotherapeutic reduction in maternal blood pressure."
        ),
        "pregnancy_safety_notes": (
            "Low-dose aspirin (81-150 mg) is proven safe in pregnancy and significantly reduces the incidence of "
            "early-onset preeclampsia, preterm birth, and intrauterine growth restriction without increasing maternal hemorrhagic risk."
        ),
        "pregnancy_safety_summary": (
            "Low-dose aspirin (81-150 mg) is proven safe in pregnancy and significantly reduces the incidence of "
            "early-onset preeclampsia, preterm birth, and intrauterine growth restriction without increasing maternal hemorrhagic risk."
        ),
        "common_side_effects": [
            "Mild stomach upset or heartburn",
            "Mild indigestion after taking tablet",
            "Occasional mild nausea"
        ],
        "serious_warning_signs": [
            "Unusual or unexplained bruising or active bleeding (gums, nosebleeds)",
            "Black, tarry stools or blood in vomit",
            "Severe, sharp abdominal pain",
            "Ringing in ears (tinnitus) or hearing changes"
        ],
        "key_warnings": [
            "Do not substitute high-dose analgesic aspirin or other NSAIDs (ibuprofen, naproxen).",
            "Report any unexplained active bleeding, blood in stool, or persistent gastric pain.",
            "Usually held prior to planned delivery (typically 36-37 weeks) per obstetrician instructions."
        ],
        "missed_dose_guidance": "Take the missed dose the following evening with dinner or at bedtime. Do not double doses.",
        "clinical_reference": "USPSTF Recommendation Statement (2021); ACOG Committee Opinion No. 743 (Low-Dose Aspirin in Pregnancy).",
        "source": "verified_clinician_library"
    },
    "prenatal_vitamins": {
        "generic_name": "Prenatal Multivitamin with Folic Acid and Iron",
        "drug_class": "Essential Maternal Micronutrient Supplement",
        "intended_use": (
            "Supplements maternal nutrition to prevent neural tube defects (via Folic Acid 400-800 mcg), "
            "support expanded maternal blood volume and fetal erythropoiesis (via elemental Iron 27 mg), "
            "and ensure adequate calcium, iodine, and vitamin D levels."
        ),
        "standard_administration": (
            "Take once daily with a meal or snack. If morning sickness or nausea occurs, take before sleep with a light snack. "
            "Adequate dietary fiber and water intake helps counteract iron-induced constipation."
        ),
        "pregnancy_safety_notes": "Universally recommended foundational nutritional support across all trimesters.",
        "pregnancy_safety_summary": "Universally recommended foundational nutritional support across all trimesters.",
        "common_side_effects": [
            "Dark or greenish stool discoloration (expected harmless effect of iron)",
            "Mild constipation",
            "Mild nausea or stomach discomfort",
            "Mild bloating"
        ],
        "serious_warning_signs": [
            "Severe persistent vomiting or inability to tolerate food/liquids",
            "Severe sharp abdominal pain",
            "Signs of allergic reaction (rash, hives, difficulty breathing)"
        ],
        "key_warnings": [
            "Stool may appear dark or green, which is normal with iron supplementation.",
            "Do not take additional separate iron or calcium supplements unless specifically directed by clinician."
        ],
        "missed_dose_guidance": "Take the missed dose when remembered or simply take your regular tablet the following morning.",
        "clinical_reference": "ACOG Clinical Consensus No. 1; CDC Folic Acid Clinical Guidance for Maternal Health.",
        "source": "verified_clinician_library"
    },
    "calcium": {
        "generic_name": "Calcium Carbonate (Maternal Supplementation)",
        "drug_class": "Essential Dietary Mineral / Preeclampsia Prophylaxis",
        "intended_use": (
            "WHO and ACOG guideline-recommended dietary supplementation to reduce preeclampsia incidence "
            "in pregnant individuals with low baseline dietary calcium intake or elevated baseline cardiovascular risk."
        ),
        "standard_administration": (
            "Take 1,000 mg - 1,500 mg elemental calcium daily divided into 2-3 doses with meals for optimal absorption. "
            "Separate administration from prenatal iron supplements by at least 2 hours to prevent absorption competition."
        ),
        "pregnancy_safety_notes": (
            "Established safe and beneficial in pregnancy; proven reduction in preeclampsia risk and severe maternal morbidity."
        ),
        "pregnancy_safety_summary": (
            "Established safe and beneficial in pregnancy; proven reduction in preeclampsia risk and severe maternal morbidity."
        ),
        "common_side_effects": [
            "Mild constipation",
            "Mild abdominal gas or bloating",
            "Mild belching"
        ],
        "serious_warning_signs": [
            "Severe nausea, vomiting, or persistent loss of appetite",
            "Sharp flank or lower back pain (kidney stones)",
            "Extreme muscle weakness, confusion, or extreme thirst (hypercalcemia)"
        ],
        "key_warnings": [
            "Do not exceed 2,500 mg total elemental calcium per day from all sources.",
            "Separate from iron supplements by at least 2 hours.",
            "Report symptoms of kidney stones or severe constipation."
        ],
        "missed_dose_guidance": "Take with your next meal. Do not take more than your prescribed daily amount at one time.",
        "clinical_reference": "WHO Recommendations on Calcium Supplementation for Preeclampsia Prevention; ACOG Practice Bulletin No. 222.",
        "source": "verified_clinician_library"
    }
}

class MedicationService:
    @staticmethod
    def get_drug_monograph(medication_name: str) -> Optional[Dict[str, Any]]:
        """Look up verified evidence-based clinical reference for a medication with fuzzy keyword matching."""
        name_lower = medication_name.lower().strip()
        tokens = [t for t in name_lower.replace("-", " ").replace("(", " ").replace(")", " ").split() if len(t) > 2]
        for key, monograph in MATERNAL_DRUG_MONOGRAPHS.items():
            generic_lower = monograph.get("generic_name", "").lower()
            if key in name_lower or name_lower in key:
                return monograph
            if generic_lower in name_lower or name_lower in generic_lower:
                return monograph
            for token in tokens:
                if token in key or token in generic_lower:
                    return monograph
        return None

    @classmethod
    async def get_or_generate_drug_monograph(cls, medication_name: str) -> Dict[str, Any]:
        """
        Retrieves evidence-based maternal monograph.
        Tier 1: Looks up in verified library MATERNAL_DRUG_MONOGRAPHS (with fuzzy keyword matching).
        Tier 2: Calls local Ollama (llama3.2:3b) to generate structured ACOG-aligned monograph on-demand.
        Tier 3: Gracefully falls back to structured clinical default template if Ollama is unreachable.
        """
        # 1. Check local verified library
        existing = cls.get_drug_monograph(medication_name)
        if existing:
            return existing

        clean_name = medication_name.strip()
        clean_key = clean_name.lower().replace(" ", "_").replace("-", "_")

        # 2. Query Local Ollama (llama3.2:3b)
        ollama_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        prompt = (
            f"You are an expert maternal-fetal clinical pharmacologist.\n"
            f"Generate an evidence-based pregnancy drug monograph for '{clean_name}'.\n"
            f"Adhere strictly to ACOG and SMFM clinical standards.\n"
            f"Return ONLY valid JSON matching this schema:\n"
            f"{{\n"
            f'  "generic_name": "{clean_name.title()}",\n'
            f'  "drug_class": "Exact drug class",\n'
            f'  "intended_use": "Clinical purpose and indication during pregnancy",\n'
            f'  "standard_administration": "Typical dosage and instructions (oral, with/without food, etc.)",\n'
            f'  "pregnancy_safety_notes": "Safety profile in pregnancy per ACOG/FDA categories",\n'
            f'  "common_side_effects": ["side effect 1", "side effect 2", "side effect 3"],\n'
            f'  "serious_warning_signs": ["serious symptom 1 (seek urgent care)", "serious symptom 2"],\n'
            f'  "missed_dose_guidance": "Instructions if a dose is missed",\n'
            f'  "clinical_reference": "ACOG Committee Opinion or SMFM Clinical Guidance"\n'
            f"}}"
        )

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                resp = await client.post(
                    ollama_url,
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0.2}
                    }
                )
                if resp.status_code == 200:
                    raw_data = resp.json()
                    response_text = raw_data.get("response", "{}")
                    parsed = json.loads(response_text)
                    
                    monograph = {
                        "generic_name": parsed.get("generic_name") or clean_name.title(),
                        "drug_class": parsed.get("drug_class") or "Obstetric Medication",
                        "intended_use": parsed.get("intended_use") or f"Prescribed for maternal care plan ({clean_name}).",
                        "standard_administration": parsed.get("standard_administration") or "Take as prescribed by attending clinician.",
                        "pregnancy_safety_notes": parsed.get("pregnancy_safety_notes") or "Consult obstetric clinician for individualized safety assessment.",
                        "pregnancy_safety_summary": parsed.get("pregnancy_safety_notes") or "Consult obstetric clinician for individualized safety assessment.",
                        "common_side_effects": parsed.get("common_side_effects") if isinstance(parsed.get("common_side_effects"), list) else ["Mild gastrointestinal discomfort", "Fatigue"],
                        "serious_warning_signs": parsed.get("serious_warning_signs") if isinstance(parsed.get("serious_warning_signs"), list) else ["Severe dizziness", "Chest tightness or breathing difficulty", "Severe rash"],
                        "key_warnings": parsed.get("serious_warning_signs") if isinstance(parsed.get("serious_warning_signs"), list) else ["Severe dizziness", "Chest tightness or breathing difficulty", "Severe rash"],
                        "missed_dose_guidance": parsed.get("missed_dose_guidance") or "Take as soon as remembered unless close to the next dose. Never double doses.",
                        "clinical_reference": f"ACOG/SMFM Standards (Generated via Ollama {settings.OLLAMA_MODEL})",
                        "source": f"ollama_{settings.OLLAMA_MODEL}"
                    }
                    
                    MATERNAL_DRUG_MONOGRAPHS[clean_key] = monograph
                    logger.info(f"Dynamically generated and cached monograph for '{clean_name}' via Ollama {settings.OLLAMA_MODEL}")
                    return monograph
        except Exception as e:
            logger.warning(f"Ollama monograph generation failed for '{clean_name}': {e}. Using deterministic clinical fallback.")

        # 3. Deterministic Clinical Fallback
        fallback_monograph = {
            "generic_name": clean_name.title(),
            "drug_class": "Obstetric / Maternal Medication",
            "intended_use": f"Prescribed medication order in patient maternal care plan ({clean_name}).",
            "standard_administration": "Take strictly according to clinician prescription instructions and timing schedule.",
            "pregnancy_safety_notes": "Established maternal care medication. Discuss specific pregnancy trimester considerations with your obstetric clinician.",
            "pregnancy_safety_summary": "Established maternal care medication. Discuss specific pregnancy trimester considerations with your obstetric clinician.",
            "common_side_effects": ["Mild nausea or gastrointestinal sensitivity", "Mild drowsiness or fatigue"],
            "serious_warning_signs": ["Sudden severe dizziness or fainting", "Shortness of breath or allergic reaction", "Severe headache or visual changes"],
            "key_warnings": ["Sudden severe dizziness or fainting", "Shortness of breath or allergic reaction", "Severe headache or visual changes"],
            "missed_dose_guidance": "Take missed dose as soon as remembered unless close to next scheduled dose. Never double doses.",
            "clinical_reference": "PregTwin Clinician Care Coordination & Practice Standards",
            "source": "clinical_fallback"
        }
        MATERNAL_DRUG_MONOGRAPHS[clean_key] = fallback_monograph
        return fallback_monograph

    @staticmethod
    def create_order(
        db: Session,
        patient_id: str,
        clinician: User,
        order_data: Dict[str, Any]
    ) -> MedicationOrder:
        """Create a new medication order (requires clinician authorization)."""
        if clinician.role not in ("clinician", "admin"):
            raise PermissionError("Only authorized clinicians can create medication orders.")

        patient = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if not patient:
            raise ValueError("Patient not found")

        timing_slots = order_data.get("timing_slots") or ["08:00", "20:00"]
        order = MedicationOrder(
            patient_id=patient.id,
            prescribing_clinician_id=clinician.id,
            medication_name=order_data["medication_name"],
            strength=order_data.get("strength"),
            formulation=order_data.get("formulation"),
            prescribed_dose=order_data["prescribed_dose"],
            route=order_data.get("route", "oral"),
            frequency=order_data["frequency"],
            timing_json=json.dumps(timing_slots),
            start_date=order_data["start_date"],
            end_date=order_data.get("end_date"),
            clinician_instructions=order_data["clinician_instructions"],
            warnings_precautions=order_data.get("warnings_precautions"),
            status="DRAFT",
            version=1
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Audit event
        audit = AuditEvent(
            user_id=clinician.id,
            user_email=clinician.email,
            action="MEDICATION_ORDER_CREATED",
            target_type="MedicationOrder",
            target_id=order.id,
            details_json=json.dumps({
                "patient_id": patient.id,
                "medication_name": order.medication_name,
                "prescribed_dose": order.prescribed_dose,
                "status": "DRAFT"
            })
        )
        db.add(audit)
        db.commit()
        return order

    @staticmethod
    def approve_order(
        db: Session,
        order_id: str,
        clinician: User
    ) -> MedicationOrder:
        """Clinician approves a medication order, activating patient schedule and reminders."""
        if clinician.role not in ("clinician", "admin"):
            raise PermissionError("Only authorized clinicians can approve medication orders.")

        order = db.query(MedicationOrder).filter(MedicationOrder.id == order_id).first()
        if not order:
            raise ValueError("Medication order not found")

        order.status = "APPROVED"
        order.approved_by_id = clinician.id
        order.approved_at = utc_now()
        order.version += 1
        db.commit()
        db.refresh(order)

        patient = order.patient
        patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"

        # Create patient notification
        if patient and patient.user_id:
            notification_service.create_notification(
                db=db,
                user_id=patient.user_id,
                patient_id=patient.id,
                category="MEDICATION_ORDER_UPDATED",
                title=f"New Prescription Approved: {order.medication_name}",
                message=(
                    f"Dr. {clinician.full_name} has approved your prescription for {order.medication_name} "
                    f"({order.prescribed_dose}, {order.frequency}). "
                    f"Instructions: {order.clinician_instructions}"
                ),
                priority="NORMAL",
                link_url="/medications",
                metadata={"order_id": order.id, "medication_name": order.medication_name}
            )

        # Audit event
        audit = AuditEvent(
            user_id=clinician.id,
            user_email=clinician.email,
            action="MEDICATION_ORDER_APPROVED",
            target_type="MedicationOrder",
            target_id=order.id,
            details_json=json.dumps({
                "patient_id": order.patient_id,
                "medication_name": order.medication_name,
                "approved_by": clinician.full_name,
                "version": order.version
            })
        )
        db.add(audit)
        db.commit()

        # Generate initial dose reminders
        MedicationService.generate_reminders_for_patient(db, order.patient_id, days_ahead=2)
        return order

    @staticmethod
    def discontinue_order(
        db: Session,
        order_id: str,
        clinician: User,
        reason: str
    ) -> MedicationOrder:
        """Discontinue a medication order (requires clinician authorization)."""
        if clinician.role not in ("clinician", "admin"):
            raise PermissionError("Only authorized clinicians can discontinue medication orders.")

        order = db.query(MedicationOrder).filter(MedicationOrder.id == order_id).first()
        if not order:
            raise ValueError("Medication order not found")

        order.status = "DISCONTINUED"
        order.discontinued_at = utc_now()
        order.discontinued_reason = reason
        order.version += 1
        db.commit()
        db.refresh(order)

        patient = order.patient
        if patient and patient.user_id:
            notification_service.create_notification(
                db=db,
                user_id=patient.user_id,
                patient_id=patient.id,
                category="MEDICATION_ORDER_UPDATED",
                title=f"Medication Discontinued: {order.medication_name}",
                message=(
                    f"Your prescription for {order.medication_name} has been discontinued by Dr. {clinician.full_name}. "
                    f"Reason: {reason}. Please follow your clinician's updated plan."
                ),
                priority="HIGH",
                link_url="/medications",
                metadata={"order_id": order.id, "discontinued": True}
            )

        # Audit
        audit = AuditEvent(
            user_id=clinician.id,
            user_email=clinician.email,
            action="MEDICATION_ORDER_DISCONTINUED",
            target_type="MedicationOrder",
            target_id=order.id,
            details_json=json.dumps({
                "patient_id": order.patient_id,
                "medication_name": order.medication_name,
                "reason": reason
            })
        )
        db.add(audit)
        db.commit()
        return order

    @staticmethod
    def log_dose(
        db: Session,
        order_id: str,
        patient_id: str,
        user: User,
        dose_data: Dict[str, Any]
    ) -> MedicationDoseLog:
        """Log a dose event (taken, missed, side effect) reported by the patient."""
        order = db.query(MedicationOrder).filter(
            MedicationOrder.id == order_id,
            MedicationOrder.patient_id == patient_id
        ).first()
        if not order:
            raise ValueError("Medication order not found for this patient")

        # Parse scheduled time
        sched_str = dose_data.get("scheduled_time")
        if sched_str:
            try:
                scheduled_time = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
            except Exception:
                scheduled_time = utc_now()
        else:
            scheduled_time = utc_now()

        status = dose_data.get("status", "TAKEN").upper()
        patient_notes = dose_data.get("patient_notes")
        reported_side_effects = dose_data.get("reported_side_effects")
        severity = dose_data.get("reported_side_effects_severity", "MILD")

        dose_log = MedicationDoseLog(
            order_id=order.id,
            patient_id=patient_id,
            scheduled_time=scheduled_time,
            logged_time=utc_now(),
            status=status,
            patient_notes=patient_notes,
            reported_side_effects=reported_side_effects,
            reported_side_effects_severity=severity
        )
        db.add(dose_log)
        db.commit()
        db.refresh(dose_log)

        # Handle Side Effects Reporting
        if reported_side_effects:
            # Check for critical warning keywords
            critical_keywords = [
                "chest pain", "shortness of breath", "severe swelling",
                "fainting", "syncope", "passed out", "seizure",
                "severe headache", "blurred vision", "bleeding"
            ]
            is_critical = any(kw in reported_side_effects.lower() for kw in critical_keywords) or severity == "SEVERE"

            if is_critical:
                # Trigger Emergency Escalation
                from app.services.ai_assistant_service import ai_assistant_service
                ai_assistant_service.trigger_emergency_escalation(
                    db=db,
                    patient_id=patient_id,
                    reported_by_user_id=user.id,
                    symptoms_text=f"Severe medication side effect reported with {order.medication_name}: {reported_side_effects}",
                    triggered_rules=["severe_medication_side_effect", "critical_adverse_reaction"]
                )
            else:
                # Alert prescribing clinician
                if order.prescribing_clinician_id:
                    patient = order.patient
                    patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"
                    notification_service.create_notification(
                        db=db,
                        user_id=order.prescribing_clinician_id,
                        patient_id=patient_id,
                        category="URGENT_SYMPTOM_ALERT",
                        title=f"Side Effect Reported: {patient_name} on {order.medication_name}",
                        message=(
                            f"{patient_name} reported side effects ({severity}): \"{reported_side_effects}\" "
                            f"for {order.medication_name} {order.prescribed_dose}."
                        ),
                        priority="HIGH",
                        link_url="/clinician/review-queue",
                        metadata={"order_id": order.id, "dose_log_id": dose_log.id, "side_effect": reported_side_effects}
                    )

        # Handle Missed Dose Escalation Tracking
        if status == "MISSED":
            # Check if there are consecutive missed doses
            recent_logs = db.query(MedicationDoseLog).filter(
                MedicationDoseLog.order_id == order.id
            ).order_by(desc(MedicationDoseLog.logged_time)).limit(3).all()

            consecutive_missed = sum(1 for l in recent_logs if l.status == "MISSED")
            if consecutive_missed >= 2 and order.prescribing_clinician_id:
                patient = order.patient
                patient_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"
                notification_service.create_notification(
                    db=db,
                    user_id=order.prescribing_clinician_id,
                    patient_id=patient_id,
                    category="MEDICATION_ORDER_UPDATED",
                    title=f"Adherence Alert: {consecutive_missed} Missed Doses for {patient_name}",
                    message=(
                        f"{patient_name} has logged {consecutive_missed} consecutive missed doses of "
                        f"{order.medication_name} ({order.prescribed_dose}). Clinical adherence follow-up recommended."
                    ),
                    priority="HIGH",
                    link_url="/clinician/review-queue",
                    metadata={"order_id": order.id, "consecutive_missed": consecutive_missed}
                )

        return dose_log

    @staticmethod
    def generate_reminders_for_patient(
        db: Session,
        patient_id: str,
        days_ahead: int = 2
    ) -> int:
        """
        Generate upcoming scheduled dose reminders from active, clinician-approved medication orders.
        Avoids creating duplicate reminders for already-notified dose slots.
        """
        patient = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
        if not patient or not patient.user_id:
            return 0

        active_orders = db.query(MedicationOrder).filter(
            MedicationOrder.patient_id == patient_id,
            MedicationOrder.status == "APPROVED"
        ).all()

        reminders_created = 0
        now = utc_now()
        today = now.date()

        for order in active_orders:
            timing_slots = []
            if order.timing_json:
                try:
                    timing_slots = json.loads(order.timing_json)
                except Exception:
                    timing_slots = ["08:00", "20:00"]
            else:
                timing_slots = ["08:00", "20:00"]

            for day_offset in range(days_ahead + 1):
                target_date = today + timedelta(days=day_offset)
                for slot_time_str in timing_slots:
                    try:
                        hh, mm = [int(p) for p in slot_time_str.split(":")[:2]]
                        dose_dt = datetime(target_date.year, target_date.month, target_date.day, hh, mm, tzinfo=timezone.utc)
                    except Exception:
                        continue

                    # Only schedule for future doses or doses within past 30 minutes
                    if dose_dt < now - timedelta(minutes=30):
                        continue

                    dose_key = f"{order.id}_{dose_dt.isoformat()}"

                    # Check if notification already exists
                    existing = db.query(Notification).filter(
                        Notification.user_id == patient.user_id,
                        Notification.category == "MEDICATION_REMINDER",
                        Notification.metadata_json.like(f"%{dose_key}%")
                    ).first()

                    if not existing:
                        notification_service.create_notification(
                            db=db,
                            user_id=patient.user_id,
                            patient_id=patient_id,
                            category="MEDICATION_REMINDER",
                            title=f"Medication Reminder: {order.medication_name}",
                            message=(
                                f"It is time for your scheduled dose of {order.medication_name} "
                                f"({order.prescribed_dose}). {order.clinician_instructions}"
                            ),
                            priority="NORMAL",
                            link_url="/medications",
                            metadata={
                                "order_id": order.id,
                                "medication_name": order.medication_name,
                                "dose": order.prescribed_dose,
                                "dose_key": dose_key,
                                "scheduled_time": dose_dt.isoformat()
                            },
                            auto_commit=False
                        )
                        reminders_created += 1

        if reminders_created > 0:
            db.commit()
            logger.info(f"Generated {reminders_created} medication reminders for patient {patient_id}")

        return reminders_created

    @staticmethod
    def get_patient_adherence_summary(db: Session, patient_id: str) -> Dict[str, Any]:
        """Compute active orders, total logged doses, adherence %, and consecutive missed doses."""
        active_orders = db.query(MedicationOrder).filter(
            MedicationOrder.patient_id == patient_id,
            MedicationOrder.status == "APPROVED"
        ).all()

        dose_logs = db.query(MedicationDoseLog).filter(
            MedicationDoseLog.patient_id == patient_id
        ).order_by(desc(MedicationDoseLog.logged_time)).all()

        total_logged = len(dose_logs)
        taken_count = sum(1 for l in dose_logs if l.status == "TAKEN")
        adherence_pct = (taken_count / total_logged * 100) if total_logged > 0 else 100.0

        consecutive_missed = 0
        for l in dose_logs:
            if l.status == "MISSED":
                consecutive_missed += 1
            else:
                break

        recent_side_effects = [
            {
                "order_id": l.order_id,
                "severity": l.reported_side_effects_severity,
                "description": l.reported_side_effects,
                "logged_time": l.logged_time.isoformat() if l.logged_time else None
            }
            for l in dose_logs if l.reported_side_effects
        ][:5]

        upcoming_doses = []
        for o in active_orders:
            timing_slots = []
            if o.timing_json:
                try:
                    timing_slots = json.loads(o.timing_json)
                except Exception:
                    timing_slots = ["08:00", "20:00"]
            else:
                timing_slots = ["08:00", "20:00"]
            for slot in timing_slots:
                upcoming_doses.append({
                    "order_id": o.id,
                    "medication_name": o.medication_name,
                    "dose": o.prescribed_dose,
                    "route": o.route,
                    "scheduled_time": slot,
                    "instructions": o.clinician_instructions
                })

        return {
            "patient_id": patient_id,
            "total_active_orders": len(active_orders),
            "total_doses_logged": total_logged,
            "adherence_rate_pct": round(adherence_pct, 1),
            "consecutive_missed_doses": consecutive_missed,
            "consecutive_missed_alert": consecutive_missed >= 2,
            "recent_side_effects": recent_side_effects,
            "upcoming_doses": upcoming_doses
        }

medication_service = MedicationService()
