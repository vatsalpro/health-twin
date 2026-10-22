import os
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
import fitz # PyMuPDF

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.core.config import settings
from app.models.entities import (
    User,
    PatientProfile,
    PregnancyEpisode,
    MedicalDocument,
    ExtractedField,
    ReportSummary,
    ClinicalObservation,
    MaternalTwinState,
    RiskPrediction,
    AuditEvent,
    MedicationOrder,
    MedicationDoseLog,
    DoctorAvailability,
    Appointment,
    Notification,
)
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine

def create_synthetic_pdf(output_path: str, patient_name: str, mrn: str, ga: str, bp: str, labs: dict):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = fitz.open()

    # Page 1: Visit Summary & Vital Signs
    page1 = doc.new_page(width=612, height=792) # Standard Letter size
    
    # Header
    page1.draw_rect(fitz.Rect(36, 36, 576, 85), color=(0.1, 0.2, 0.35), fill=(0.04, 0.08, 0.16))
    page1.insert_text(fitz.Point(50, 60), "ST. MARGARET MATERNAL-FETAL MEDICINE CENTER", fontsize=14, color=(0.95, 0.96, 0.98), fontname="helv")
    page1.insert_text(fitz.Point(50, 75), "ANTENATAL LONGITUDINAL SURVEILLANCE REPORT - CONFIDENTIAL", fontsize=9, color=(0.35, 0.75, 0.85), fontname="helv")

    # Patient Metadata
    y = 110
    page1.insert_text(fitz.Point(50, y), f"PATIENT: {patient_name.upper()}     MRN: {mrn}     DOB: 1995-04-12", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(50, y + 16), f"GESTATIONAL AGE: {ga}     VISIT DATE: 2026-09-15     PHYSICIAN: Dr. Elena Vance, MD", fontsize=10, fontname="helv")
    page1.draw_line(fitz.Point(50, y + 26), fitz.Point(560, y + 26), color=(0.7, 0.75, 0.8))

    # Section 1: Clinical Observations & Hemodynamics
    y = 160
    page1.insert_text(fitz.Point(50, y), "1. CLINICAL MEASUREMENTS & VITAL SIGNS", fontsize=11, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 20), f"Blood Pressure: {bp} mmHg (Right Arm, Sitting, Verified)", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 36), "Heart Rate: 82 bpm | SpO2: 99% on room air", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 52), "Weight: 72.4 kg | Fundal Height: 31 cm (appropriate for GA)", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 68), "Fetal Heart Rate: 144 bpm (regular, baseline normal)", fontsize=10, fontname="helv")

    # Section 2: Urinalysis
    y = 260
    page1.insert_text(fitz.Point(50, y), "2. POINT-OF-CARE URINALYSIS", fontsize=11, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 20), f"Urine Protein: {labs.get('urine_protein', '1+')} (dipstick automated reader)", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 36), f"Protein-to-Creatinine Ratio (UPCR): {labs.get('upcr', '0.34')} mg/mg [Ref: < 0.30]", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 52), "Leukocyte Esterase: Negative | Glucose: Negative | Nitrites: Negative", fontsize=10, fontname="helv")

    # Section 3: Laboratory Assessment
    y = 350
    page1.insert_text(fitz.Point(50, y), "3. COMPREHENSIVE OBSTETRIC LABORATORY PANEL", fontsize=11, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 20), f"Platelet Count: {labs.get('platelets', '168')} x10^3/uL [Ref: 150 - 450]", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 36), f"AST (SGOT): {labs.get('ast', '32')} U/L [Ref: 10 - 40]", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 52), f"ALT (SGPT): {labs.get('alt', '28')} U/L [Ref: 7 - 35]", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 68), f"Serum Creatinine: {labs.get('creatinine', '0.78')} mg/dL [Ref: 0.40 - 0.90]", fontsize=10, fontname="helv")
    page1.insert_text(fitz.Point(70, y + 84), "Hemoglobin: 11.8 g/dL | Hematocrit: 35.2%", fontsize=10, fontname="helv")

    # Clinician Assessment notes
    y = 480
    page1.insert_text(fitz.Point(50, y), "4. ATTENDING CLINICIAN ASSESSMENT & RECOMMENDATION", fontsize=11, fontname="helv")
    assessment_text = (
        f"Patient presents at {ga} with newly elevated systolic and diastolic blood pressure ({bp} mmHg). "
        "Mild proteinuria noted on automated urinalysis with UPCR borderline elevated at 0.34 mg/mg. "
        "Platelet count and transaminases currently within acceptable ranges. "
        "Recommendation: Initiate ambulatory blood pressure monitoring twice daily, order follow-up preeclampsia labs "
        "in 7 days, and advise patient on warning signs (severe headache, scotoma, epigastric pain)."
    )
    rect_text = fitz.Rect(70, y + 15, 540, y + 110)
    page1.insert_textbox(rect_text, assessment_text, fontsize=9.5, fontname="helv")

    # Page 2: Trend & Ambulatory Verification
    page2 = doc.new_page(width=612, height=792)
    page2.draw_rect(fitz.Rect(36, 36, 576, 75), color=(0.1, 0.2, 0.35), fill=(0.04, 0.08, 0.16))
    page2.insert_text(fitz.Point(50, 58), f"AMBULATORY BLOOD PRESSURE LOG - {patient_name.upper()} (MRN: {mrn})", fontsize=12, color=(0.95, 0.96, 0.98), fontname="helv")

    y2 = 110
    page2.insert_text(fitz.Point(50, y2), "Previous 3-Visit Longitudinal Hemodynamic Trajectory:", fontsize=10, fontname="helv")
    logs = [
        "2026-07-20 (GA 24.0w): BP: 122/78 mmHg | Protein: Negative | Platelets: 210 x10^3/uL",
        "2026-08-18 (GA 28.1w): BP: 132/84 mmHg | Protein: Trace | Platelets: 192 x10^3/uL",
        "2026-09-15 (GA 31.4w): BP: 142/92 mmHg | Protein: 1+ | Platelets: 168 x10^3/uL",
    ]
    for idx, l in enumerate(logs):
        page2.insert_text(fitz.Point(70, y2 + 25 + (idx * 22)), l, fontsize=9.5, fontname="helv")

    page2.insert_text(fitz.Point(50, 240), "Physician Signature: Dr. Elena Vance, MD, FACOG (Electronic Stamp 2026-09-15 14:32 EST)", fontsize=9, color=(0.3, 0.35, 0.4), fontname="helv")

    doc.save(output_path)
    doc.close()

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if users already seeded
        existing_admin = db.query(User).filter(User.email == "dr.elena@pregtwin.org").first()
        if existing_admin:
            if db.query(MedicationOrder).count() == 0:
                print("Seeding medication orders, availability, appointments, and notifications for existing users...")
                p1 = db.query(PatientProfile).filter(PatientProfile.mrn == "MRN-PT-2026-001").first()
                p2 = db.query(PatientProfile).filter(PatientProfile.mrn == "MRN-PT-2026-002").first()
                user_p1 = p1.user if p1 else None
                if p1 and p2 and user_p1:
                    seed_assistant_data(db, existing_admin, p1, p2, user_p1)
            print("Database already contains seed records.")
            return

        print("Seeding synthetic users, patients, longitudinal observations, and twin states...")

        # 1. Clinician User
        clinician = User(
            email="dr.elena@pregtwin.org",
            hashed_password=hash_password("Clinician2026!"),
            full_name="Dr. Elena Vance, MD, FACOG",
            role="clinician",
            is_active=True,
        )
        db.add(clinician)
        db.commit()
        db.refresh(clinician)

        # 2. Patient 1: Maya Lin (31yo, GA 31.4w, Elevated trajectory, Synthetic)
        user_p1 = User(
            email="maya.lin@pregtwin.org",
            hashed_password=hash_password("Patient2026!"),
            full_name="Maya Lin",
            role="patient",
            is_active=True,
        )
        db.add(user_p1)
        db.commit()
        db.refresh(user_p1)

        p1 = PatientProfile(
            user_id=user_p1.id,
            mrn="MRN-PT-2026-001",
            first_name="Maya",
            last_name="Lin",
            date_of_birth="1995-04-12",
            maternal_age=31,
            bmi=26.4,
            gravidity=2,
            parity=0,
            chronic_hypertension=False,
            pregestational_diabetes=False,
            prior_preeclampsia=False,
            renal_disease=False,
            autoimmune_disease=False,
            multiple_gestation=False,
            is_synthetic=True,
        )
        db.add(p1)
        db.commit()
        db.refresh(p1)

        ep1 = PregnancyEpisode(
            patient_id=p1.id,
            conception_date="2026-02-08",
            estimated_due_date="2026-11-15",
            current_gestational_age_weeks=31.4,
            is_active=True,
            outcome_preeclampsia_diagnosed=False,
        )
        db.add(ep1)
        db.commit()
        db.refresh(ep1)

        # Historical Observations for Maya Lin across visits (24w, 28w, 31.4w)
        v1_time = datetime(2026, 7, 20, 10, 0, tzinfo=timezone.utc)
        v2_time = datetime(2026, 8, 18, 11, 30, tzinfo=timezone.utc)
        v3_time = datetime(2026, 9, 15, 14, 0, tzinfo=timezone.utc)

        observations_p1 = [
            # Visit 1 (GA 24.0w)
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="systolic_bp", value_numeric=122.0, value_text="122", unit="mmHg", measurement_timestamp=v1_time, gestational_age_weeks=24.0, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="diastolic_bp", value_numeric=78.0, value_text="78", unit="mmHg", measurement_timestamp=v1_time, gestational_age_weeks=24.0, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="urine_protein", test_name="proteinuria_dipstick", value_numeric=0.0, value_text="Negative", unit="dipstick_grade", measurement_timestamp=v1_time, gestational_age_weeks=24.0, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="platelet_count", value_numeric=210.0, value_text="210", unit="10^3/uL", measurement_timestamp=v1_time, gestational_age_weeks=24.0, source_type="accepted_document", review_status="ACCEPTED"),
            
            # Visit 2 (GA 28.1w)
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="systolic_bp", value_numeric=132.0, value_text="132", unit="mmHg", measurement_timestamp=v2_time, gestational_age_weeks=28.1, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="diastolic_bp", value_numeric=84.0, value_text="84", unit="mmHg", measurement_timestamp=v2_time, gestational_age_weeks=28.1, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="urine_protein", test_name="proteinuria_dipstick", value_numeric=0.5, value_text="Trace", unit="dipstick_grade", measurement_timestamp=v2_time, gestational_age_weeks=28.1, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="platelet_count", value_numeric=192.0, value_text="192", unit="10^3/uL", measurement_timestamp=v2_time, gestational_age_weeks=28.1, source_type="accepted_document", review_status="ACCEPTED"),

            # Visit 3 (GA 31.4w)
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="systolic_bp", value_numeric=142.0, value_text="142", unit="mmHg", is_abnormal=True, measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="blood_pressure", test_name="diastolic_bp", value_numeric=92.0, value_text="92", unit="mmHg", is_abnormal=True, measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="urine_protein", test_name="proteinuria_dipstick", value_numeric=1.0, value_text="1+", is_abnormal=True, unit="dipstick_grade", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="urine_protein", test_name="protein_creatinine_ratio", value_numeric=0.34, value_text="0.34", is_abnormal=True, unit="mg/mg", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="platelet_count", value_numeric=168.0, value_text="168", unit="10^3/uL", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="ast", value_numeric=32.0, value_text="32", unit="U/L", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="alt", value_numeric=28.0, value_text="28", unit="U/L", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p1.id, episode_id=ep1.id, observation_type="laboratory", test_name="serum_creatinine", value_numeric=0.78, value_text="0.78", unit="mg/dL", measurement_timestamp=v3_time, gestational_age_weeks=31.4, source_type="accepted_document", review_status="ACCEPTED"),
        ]
        db.add_all(observations_p1)
        db.commit()

        # Generate Physical PDF for Maya Lin
        pdf_path = os.path.join(settings.STORAGE_PATH, p1.id, "maya_lin_antenatal_31w.pdf")
        create_synthetic_pdf(
            output_path=pdf_path,
            patient_name=f"{p1.first_name} {p1.last_name}",
            mrn=p1.mrn,
            ga="31 weeks 4 days",
            bp="142/92",
            labs={"urine_protein": "1+", "upcr": "0.34", "platelets": "168", "ast": "32", "alt": "28", "creatinine": "0.78"}
        )

        # Store MedicalDocument record for Maya Lin
        doc_p1 = MedicalDocument(
            id="doc_maya_31w",
            patient_id=p1.id,
            episode_id=ep1.id,
            filename="maya_lin_antenatal_31w.pdf",
            file_path=pdf_path,
            file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_size_bytes=os.path.getsize(pdf_path),
            mime_type="application/pdf",
            category="Antenatal visit summary",
            report_date="2026-09-15",
            source_institution="St. Margaret Maternal-Fetal Medicine Center",
            processing_status="EXTRACTED",
            page_count=2,
            ai_provider="Deterministic Clinical Rules",
        )
        db.add(doc_p1)
        db.commit()
        db.refresh(doc_p1)

        # Add Extracted fields with bounding coordinates
        fields_p1 = [
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="systolic_bp", category="blood_pressure", extracted_value="142", unit="mmHg", source_text="Blood Pressure: 142/92 mmHg", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.22, "width": 0.65, "height": 0.03}), confidence=0.98, validation_status="ALERT_STAGE_1_HTN", review_status="ACCEPTED"),
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="diastolic_bp", category="blood_pressure", extracted_value="92", unit="mmHg", source_text="Blood Pressure: 142/92 mmHg", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.22, "width": 0.65, "height": 0.03}), confidence=0.98, validation_status="ALERT_STAGE_1_HTN", review_status="ACCEPTED"),
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="proteinuria_dipstick", category="urine_protein", extracted_value="1+", unit="dipstick_grade", source_text="Urine Protein: 1+ (dipstick automated reader)", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.35, "width": 0.65, "height": 0.03}), confidence=0.96, validation_status="ALERT_PROTEINURIA", review_status="ACCEPTED"),
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="protein_creatinine_ratio", category="urine_protein", extracted_value="0.34", unit="mg/mg", source_text="Protein-to-Creatinine Ratio (UPCR): 0.34 mg/mg", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.37, "width": 0.65, "height": 0.03}), confidence=0.95, validation_status="ALERT_ELEVATED", review_status="UNREVIEWED"),
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="platelet_count", category="laboratory", extracted_value="168", unit="10^3/uL", source_text="Platelet Count: 168 x10^3/uL", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.46, "width": 0.65, "height": 0.03}), confidence=0.96, validation_status="VALID", review_status="ACCEPTED"),
            ExtractedField(document_id=doc_p1.id, patient_id=p1.id, field_name="ast", category="laboratory", extracted_value="32", unit="U/L", source_text="AST (SGOT): 32 U/L", source_page=1, bounding_box_json=json.dumps({"x": 0.11, "y": 0.48, "width": 0.65, "height": 0.03}), confidence=0.95, validation_status="VALID", review_status="ACCEPTED"),
        ]
        db.add_all(fields_p1)

        summary_p1 = ReportSummary(
            document_id=doc_p1.id,
            factual_summary="Routine antenatal visit for 31yo G2P0 at 31.4 weeks GA showing acute escalation of blood pressure to 142/92 mmHg with automated dipstick 1+ protein and UPCR 0.34 mg/mg.",
            key_findings="Elevated blood pressure 142/92 mmHg; 1+ proteinuria; UPCR 0.34 mg/mg; Platelets 168 x10^3/uL (declining from 210 at 24w).",
            changes_vs_prior="Systolic blood pressure rose +20 mmHg compared to 24-week baseline (122 -> 142 mmHg). Proteinuria progressed from Negative to 1+.",
            conflicting_info="None within report.",
            missing_info="Serum uric acid not documented in this panel.",
            uncertainties="UPCR is borderline elevated (0.34 vs ref < 0.30 mg/mg); repeat testing advised.",
            clinician_review_prompts="Confirm manual repeat BP in 4 hours; verify UPCR on morning clean-catch sample; check for headache/visual disturbances.",
            provider_metadata=json.dumps({"engine": "synthetic_seed_v1", "fields": 6})
        )
        db.add(summary_p1)
        db.commit()

        # Update Twin State & Risk Prediction for Maya Lin
        twin_service.update_twin_state(db, p1.id, episode_id=ep1.id, as_of_timestamp=v3_time)
        pred_p1 = prediction_engine.evaluate_risk(db, p1.id, prediction_timestamp=v3_time)

        # 3. Patient 2: Sophia Reyes (36yo, GA 27.2w, High Baseline Risk)
        user_p2 = User(
            email="sophia.reyes@pregtwin.org",
            hashed_password=hash_password("Patient2026!"),
            full_name="Sophia Reyes",
            role="patient",
            is_active=True,
        )
        db.add(user_p2)
        db.commit()
        db.refresh(user_p2)

        p2 = PatientProfile(
            user_id=user_p2.id,
            mrn="MRN-PT-2026-002",
            first_name="Sophia",
            last_name="Reyes",
            date_of_birth="1990-08-22",
            maternal_age=36,
            bmi=31.2,
            gravidity=3,
            parity=1,
            chronic_hypertension=True,
            prior_preeclampsia=True,
            pregestational_diabetes=False,
            renal_disease=False,
            autoimmune_disease=False,
            multiple_gestation=False,
            is_synthetic=True,
        )
        db.add(p2)
        db.commit()
        db.refresh(p2)

        ep2 = PregnancyEpisode(
            patient_id=p2.id,
            conception_date="2026-03-09",
            estimated_due_date="2026-12-14",
            current_gestational_age_weeks=27.2,
            is_active=True,
            outcome_preeclampsia_diagnosed=False,
        )
        db.add(ep2)
        db.commit()
        db.refresh(ep2)

        time_p2 = datetime(2026, 9, 10, 9, 0, tzinfo=timezone.utc)
        obs_p2 = [
            ClinicalObservation(patient_id=p2.id, episode_id=ep2.id, observation_type="blood_pressure", test_name="systolic_bp", value_numeric=138.0, value_text="138", unit="mmHg", measurement_timestamp=time_p2, gestational_age_weeks=27.2, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p2.id, episode_id=ep2.id, observation_type="blood_pressure", test_name="diastolic_bp", value_numeric=88.0, value_text="88", unit="mmHg", measurement_timestamp=time_p2, gestational_age_weeks=27.2, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p2.id, episode_id=ep2.id, observation_type="urine_protein", test_name="proteinuria_dipstick", value_numeric=0.5, value_text="Trace", unit="dipstick_grade", measurement_timestamp=time_p2, gestational_age_weeks=27.2, source_type="accepted_document", review_status="ACCEPTED"),
            ClinicalObservation(patient_id=p2.id, episode_id=ep2.id, observation_type="laboratory", test_name="platelet_count", value_numeric=174.0, value_text="174", unit="10^3/uL", measurement_timestamp=time_p2, gestational_age_weeks=27.2, source_type="accepted_document", review_status="ACCEPTED"),
        ]
        db.add_all(obs_p2)
        db.commit()
        twin_service.update_twin_state(db, p2.id, episode_id=ep2.id, as_of_timestamp=time_p2)
        prediction_engine.evaluate_risk(db, p2.id, prediction_timestamp=time_p2)

        # 4. Patient 3: Clara Novak (26yo, GA 16.0w - Demonstrates INSUFFICIENT DATA / GESTATIONAL AGE GUARD)
        user_p3 = User(
            email="clara.novak@pregtwin.org",
            hashed_password=hash_password("Patient2026!"),
            full_name="Clara Novak",
            role="patient",
            is_active=True,
        )
        db.add(user_p3)
        db.commit()
        db.refresh(user_p3)

        p3 = PatientProfile(
            user_id=user_p3.id,
            mrn="MRN-PT-2026-003",
            first_name="Clara",
            last_name="Novak",
            date_of_birth="2000-01-15",
            maternal_age=26,
            bmi=22.1,
            gravidity=1,
            parity=0,
            chronic_hypertension=False,
            prior_preeclampsia=False,
            pregestational_diabetes=False,
            renal_disease=False,
            autoimmune_disease=False,
            multiple_gestation=False,
            is_synthetic=True,
        )
        db.add(p3)
        db.commit()
        db.refresh(p3)

        ep3 = PregnancyEpisode(
            patient_id=p3.id,
            conception_date="2026-05-28",
            estimated_due_date="2027-03-05",
            current_gestational_age_weeks=16.0,
            is_active=True,
            outcome_preeclampsia_diagnosed=False,
        )
        db.add(ep3)
        db.commit()
        db.refresh(ep3)

        # Evaluate Clara Novak: this triggers the strict < 20 weeks guard!
        twin_service.update_twin_state(db, p3.id, episode_id=ep3.id)
        pred_p3 = prediction_engine.evaluate_risk(db, p3.id)

        seed_assistant_data(db, clinician, p1, p2, user_p1)
        print("Database seeded successfully with synthetic patients, documents, observations, predictions, medication orders, availability, and appointments.")

    finally:
        db.close()

def seed_assistant_data(db: Session, clinician: User, p1: PatientProfile, p2: PatientProfile, user_p1: User):
    # 5. Doctor Availability for Dr. Elena Vance (Mon-Fri 09:00-17:00, 30m slots)
    for d in range(5):  # Monday to Friday
        avail = DoctorAvailability(
            doctor_id=clinician.id,
            day_of_week=d,
            start_time="09:00",
            end_time="17:00",
            slot_duration_minutes=30,
            break_start="12:00",
            break_end="13:00",
            timezone="UTC",
            is_active=True,
            max_daily_capacity=12
        )
        db.add(avail)
    db.commit()

    # 6. Medication Orders for Maya Lin (p1)
    med_labetalol = MedicationOrder(
        patient_id=p1.id,
        prescribing_clinician_id=clinician.id,
        medication_name="Labetalol",
        strength="100 mg",
        formulation="Oral tablet",
        prescribed_dose="100 mg",
        route="oral",
        frequency="twice daily",
        timing_json=json.dumps(["08:00", "20:00"]),
        start_date="2026-09-15",
        clinician_instructions="Take 1 tablet (100 mg) twice daily with meals. Monitor home blood pressure before morning dose.",
        warnings_precautions="Report heart rate < 55 bpm, severe dizziness, lightheadedness, or shortness of breath. Do not discontinue abruptly.",
        status="APPROVED",
        version=1,
        approved_by_id=clinician.id,
        approved_at=datetime(2026, 9, 15, 14, 30, tzinfo=timezone.utc),
        created_at=datetime(2026, 9, 15, 14, 0, tzinfo=timezone.utc)
    )
    med_aspirin = MedicationOrder(
        patient_id=p1.id,
        prescribing_clinician_id=clinician.id,
        medication_name="Low-Dose Aspirin",
        strength="81 mg",
        formulation="Oral tablet",
        prescribed_dose="81 mg",
        route="oral",
        frequency="once daily at bedtime",
        timing_json=json.dumps(["21:00"]),
        start_date="2026-07-20",
        clinician_instructions="Take 1 tablet (81 mg) daily at bedtime with a full glass of water.",
        warnings_precautions="Take with food. Report any unusual bleeding or persistent stomach pain. Will be discontinued at 36 weeks.",
        status="APPROVED",
        version=1,
        approved_by_id=clinician.id,
        approved_at=datetime(2026, 7, 20, 10, 30, tzinfo=timezone.utc),
        created_at=datetime(2026, 7, 20, 10, 0, tzinfo=timezone.utc)
    )
    med_prenatal_draft = MedicationOrder(
        patient_id=p1.id,
        prescribing_clinician_id=clinician.id,
        medication_name="Prenatal Vitamins with Iron",
        strength="Standard Obstetric Formulation",
        formulation="Oral capsule",
        prescribed_dose="1 capsule",
        route="oral",
        frequency="once daily in the morning",
        timing_json=json.dumps(["09:00"]),
        start_date="2026-09-16",
        clinician_instructions="Take 1 capsule daily with breakfast. Increase dietary fiber to prevent constipation.",
        warnings_precautions="Do not take at the exact same hour as antacids or calcium supplements.",
        status="DRAFT",  # Awaiting review in doctor queue
        version=1,
        created_at=datetime(2026, 9, 15, 16, 0, tzinfo=timezone.utc)
    )
    # Medication Order for Sophia Reyes (p2)
    med_nifedipine = MedicationOrder(
        patient_id=p2.id,
        prescribing_clinician_id=clinician.id,
        medication_name="Nifedipine Extended Release",
        strength="30 mg",
        formulation="Oral extended-release tablet",
        prescribed_dose="30 mg",
        route="oral",
        frequency="once daily in morning",
        timing_json=json.dumps(["08:00"]),
        start_date="2026-08-01",
        clinician_instructions="Swallow tablet whole with water. Do not crush, chew, or divide.",
        warnings_precautions="Avoid grapefruit juice. Report swelling of ankles or severe headache.",
        status="APPROVED",
        version=1,
        approved_by_id=clinician.id,
        approved_at=datetime(2026, 8, 1, 9, 30, tzinfo=timezone.utc),
        created_at=datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc)
    )
    db.add_all([med_labetalol, med_aspirin, med_prenatal_draft, med_nifedipine])
    db.commit()

    # 7. Initial Dose Logs for Maya Lin
    dose_log1 = MedicationDoseLog(
        order_id=med_labetalol.id,
        patient_id=p1.id,
        scheduled_time=datetime(2026, 9, 16, 8, 0, tzinfo=timezone.utc),
        logged_time=datetime(2026, 9, 16, 8, 15, tzinfo=timezone.utc),
        status="TAKEN",
        patient_notes="Taken with oatmeal breakfast. Resting BP was 134/86."
    )
    dose_log2 = MedicationDoseLog(
        order_id=med_labetalol.id,
        patient_id=p1.id,
        scheduled_time=datetime(2026, 9, 16, 20, 0, tzinfo=timezone.utc),
        logged_time=datetime(2026, 9, 16, 20, 10, tzinfo=timezone.utc),
        status="TAKEN",
        patient_notes="Taken after dinner."
    )
    db.add_all([dose_log1, dose_log2])
    db.commit()

    # 8. Upcoming Confirmed Appointment for Maya Lin
    appt_time = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)
    appt1 = Appointment(
        patient_id=p1.id,
        doctor_id=clinician.id,
        start_time=appt_time,
        end_time=appt_time + timedelta(minutes=30),
        status="CONFIRMED",
        appointment_type="in_person",
        reason="Follow-up maternal blood pressure evaluation and preeclampsia lab review",
        booking_channel="clinician_manual"
    )
    db.add(appt1)
    db.commit()

    # 9. Initial Persistent Notifications
    notif_p1 = Notification(
        user_id=user_p1.id,
        patient_id=p1.id,
        category="MEDICATION_ORDER_UPDATED",
        title="Prescription Approved: Labetalol 100 mg",
        message="Dr. Elena Vance has prescribed Labetalol 100 mg twice daily. Please review your updated care plan and dosage schedule.",
        priority="NORMAL",
        link_url="/medications",
        is_read=False,
        delivery_status="DELIVERED"
    )
    notif_p1_appt = Notification(
        user_id=user_p1.id,
        patient_id=p1.id,
        category="APPOINTMENT_CONFIRMED",
        title="Appointment Confirmed: Sept 22 at 10:00 AM",
        message="Your antenatal checkup with Dr. Elena Vance is scheduled for Tuesday, Sept 22 at 10:00 AM.",
        priority="NORMAL",
        link_url="/appointments",
        is_read=False,
        delivery_status="DELIVERED"
    )
    notif_doc = Notification(
        user_id=clinician.id,
        patient_id=p1.id,
        category="MEDICATION_ORDER_UPDATED",
        title="Pending Order Review: Maya Lin",
        message="Prenatal Multivitamin with Iron order is currently in DRAFT status awaiting your final clinical approval.",
        priority="NORMAL",
        link_url="/clinician/review-queue",
        is_read=False,
        delivery_status="DELIVERED"
    )
    db.add_all([notif_p1, notif_p1_appt, notif_doc])
    db.commit()

if __name__ == "__main__":
    seed_database()
