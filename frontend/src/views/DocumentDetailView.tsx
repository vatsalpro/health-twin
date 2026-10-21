import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MedicalDocument, ExtractedField } from '../api/client';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Edit2,
  CheckCheck,
  AlertCircle,
  Clock,
  Download,
  Building,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';

export const DocumentDetailView: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user, refreshPatientData } = useAuth();

  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [selectedField, setSelectedField] = useState<ExtractedField | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'FIELDS' | 'SUMMARY'>('FIELDS');

  // Modification dialog state
  const [modifyingField, setModifyingField] = useState<ExtractedField | null>(null);
  const [correctionValue, setCorrectionValue] = useState<string>('');
  const [clinicianNotes, setClinicianNotes] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  const loadDoc = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const doc = await api.getDocument(documentId);
      setDocument(doc);
      if (doc.extracted_fields.length > 0) {
        setSelectedField(doc.extracted_fields[0]);
        setCurrentPage(doc.extracted_fields[0].source_page || 1);
      }
    } catch (err: any) {
      console.error('Failed to load document:', err);
      setActionError(`Failed to load document: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, [documentId]);

  const handleReview = async (fieldId: string, decision: 'ACCEPT' | 'REJECT' | 'MODIFY') => {
    if (!documentId) return;
    setActionError(null);
    setActionLoading(true);
    try {
      if (decision === 'MODIFY' && (!correctionValue || !correctionValue.trim())) {
        setActionError('Please specify a valid non-empty correction value.');
        setActionLoading(false);
        return;
      }
      await api.reviewField(
        documentId,
        fieldId,
        decision,
        decision === 'MODIFY' ? correctionValue.trim() : undefined,
        clinicianNotes || undefined
      );
      setActionSuccess(`Field successfully ${decision.toLowerCase()}ed and recorded.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setModifyingField(null);
      await loadDoc();
      await refreshPatientData();
    } catch (err: any) {
      const msg = err.message || 'Action failed';
      setActionError(`Review error: ${msg}`);
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptAll = async () => {
    if (!documentId) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await api.acceptAllFields(documentId);
      const countMsg = res?.accepted_count !== undefined
        ? `${res.accepted_count} fields accepted (${res.skipped_rejected_count || 0} rejected preserved)`
        : 'All eligible fields accepted';
      setActionSuccess(`${countMsg} and incorporated into digital twin.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadDoc();
      await refreshPatientData();
    } catch (err: any) {
      const msg = err.message || 'Failed to accept fields.';
      setActionError(`Accept all error: ${msg}`);
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge variant="success">ACCEPTED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'MODIFIED':
        return <Badge variant="warning">MODIFIED</Badge>;
      default:
        return <Badge variant="primary">{status}</Badge>;
    }
  };

  if (!document) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Document not found or access restricted.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/medical-records')}>
            Return to Medical Records
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => navigate('/medical-records')}
            >
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 truncate">{document.filename}</h2>
                <Badge variant="neutral">{document.category}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {document.report_date} • {document.source_institution} • AI Engine: {document.ai_provider}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isClinician && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCheck className="w-4 h-4" />}
                onClick={handleAcceptAll}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                Accept All Fields
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={async () => {
                try {
                  await api.downloadDocument(document.id, document.filename);
                } catch (err: any) {
                  alert(err.message || 'Download failed');
                }
              }}
            >
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accessible Notification Banners */}
      {actionError && (
        <Alert
          variant="danger"
          title="Review Action Error"
          description={actionError}
        />
      )}
      {actionSuccess && (
        <Alert
          variant="success"
          title="Action Completed"
          description={actionSuccess}
        />
      )}

      {/* Dual Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Panel: Document Viewer */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-slate-200 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Page {currentPage} of {document.page_count}</span>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= document.page_count}
                  onClick={() => setCurrentPage((p) => Math.min(document.page_count, p + 1))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs text-slate-700">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>

            {/* Document Canvas */}
            <div className="flex-1 p-6 bg-slate-100 overflow-auto flex flex-col items-center">
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                className="w-full max-w-xl bg-white border border-slate-300 rounded-lg p-8 shadow-sm space-y-4 text-xs font-mono transition-transform"
              >
                <div className="border-b border-slate-200 pb-3 text-center">
                  <p className="font-bold text-slate-900 text-sm tracking-wide">
                    ST. MARGARET MATERNAL-FETAL MEDICINE CENTER
                  </p>
                  <p className="text-xs text-sky-700 uppercase font-semibold mt-0.5">
                    Longitudinal Antenatal Surveillance Report — Page {currentPage}
                  </p>
                </div>

                {currentPage === 1 ? (
                  <div className="space-y-4 text-slate-700">
                    <div className="flex justify-between border-b border-slate-100 pb-2 text-xs">
                      <span>SUBJECT: MAYA LIN (MRN-PT-2026-001)</span>
                      <span>GA: 31w 4d | DATE: 2026-09-15</span>
                    </div>

                    {/* Section 1: Hemodynamics Highlight Block */}
                    <div
                      className={`p-3 rounded-lg border transition-all ${
                        selectedField?.category === 'blood_pressure'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="font-bold text-slate-900 text-xs mb-1">1. HEMODYNAMIC OBSERVATIONS</p>
                      <p className="text-sm font-bold text-sky-900">Blood Pressure: 142/92 mmHg</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Measurement Context: Sitting, Right Arm, Automated Sphygmomanometer
                      </p>
                    </div>

                    {/* Section 2: Urinalysis Highlight Block */}
                    <div
                      className={`p-3 rounded-lg border transition-all ${
                        selectedField?.category === 'urine_protein'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="font-bold text-slate-900 text-xs mb-1">2. POINT-OF-CARE URINALYSIS</p>
                      <p className="text-sm font-bold text-amber-800">Urine Protein: 1+ (dipstick automated reader)</p>
                      <p className="text-xs font-bold text-slate-800">Protein/Creatinine Ratio (UPCR): 0.34 mg/mg [Ref &lt; 0.30]</p>
                    </div>

                    {/* Section 3: Laboratory Highlight Block */}
                    <div
                      className={`p-3 rounded-lg border transition-all ${
                        selectedField?.category === 'laboratory'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="font-bold text-slate-900 text-xs mb-1">3. COMPLETE BLOOD & BIOCHEMISTRY PANEL</p>
                      <p>Platelet Count: 168 x10^3/uL [Ref: 150 - 450]</p>
                      <p>AST (SGOT): 32 U/L | ALT (SGPT): 28 U/L</p>
                      <p>Serum Creatinine: 0.78 mg/dL [Ref: 0.40 - 0.90]</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-slate-700">
                    <p className="font-bold text-slate-900 text-xs">HISTORICAL TREND LOGS & SIGNATURE</p>
                    <p>2026-07-20 (GA 24.0w): BP 122/78 mmHg | Protein: Neg | Platelets: 210k</p>
                    <p>2026-08-18 (GA 28.1w): BP 132/84 mmHg | Protein: Trace | Platelets: 192k</p>
                    <p>2026-09-15 (GA 31.4w): BP 142/92 mmHg | Protein: 1+ | Platelets: 168k</p>
                    <div className="pt-8 border-t border-slate-200 text-xs">
                      Physician Signature: Dr. Elena Vance, MD, FACOG
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>PyMuPDF Text & Vector Coordinates Preserved</span>
              <span className="font-mono text-sky-700 font-medium">
                {selectedField ? `Focus: ${selectedField.field_name} (Page ${selectedField.source_page})` : 'Select a field to locate'}
              </span>
            </div>
          </Card>
        </div>

        {/* Right Panel: Extracted Fields & Review */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-200">
              <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  onClick={() => setActiveTab('FIELDS')}
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                    activeTab === 'FIELDS'
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Extracted Fields ({document.extracted_fields.length})
                </button>
                <button
                  onClick={() => setActiveTab('SUMMARY')}
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                    activeTab === 'SUMMARY'
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  AI Clinical Summary
                </button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 overflow-y-auto max-h-[540px]">
              {activeTab === 'FIELDS' ? (
                <div className="space-y-3">
                  {document.extracted_fields.map((f) => {
                    const isSelected = selectedField?.id === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          setSelectedField(f);
                          setCurrentPage(f.source_page || 1);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/60 shadow-sm ring-1 ring-sky-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            {f.category.replace('_', ' ')}
                          </span>
                          {getStatusBadge(f.review_status)}
                        </div>

                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xs font-semibold text-slate-900">{f.field_name}</span>
                          <span className="text-sm font-bold font-mono text-sky-800">
                            {f.clinician_correction || f.extracted_value}{' '}
                            <span className="text-xs text-slate-500 font-normal">{f.unit || ''}</span>
                          </span>
                        </div>

                        {f.source_text && (
                          <p className="text-xs text-slate-600 mt-1.5 italic bg-slate-50 p-2 rounded border border-slate-200 truncate">
                            "{f.source_text}"
                          </p>
                        )}

                        {/* Clinician Review Buttons */}
                        {isClinician && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs py-1 h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModifyingField(f);
                                setCorrectionValue(f.extracted_value);
                              }}
                              icon={<Edit2 className="w-3 h-3 text-amber-600" />}
                            >
                              Modify
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs py-1 h-7 text-rose-600 hover:bg-rose-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReview(f.id, 'REJECT');
                              }}
                              icon={<X className="w-3 h-3 text-rose-600" />}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs py-1 h-7 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReview(f.id, 'ACCEPT');
                              }}
                              icon={<Check className="w-3 h-3 text-emerald-600" />}
                            >
                              Accept
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {document.summary ? (
                    <>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-800 font-bold block mb-1">
                          Factual Summary
                        </span>
                        <p className="text-slate-800 leading-relaxed">{document.summary.factual_summary}</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold block mb-1">
                          Key Findings
                        </span>
                        <p className="text-slate-800 leading-relaxed">{document.summary.key_findings}</p>
                      </div>

                      {document.summary.changes_vs_prior && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-700 font-bold block mb-1">
                            Trajectory vs Prior Reports
                          </span>
                          <p className="text-slate-600 leading-relaxed">{document.summary.changes_vs_prior}</p>
                        </div>
                      )}

                      {document.summary.clinician_review_prompts && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-bold block mb-1">
                            Questions for Clinician Review
                          </span>
                          <p className="text-amber-950 leading-relaxed">{document.summary.clinician_review_prompts}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-6 text-center text-slate-500">No AI clinical summary generated.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modify Field Modal */}
      <Modal
        isOpen={!!modifyingField}
        onClose={() => setModifyingField(null)}
        title={`Correct Extracted Value: ${modifyingField?.field_name}`}
        description={`Original extracted value: ${modifyingField?.extracted_value} ${modifyingField?.unit || ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModifyingField(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => modifyingField && handleReview(modifyingField.id, 'MODIFY')}
              disabled={actionLoading}
              isLoading={actionLoading}
            >
              Save Correction
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Corrected Value
            </label>
            <input
              type="text"
              value={correctionValue}
              onChange={(e) => setCorrectionValue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Clinician Note / Reason for Correction
            </label>
            <textarea
              value={clinicianNotes}
              onChange={(e) => setClinicianNotes(e.target.value)}
              placeholder="e.g. Corrected to sitting repeat BP reading..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
