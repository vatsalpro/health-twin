from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.entities import (
    User,
    PatientProfile,
    MedicalDocument,
    ExtractedField,
    RiskPrediction,
    ClinicalObservation,
)
from app.api.deps import require_clinician

router = APIRouter(prefix="/clinician", tags=["Clinician Workspace"])

@router.get("/review-queue")
def get_review_queue(
    patient_id: Optional[str] = Query(None, description="Optional patient ID filter"),
    current_user: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    """
    Returns pending items for clinician review:
    1. Unreviewed or pending documents (optionally filtered by patient_id)
    2. Extracted fields with UNREVIEWED status or ALERT validation (optionally filtered by patient_id)
    3. Patients with HIGH risk predictions (optionally filtered by patient_id)
    """
    # 1. Documents pending review
    doc_query = db.query(MedicalDocument).filter(
        MedicalDocument.processing_status.in_(["EXTRACTED", "REVIEW_PENDING", "PROCESSING"])
    )
    if patient_id:
        doc_query = doc_query.filter(MedicalDocument.patient_id == patient_id)

    pending_docs = (
        doc_query
        .order_by(desc(MedicalDocument.created_at))
        .limit(20)
        .all()
    )

    doc_items = []
    for d in pending_docs:
        unreviewed_count = (
            db.query(ExtractedField)
            .filter(ExtractedField.document_id == d.id, ExtractedField.review_status == "UNREVIEWED")
            .count()
        )
        patient = d.patient
        doc_items.append({
            "document_id": d.id,
            "filename": d.filename,
            "category": d.category,
            "report_date": d.report_date,
            "patient_id": d.patient_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
            "mrn": patient.mrn if patient else "",
            "processing_status": d.processing_status,
            "unreviewed_fields_count": unreviewed_count,
            "created_at": d.created_at.isoformat(),
        })

    # 2. Uncertain or alert fields needing confirmation
    field_query = db.query(ExtractedField).filter(ExtractedField.review_status == "UNREVIEWED")
    if patient_id:
        field_query = field_query.filter(ExtractedField.patient_id == patient_id)

    alert_fields = (
        field_query
        .order_by(desc(ExtractedField.created_at))
        .limit(30)
        .all()
    )

    field_items = []
    for f in alert_fields:
        doc = f.document
        patient = doc.patient if doc else None
        field_items.append({
            "field_id": f.id,
            "document_id": f.document_id,
            "patient_id": f.patient_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
            "field_name": f.field_name,
            "category": f.category,
            "extracted_value": f.extracted_value,
            "unit": f.unit,
            "validation_status": f.validation_status,
            "confidence": f.confidence,
            "source_text": f.source_text,
            "source_page": f.source_page,
            "created_at": f.created_at.isoformat(),
        })

    # 3. High risk patients requiring clinical attention
    risk_query = db.query(RiskPrediction).filter(RiskPrediction.risk_category == "HIGH")
    if patient_id:
        risk_query = risk_query.filter(RiskPrediction.patient_id == patient_id)

    high_risk_predictions = (
        risk_query
        .order_by(desc(RiskPrediction.prediction_timestamp))
        .limit(10)
        .all()
    )

    alert_predictions = []
    for p in high_risk_predictions:
        patient = p.patient
        alert_predictions.append({
            "prediction_id": p.id,
            "patient_id": p.patient_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
            "mrn": patient.mrn if patient else "",
            "risk_score": p.risk_score,
            "gestational_age_weeks": p.gestational_age_weeks,
            "prediction_timestamp": p.prediction_timestamp.isoformat(),
            "model_version": p.model_version,
        })

    return {
        "filtered_patient_id": patient_id,
        "pending_documents_count": len(doc_items),
        "pending_documents": doc_items,
        "unreviewed_fields_count": len(field_items),
        "unreviewed_fields": field_items,
        "high_risk_alerts_count": len(alert_predictions),
        "high_risk_alerts": alert_predictions,
    }

@router.get("/patients-overview")
def get_clinician_patients_overview(
    current_user: User = Depends(require_clinician),
    db: Session = Depends(get_db)
):
    patients = db.query(PatientProfile).all()
    overview_list = []

    for p in patients:
        active_ep = next((ep for ep in p.episodes if ep.is_active), None)
        latest_pred = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.patient_id == p.id)
            .order_by(desc(RiskPrediction.prediction_timestamp))
            .first()
        )
        pending_reviews = (
            db.query(ExtractedField)
            .filter(ExtractedField.patient_id == p.id, ExtractedField.review_status == "UNREVIEWED")
            .count()
        )

        overview_list.append({
            "patient_id": p.id,
            "mrn": p.mrn,
            "name": f"{p.first_name} {p.last_name}",
            "maternal_age": p.maternal_age,
            "gestational_age_weeks": active_ep.current_gestational_age_weeks if active_ep else None,
            "estimated_due_date": active_ep.estimated_due_date if active_ep else None,
            "chronic_hypertension": p.chronic_hypertension,
            "prior_preeclampsia": p.prior_preeclampsia,
            "is_synthetic": p.is_synthetic,
            "latest_risk_score": latest_pred.risk_score if latest_pred else None,
            "latest_risk_category": latest_pred.risk_category if latest_pred else "NOT_EVALUATED",
            "pending_reviews_count": pending_reviews,
        })

    return overview_list
