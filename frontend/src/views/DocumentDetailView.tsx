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
  const { user, selectedPatient, refreshPatientData } = useAuth();

  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [selectedField, setSelectedField] = useState<ExtractedField | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'FIELDS' | 'SUMMARY'>('FIELDS');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'PDF' | 'EVIDENCE'>('PDF');

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
      try {
        const blobUrl = await api.getDocumentBlobUrl(documentId);
        setPdfBlobUrl(blobUrl);
      } catch (blobErr) {
        console.warn('PDF blob load error, falling back to evidence view:', blobErr);
        setViewMode('EVIDENCE');
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
    return () => {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
      }
    };
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

  // Safe Keyboard Navigation for Clinicians
  useEffect(() => {
    if (!isClinician || !document || document.extracted_fields.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or select
      const activeEl = window.document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
      ) {
        return;
      }

      const fields = document.extracted_fields;
      const currentIndex = selectedField ? fields.findIndex((f) => f.id === selectedField.id) : 0;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % fields.length;
        setSelectedField(fields[nextIndex]);
        setCurrentPage(fields[nextIndex].source_page || 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
        setSelectedField(fields[prevIndex]);
        setCurrentPage(fields[prevIndex].source_page || 1);
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((p) => Math.min(document.page_count, p + 1));
      } else if ((e.key === 'a' || e.key === 'A') && selectedField) {
        e.preventDefault();
        handleReview(selectedField.id, 'ACCEPT');
      } else if ((e.key === 'r' || e.key === 'R') && selectedField) {
        e.preventDefault();
        handleReview(selectedField.id, 'REJECT');
      } else if ((e.key === 'e' || e.key === 'E') && selectedField) {
        e.preventDefault();
        setModifyingField(selectedField);
        setCorrectionValue(selectedField.extracted_value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClinician, document, selectedField]);

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
            <CardHeader className="py-2.5 px-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  disabled={!pdfBlobUrl}
                  onClick={() => setViewMode('PDF')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === 'PDF' && pdfBlobUrl
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                  }`}
                >
                  Original PDF Document
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('EVIDENCE')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === 'EVIDENCE' || !pdfBlobUrl
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Extracted Evidence Canvas
                </button>
              </div>

              {/* Page & Zoom Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
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

                {viewMode === 'EVIDENCE' && (
                  <div className="flex items-center gap-1.5 text-xs">
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
                )}
              </div>
            </CardHeader>

            {/* Document Content */}
            {viewMode === 'PDF' && pdfBlobUrl ? (
              <div className="flex-1 w-full min-h-[580px] bg-slate-100 flex flex-col p-2">
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
                  className="w-full flex-1 min-h-[580px] rounded-lg border border-slate-300 bg-white"
                  title={document.filename}
                />
              </div>
            ) : (
              /* Dynamic Evidence Canvas */
              <div className="flex-1 p-6 bg-slate-100 overflow-auto flex flex-col items-center">
                <div
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                  className="w-full max-w-xl bg-white border border-slate-300 rounded-lg p-8 shadow-sm space-y-4 text-xs font-mono transition-transform"
                >
                  {/* Dynamic Facility Header */}
                  <div className="border-b border-slate-200 pb-3 text-center">
                    <p className="font-bold text-slate-900 text-sm tracking-wide">
                      {document.source_institution || 'OBSTETRIC CLINICAL CENTER'}
                    </p>
                    <p className="text-xs text-sky-700 uppercase font-semibold mt-0.5">
                      {document.category} — Page {currentPage}
                    </p>
                  </div>

                  {/* Dynamic Patient Details */}
                  <div className="space-y-4 text-slate-700">
                    <div className="flex justify-between border-b border-slate-100 pb-2 text-xs font-bold">
                      <span>
                        SUBJECT:{' '}
                        {(
                          document.patient_name ||
                          (selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Patient')
                        ).toUpperCase()}{' '}
                        (
                        {document.patient_mrn ||
                          (selectedPatient ? selectedPatient.mrn : 'MRN-PT-2026-003')}
                        )
                      </span>
                      <span>
                        GA:{' '}
                        {document.extracted_fields.find(
                          (f) =>
                            f.field_name === 'gestational_age_weeks' ||
                            f.field_name === 'gestational_age' ||
                            f.field_name === 'ga'
                        )?.extracted_value ||
                          (selectedPatient?.episodes?.[0]?.current_gestational_age_weeks
                            ? `${selectedPatient.episodes[0].current_gestational_age_weeks}`
                            : '16.0')}
                        w | DATE: {document.report_date || '2026-10-15'}
                      </span>
                    </div>

                    {/* Section 1: Hemodynamics Highlight Block */}
                    {(() => {
                      const sbp = document.extracted_fields.find(
                        (f) => f.field_name === 'systolic_bp' || f.field_name === 'sbp'
                      );
                      const dbp = document.extracted_fields.find(
                        (f) => f.field_name === 'diastolic_bp' || f.field_name === 'dbp'
                      );
                      if (!sbp && !dbp) return null;
                      return (
                        <div
                          onClick={() => sbp && setSelectedField(sbp)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedField?.category === 'blood_pressure'
                              ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/60'
                          }`}
                        >
                          <p className="font-bold text-slate-900 text-xs mb-1">
                            1. HEMODYNAMIC OBSERVATIONS
                          </p>
                          <p className="text-sm font-bold text-sky-900">
                            Blood Pressure: {sbp ? sbp.extracted_value : '--'}/
                            {dbp ? dbp.extracted_value : '--'} mmHg
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Source: {sbp?.source_text || dbp?.source_text || 'Automated Sphygmomanometer'}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Section 2: Urinalysis Highlight Block */}
                    {(() => {
                      const up = document.extracted_fields.find(
                        (f) => f.field_name === 'urine_protein' || f.field_name === 'proteinuria'
                      );
                      const upcr = document.extracted_fields.find(
                        (f) => f.field_name === 'protein_creatinine_ratio' || f.field_name === 'upcr'
                      );
                      if (!up && !upcr) return null;
                      return (
                        <div
                          onClick={() => (up ? setSelectedField(up) : upcr && setSelectedField(upcr))}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedField?.category === 'urine_protein'
                              ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/60'
                          }`}
                        >
                          <p className="font-bold text-slate-900 text-xs mb-1">
                            2. POINT-OF-CARE URINALYSIS
                          </p>
                          {up && (
                            <p className="text-sm font-bold text-amber-800">
                              Urine Protein: {up.extracted_value}
                            </p>
                          )}
                          {upcr && (
                            <p className="text-xs font-bold text-slate-800">
                              Protein/Creatinine Ratio (UPCR): {upcr.extracted_value} mg/mg [Ref &lt; 0.30]
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-0.5">
                            Source: {up?.source_text || upcr?.source_text || 'Urinalysis dipstick assessment'}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Section 3: Laboratory Highlight Block */}
                    {(() => {
                      const plt = document.extracted_fields.find(
                        (f) => f.field_name === 'platelet_count' || f.field_name === 'platelets'
                      );
                      const ast = document.extracted_fields.find((f) => f.field_name === 'ast');
                      const alt = document.extracted_fields.find((f) => f.field_name === 'alt');
                      const cr = document.extracted_fields.find(
                        (f) => f.field_name === 'serum_creatinine' || f.field_name === 'creatinine'
                      );
                      const hb = document.extracted_fields.find(
                        (f) => f.field_name === 'hemoglobin' || f.field_name === 'hgb'
                      );
                      if (!plt && !ast && !alt && !cr && !hb) return null;
                      return (
                        <div
                          onClick={() => plt && setSelectedField(plt)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedField?.category === 'laboratory'
                              ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/60'
                          }`}
                        >
                          <p className="font-bold text-slate-900 text-xs mb-1">
                            3. COMPLETE BLOOD & BIOCHEMISTRY PANEL
                          </p>
                          {hb && <p>Hemoglobin: {hb.extracted_value} {hb.unit || 'g/dL'}</p>}
                          {plt && (
                            <p>
                              Platelet Count: {plt.extracted_value} {plt.unit || '10^3/uL'} [Ref: 150 - 450]
                            </p>
                          )}
                          {(ast || alt) && (
                            <p>
                              {ast ? `AST (SGOT): ${ast.extracted_value} ${ast.unit || 'U/L'}` : ''}
                              {ast && alt ? ' | ' : ''}
                              {alt ? `ALT (SGPT): ${alt.extracted_value} ${alt.unit || 'U/L'}` : ''}
                            </p>
                          )}
                          {cr && (
                            <p>
                              Serum Creatinine: {cr.extracted_value} {cr.unit || 'mg/dL'} [Ref: 0.40 - 0.90]
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Section 4: Document OCR Text Transcript */}
                    {document.extracted_text && (
                      <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-600">
                        <p className="font-bold text-slate-800 mb-1">
                          DOCUMENT OCR TRANSCRIPT PREVIEW:
                        </p>
                        <pre className="whitespace-pre-wrap font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] text-slate-700 max-h-48 overflow-y-auto">
                          {document.extracted_text}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

            {isClinician && (
              <div className="p-2.5 px-4 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Keyboard Shortcuts:</span>
                <span className="font-mono text-slate-600 flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold text-slate-700 shadow-2xs">↑/↓</kbd> Select
                  <span>•</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold text-emerald-700 shadow-2xs">A</kbd> Accept
                  <span>•</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold text-rose-700 shadow-2xs">R</kbd> Reject
                  <span>•</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-semibold text-amber-700 shadow-2xs">E</kbd> Edit
                </span>
              </div>
            )}
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
