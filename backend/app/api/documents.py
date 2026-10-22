import os
import json
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    User,
    PatientProfile,
    MedicalDocument,
    ExtractedField,
    ReportSummary,
    ClinicalObservation,
    PregnancyEpisode,
)
from app.schemas.models import (
    MedicalDocumentResponse,
    ExtractedFieldSchema,
    ReportSummarySchema,
    BoundingBox,
    FieldReviewRequest,
)
from app.api.deps import get_current_user, require_clinician, verify_patient_access
from app.services.document_processor import document_processor
from app.services.ai_extractor import ai_extractor
from app.services.twin_service import twin_service
from app.services.prediction_service import prediction_engine
from app.services.audit_service import audit_service

router = APIRouter(prefix="/documents", tags=["Medical Documents"])

def resolve_effective_field_value(field: ExtractedField) -> Tuple[Optional[float], str]:
    """
    Deterministically resolves the effective value for an ExtractedField:
    - If field.review_status == 'MODIFIED' and field.clinician_correction is set:
        Uses field.clinician_correction.
    - Otherwise uses field.extracted_value.
    - Preserves field.extracted_value unmodified in all cases.
    - Returns (numeric_value, text_value).
    """
    effective_text = (
        str(field.clinician_correction).strip()
        if (field.review_status == "MODIFIED" and field.clinician_correction is not None and str(field.clinician_correction).strip())
        else str(field.extracted_value or "").strip()
    )

    numeric_val = None
    try:
        numeric_val = float(effective_text)
    except (ValueError, TypeError):
        pass

    return numeric_val, effective_text

def _resolve_field_measurement_time(field: ExtractedField, doc: Optional[MedicalDocument]) -> datetime:
    """
    Deterministically resolves measurement timestamp for a clinical field:
    1. Checks if field.source_text contains an explicit timestamp (e.g. '2026-09-20' or '2026-10-18 07:40').
    2. Falls back to document report_date.
    3. Falls back to current UTC time.
    """
    if field.source_text:
        m = re.search(r"\b(20\d{2}[-/][01]\d[-/][0-3]\d(?:\s+[0-2]\d:[0-5]\d(?::[0-5]\d)?)?)\b", str(field.source_text))
        if m:
            clean_s = m.group(1).replace("/", "-")
            try:
                if " " in clean_s:
                    return datetime.strptime(clean_s, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
                return datetime.strptime(clean_s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass
    if doc and doc.report_date:
        try:
            return datetime.strptime(doc.report_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return datetime.now(timezone.utc)

def _resolve_observation_gestational_age(db: Session, patient_id: str, doc: Optional[MedicalDocument], meas_time: datetime) -> Optional[float]:
    """
    Deterministically resolves gestational age for clinical observations extracted from documents.
    1. Checks if document contains an extracted gestational age field.
    2. Checks patient's active pregnancy episode conception date.
    3. Checks patient's recorded current gestational age.
    Never falls back to arbitrary hardcoded numbers (e.g. 28.0).
    """
    if doc and doc.extracted_fields:
        for f in doc.extracted_fields:
            if f.field_name and f.field_name.lower() in ("gestational_age", "ga", "gestational_age_weeks") and f.extracted_value:
                try:
                    match = re.search(r"([1-4]?\d(?:\.[0-6])?)", str(f.extracted_value))
                    if match:
                        ga = float(match.group(1))
                        if 4.0 <= ga <= 45.0:
                            return ga
                except Exception:
                    pass

    episode = db.query(PregnancyEpisode).filter(PregnancyEpisode.patient_id == patient_id, PregnancyEpisode.is_active == True).first()
    if episode and episode.conception_date:
        try:
            c_date = datetime.strptime(episode.conception_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            ref_time = meas_time if meas_time.tzinfo else meas_time.replace(tzinfo=timezone.utc)
            diff_days = (ref_time - c_date).days
            if diff_days > 0:
                return round(diff_days / 7.0, 1)
        except Exception:
            pass

    if episode and episode.current_gestational_age_weeks:
        return episode.current_gestational_age_weeks

    return None

def _format_document_response(doc: MedicalDocument) -> MedicalDocumentResponse:
    fields_data = []
    for f in doc.extracted_fields:
        bbox = None
        if f.bounding_box_json:
            try:
                bdict = json.loads(f.bounding_box_json)
                bbox = BoundingBox(
                    x=bdict.get("x", 0.0),
                    y=bdict.get("y", 0.0),
                    width=bdict.get("width", 0.0),
                    height=bdict.get("height", 0.0),
                )
            except Exception:
                pass
        fields_data.append(
            ExtractedFieldSchema(
                id=f.id,
                document_id=f.document_id,
                field_name=f.field_name,
                category=f.category,
                extracted_value=f.extracted_value,
                unit=f.unit,
                source_text=f.source_text,
                source_page=f.source_page,
                bounding_box=bbox,
                confidence=f.confidence,
                extraction_method=f.extraction_method,
                validation_status=f.validation_status,
                review_status=f.review_status,
                clinician_correction=f.clinician_correction,
                clinician_notes=f.clinician_notes,
            )
        )

    summary_data = None
    if doc.summary:
        summary_data = ReportSummarySchema(
            id=doc.summary.id,
            document_id=doc.summary.document_id,
            factual_summary=doc.summary.factual_summary,
            key_findings=doc.summary.key_findings,
            changes_vs_prior=doc.summary.changes_vs_prior,
            conflicting_info=doc.summary.conflicting_info,
            missing_info=doc.summary.missing_info,
            uncertainties=doc.summary.uncertainties,
            clinician_review_prompts=doc.summary.clinician_review_prompts,
            provider_metadata=doc.summary.provider_metadata,
        )

    return MedicalDocumentResponse(
        id=doc.id,
        patient_id=doc.patient_id,
        episode_id=doc.episode_id,
        filename=doc.filename,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        category=doc.category,
        report_date=doc.report_date,
        source_institution=doc.source_institution,
        processing_status=doc.processing_status,
        ocr_engine=doc.ocr_engine,
        ai_provider=doc.ai_provider,
        page_count=doc.page_count,
        created_at=doc.created_at,
        extracted_fields=fields_data,
        summary=summary_data,
    )

@router.post("/upload", response_model=MedicalDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    category: Optional[str] = Form("Antenatal visit summary"),
    report_date: Optional[str] = Form(None),
    source_institution: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify access to this patient
    verify_patient_access(patient_id, current_user, db)

    file_bytes = await file.read()
    filename = file.filename or "uploaded_document.pdf"
    content_type = file.content_type or "application/pdf"

    # Validate file size and signature/magic bytes
    is_valid, validation_msg = document_processor.validate_file(file_bytes, filename, content_type)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation_msg)

    file_size = len(file_bytes)
    file_hash = document_processor.calculate_file_hash(file_bytes)

    # Client retry / idempotency guard: return existing extracted/completed document
    existing_doc = (
        db.query(MedicalDocument)
        .filter(MedicalDocument.patient_id == patient_id, MedicalDocument.file_hash == file_hash)
        .first()
    )
    if existing_doc and existing_doc.processing_status in ("EXTRACTED", "COMPLETED", "REVIEW_PENDING"):
        return _format_document_response(existing_doc)

    doc_id = str(uuid.uuid4())

    # Save to private storage
    file_path = document_processor.save_file(patient_id, doc_id, filename, file_bytes)

    # Persistent document record
    doc = MedicalDocument(
        id=doc_id,
        patient_id=patient_id,
        filename=filename,
        file_path=file_path,
        file_hash=file_hash,
        file_size_bytes=file_size,
        mime_type=content_type,
        category=category,
        report_date=report_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        source_institution=source_institution or "Obstetric Clinical Center",
        processing_status="PROCESSING",
    )
    db.add(doc)
    db.commit()

    # Step 1: Extract text & bounding blocks
    try:
        full_text, pages_data, page_count = document_processor.extract_text_and_blocks(file_path, doc.mime_type)
        doc.extracted_text = full_text
        doc.page_count = page_count

        # Step 2: AI / Deterministic Extraction
        extraction_res = await ai_extractor.extract_and_summarize(full_text, pages_data)
        doc.ai_provider = extraction_res.provider_name
        if category == "Antenatal visit summary" and extraction_res.category != "Antenatal visit summary":
            doc.category = extraction_res.category

        # Save Extracted Fields
        for f in extraction_res.extracted_fields:
            bbox_json = json.dumps(f.get("bounding_box")) if f.get("bounding_box") else None
            field_obj = ExtractedField(
                document_id=doc.id,
                patient_id=patient_id,
                field_name=f["field_name"],
                category=f["category"],
                extracted_value=str(f["extracted_value"]),
                unit=f.get("unit"),
                source_text=f.get("source_text"),
                source_page=f.get("source_page", 1),
                bounding_box_json=bbox_json,
                confidence=f.get("confidence", 0.95),
                extraction_method=f.get("extraction_method", "deterministic_regex"),
                validation_status=f.get("validation_status", "VALID"),
                review_status="UNREVIEWED",
            )
            db.add(field_obj)

        # Save Report Summary
        summary_obj = ReportSummary(
            document_id=doc.id,
            factual_summary=extraction_res.summary["factual_summary"],
            key_findings=extraction_res.summary["key_findings"],
            changes_vs_prior=extraction_res.summary.get("changes_vs_prior"),
            conflicting_info=extraction_res.summary.get("conflicting_info"),
            missing_info=extraction_res.summary.get("missing_info"),
            uncertainties=extraction_res.summary.get("uncertainties"),
            clinician_review_prompts=extraction_res.summary.get("clinician_review_prompts"),
            provider_metadata=extraction_res.summary.get("provider_metadata"),
        )
        db.add(summary_obj)

        doc.processing_status = "EXTRACTED"
        db.commit()
        db.refresh(doc)

        audit_service.log_event(
            db=db,
            action="DOCUMENT_UPLOAD_AND_EXTRACTED",
            user=current_user,
            target_type="MedicalDocument",
            target_id=doc.id,
            details={"filename": doc.filename, "fields_extracted": len(extraction_res.extracted_fields)}
        )

    except Exception as e:
        db.rollback()
        doc.processing_status = "FAILED"
        doc.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

    return _format_document_response(doc)

@router.get("/{document_id}", response_model=MedicalDocumentResponse)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_patient_access(doc.patient_id, current_user, db)
    return _format_document_response(doc)

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    verify_patient_access(doc.patient_id, current_user, db)
    return FileResponse(doc.file_path, media_type=doc.mime_type, filename=doc.filename)

@router.post("/{document_id}/fields/{field_id}/review")
def review_extracted_field(
    document_id: str,
    field_id: str,
    review_req: FieldReviewRequest,
    current_user: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    field = db.query(ExtractedField).filter(ExtractedField.id == field_id, ExtractedField.document_id == document_id).first()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")

    decision = review_req.decision.upper().strip()
    if decision in ("ACCEPTED", "ACCEPT"):
        decision = "ACCEPT"
    elif decision in ("REJECTED", "REJECT"):
        decision = "REJECT"
    elif decision in ("MODIFIED", "MODIFY"):
        decision = "MODIFY"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be ACCEPT, REJECT, or MODIFY")

    if decision == "MODIFY":
        if not review_req.correction_value or not str(review_req.correction_value).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid non-empty correction_value is required when review decision is MODIFY."
            )
        correction_str = str(review_req.correction_value).strip()
        fn = (field.field_name or "").lower().strip()

        # Physiological range validation for clinical corrections
        if fn in ("systolic_bp", "sbp", "diastolic_bp", "dbp", "platelet_count", "platelets", "ast", "alt", "serum_creatinine", "fasting_glucose", "ogtt_glucose", "gestational_age_weeks"):
            try:
                num = float(correction_str)
                if fn in ("systolic_bp", "sbp") and not (60 <= num <= 260):
                    raise ValueError(f"Systolic blood pressure {num} outside plausible clinical bounds [60-260 mmHg]")
                elif fn in ("diastolic_bp", "dbp") and not (30 <= num <= 160):
                    raise ValueError(f"Diastolic blood pressure {num} outside plausible clinical bounds [30-160 mmHg]")
                elif fn in ("platelet_count", "platelets") and not (5 <= num <= 1000):
                    raise ValueError(f"Platelet count {num} outside plausible bounds [5-1000 x10^3/uL]")
                elif fn in ("ast", "alt") and not (5 <= num <= 2000):
                    raise ValueError(f"Liver enzyme {fn} value {num} outside plausible bounds [5-2000 U/L]")
                elif fn == "serum_creatinine" and not (0.1 <= num <= 20.0):
                    raise ValueError(f"Creatinine {num} outside plausible bounds [0.1-20.0 mg/dL]")
                elif "glucose" in fn and not (20 <= num <= 600):
                    raise ValueError(f"Glucose {num} outside plausible bounds [20-600 mg/dL]")
                elif fn == "gestational_age_weeks" and not (4.0 <= num <= 45.0):
                    raise ValueError(f"Gestational age {num} outside plausible bounds [4.0-45.0 weeks]")
            except ValueError as ve:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid clinical correction: {str(ve)}")

        field.clinician_correction = correction_str
        field.review_status = "MODIFIED"
    elif decision == "ACCEPT":
        field.review_status = "ACCEPTED"
    elif decision == "REJECT":
        field.review_status = "REJECTED"

    field.clinician_notes = review_req.clinician_notes
    field.reviewed_by_id = current_user.id
    field.reviewed_at = datetime.now(timezone.utc)

    val_num, effective_val = resolve_effective_field_value(field)

    # Check for existing observation linked to this extracted field
    existing_obs = (
        db.query(ClinicalObservation)
        .filter(ClinicalObservation.source_extracted_field_id == field.id)
        .first()
    )

    # If ACCEPT or MODIFY, convert to an accepted ClinicalObservation idempotently
    if decision in ("ACCEPT", "MODIFY"):
        meas_time = _resolve_field_measurement_time(field, field.document)
        obs_ga = _resolve_observation_gestational_age(db, field.patient_id, field.document, meas_time)

        if existing_obs:
            existing_obs.observation_type = field.category
            existing_obs.test_name = field.field_name
            existing_obs.value_numeric = val_num
            existing_obs.value_text = effective_val
            existing_obs.unit = field.unit
            existing_obs.is_abnormal = "ALERT" in (field.validation_status or "")
            existing_obs.measurement_timestamp = meas_time
            existing_obs.gestational_age_weeks = obs_ga
            existing_obs.review_status = "ACCEPTED"
        else:
            obs = ClinicalObservation(
                patient_id=field.patient_id,
                source_document_id=field.document_id,
                source_extracted_field_id=field.id,
                observation_type=field.category,
                test_name=field.field_name,
                value_numeric=val_num,
                value_text=effective_val,
                unit=field.unit,
                is_abnormal="ALERT" in (field.validation_status or ""),
                measurement_timestamp=meas_time,
                gestational_age_weeks=obs_ga,
                source_type="accepted_document",
                review_status="ACCEPTED"
            )
            db.add(obs)

    elif decision == "REJECT":
        if existing_obs:
            db.delete(existing_obs)

    db.commit()
    db.refresh(field)

    # Update digital twin state snapshot and recompute prediction
    twin_service.update_twin_state(db, field.patient_id)
    prediction_engine.evaluate_risk(db, field.patient_id)

    audit_service.log_event(
        db=db,
        action=f"FIELD_REVIEW_{decision}",
        user=current_user,
        target_type="ExtractedField",
        target_id=field.id,
        details={"field_name": field.field_name, "decision": decision, "effective_val": effective_val}
    )

    return {"status": "success", "field_id": field.id, "review_status": field.review_status}

@router.post("/{document_id}/accept-all")
def accept_all_document_fields(
    document_id: str,
    current_user: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    meas_time = datetime.now(timezone.utc)
    if doc.report_date:
        try:
            meas_time = datetime.strptime(doc.report_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass

    obs_ga = _resolve_observation_gestational_age(db, doc.patient_id, doc, meas_time)

    accepted_count = 0
    skipped_rejected_count = 0

    try:
        for field in doc.extracted_fields:
            # PT-002: Never resurrect rejected fields!
            if field.review_status == "REJECTED":
                skipped_rejected_count += 1
                # If an observation existed from prior state, delete it
                existing_obs = (
                    db.query(ClinicalObservation)
                    .filter(ClinicalObservation.source_extracted_field_id == field.id)
                    .first()
                )
                if existing_obs:
                    db.delete(existing_obs)
                continue

            # PT-001: For MODIFIED fields, preserve clinician_correction as effective value;
            # For UNREVIEWED fields, transition to ACCEPTED.
            if field.review_status != "MODIFIED":
                field.review_status = "ACCEPTED"

            field.reviewed_by_id = current_user.id
            field.reviewed_at = datetime.now(timezone.utc)

            val_num, effective_text = resolve_effective_field_value(field)
            field_meas_time = _resolve_field_measurement_time(field, doc)
            field_obs_ga = _resolve_observation_gestational_age(db, doc.patient_id, doc, field_meas_time)

            existing_obs = (
                db.query(ClinicalObservation)
                .filter(ClinicalObservation.source_extracted_field_id == field.id)
                .first()
            )

            if existing_obs:
                existing_obs.observation_type = field.category
                existing_obs.test_name = field.field_name
                existing_obs.value_numeric = val_num
                existing_obs.value_text = effective_text
                existing_obs.unit = field.unit
                existing_obs.is_abnormal = "ALERT" in (field.validation_status or "")
                existing_obs.measurement_timestamp = field_meas_time
                existing_obs.gestational_age_weeks = field_obs_ga
                existing_obs.review_status = "ACCEPTED"
            else:
                obs = ClinicalObservation(
                    patient_id=field.patient_id,
                    source_document_id=field.document_id,
                    source_extracted_field_id=field.id,
                    observation_type=field.category,
                    test_name=field.field_name,
                    value_numeric=val_num,
                    value_text=effective_text,
                    unit=field.unit,
                    is_abnormal="ALERT" in (field.validation_status or ""),
                    measurement_timestamp=field_meas_time,
                    gestational_age_weeks=field_obs_ga,
                    source_type="accepted_document",
                    review_status="ACCEPTED"
                )
                db.add(obs)

            accepted_count += 1

        doc.processing_status = "COMPLETED"
        db.commit()

        # Refresh twin state and predictions
        twin_service.update_twin_state(db, doc.patient_id)
        prediction_engine.evaluate_risk(db, doc.patient_id)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to batch accept document fields: {str(e)}")

    audit_service.log_event(
        db=db,
        action="DOCUMENT_ACCEPT_ALL_FIELDS",
        user=current_user,
        target_type="MedicalDocument",
        target_id=doc.id,
        details={
            "accepted_fields_count": accepted_count,
            "skipped_rejected_count": skipped_rejected_count
        }
    )

    return {
        "status": "success",
        "message": f"Processed fields: {accepted_count} accepted, {skipped_rejected_count} rejected fields preserved.",
        "accepted_count": accepted_count,
        "skipped_rejected_count": skipped_rejected_count
    }
