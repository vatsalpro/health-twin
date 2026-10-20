import os
import json
from datetime import datetime, timezone
from typing import Optional, List
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
    file_size = len(file_bytes)
    if file_size > 30 * 1024 * 1024:  # 30 MB max
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds maximum size limit (30MB)")

    file_hash = document_processor.calculate_file_hash(file_bytes)
    doc_id = str(file_hash[:16])

    # Save to private storage
    file_path = document_processor.save_file(patient_id, doc_id, file.filename, file_bytes)

    # Persistent document record
    doc = MedicalDocument(
        id=doc_id,
        patient_id=patient_id,
        filename=file.filename,
        file_path=file_path,
        file_hash=file_hash,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/pdf",
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

    decision = review_req.decision.upper()
    if decision not in ("ACCEPT", "REJECT", "MODIFY"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be ACCEPT, REJECT, or MODIFY")

    field.review_status = "ACCEPTED" if decision == "ACCEPT" else ("MODIFIED" if decision == "MODIFY" else "REJECTED")
    field.clinician_notes = review_req.clinician_notes
    field.reviewed_by_id = current_user.id
    field.reviewed_at = datetime.now(timezone.utc)

    if decision == "MODIFY" and review_req.correction_value:
        field.clinician_correction = review_req.correction_value

    effective_val = field.clinician_correction if (decision == "MODIFY" and field.clinician_correction) else field.extracted_value

    # If ACCEPT or MODIFY, convert to an accepted ClinicalObservation
    if decision in ("ACCEPT", "MODIFY"):
        val_num = None
        try:
            val_num = float(effective_val)
        except ValueError:
            pass

        # Measurement timestamp from document report_date
        meas_time = datetime.now(timezone.utc)
        if field.document.report_date:
            try:
                meas_time = datetime.strptime(field.document.report_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass

        obs = ClinicalObservation(
            patient_id=field.patient_id,
            source_document_id=field.document_id,
            source_extracted_field_id=field.id,
            observation_type=field.category,
            test_name=field.field_name,
            value_numeric=val_num,
            value_text=effective_val,
            unit=field.unit,
            is_abnormal="ALERT" in field.validation_status,
            measurement_timestamp=meas_time,
            gestational_age_weeks=28.0,
            source_type="accepted_document",
            review_status="ACCEPTED"
        )
        db.add(obs)
        db.commit()

        # Update digital twin state snapshot and recompute prediction
        twin_service.update_twin_state(db, field.patient_id)
        prediction_engine.evaluate_risk(db, field.patient_id)

    db.commit()
    db.refresh(field)

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

    for field in doc.extracted_fields:
        field.review_status = "ACCEPTED"
        field.reviewed_by_id = current_user.id
        field.reviewed_at = datetime.now(timezone.utc)

        val_num = None
        try:
            val_num = float(field.extracted_value)
        except ValueError:
            pass

        obs = ClinicalObservation(
            patient_id=field.patient_id,
            source_document_id=field.document_id,
            source_extracted_field_id=field.id,
            observation_type=field.category,
            test_name=field.field_name,
            value_numeric=val_num,
            value_text=field.extracted_value,
            unit=field.unit,
            is_abnormal="ALERT" in field.validation_status,
            measurement_timestamp=meas_time,
            gestational_age_weeks=28.0,
            source_type="accepted_document",
            review_status="ACCEPTED"
        )
        db.add(obs)

    doc.processing_status = "COMPLETED"
    db.commit()

    # Refresh twin state and predictions
    twin_service.update_twin_state(db, doc.patient_id)
    prediction_engine.evaluate_risk(db, doc.patient_id)

    audit_service.log_event(
        db=db,
        action="DOCUMENT_ACCEPT_ALL_FIELDS",
        user=current_user,
        target_type="MedicalDocument",
        target_id=doc.id,
        details={"accepted_fields_count": len(doc.extracted_fields)}
    )

    return {"status": "success", "message": f"All {len(doc.extracted_fields)} fields accepted and incorporated into digital twin."}
