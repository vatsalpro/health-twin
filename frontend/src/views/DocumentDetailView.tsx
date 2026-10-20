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
  Sparkles,
  Download,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

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
    } catch (err) {
      console.error('Failed to load document:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, [documentId]);

  const handleReview = async (fieldId: string, decision: 'ACCEPT' | 'REJECT' | 'MODIFY') => {
    if (!documentId) return;
    try {
      await api.reviewField(
        documentId,
        fieldId,
        decision,
        decision === 'MODIFY' ? correctionValue : undefined,
        clinicianNotes || undefined
      );
      setActionSuccess(`Field ${decision.toLowerCase()}ed and incorporated.`);
      setTimeout(() => setActionSuccess(null), 3000);
      setModifyingField(null);
      await loadDoc();
      await refreshPatientData();
    } catch (err: any) {
      alert(`Error reviewing field: ${err.message}`);
    }
  };

  const handleAcceptAll = async () => {
    if (!documentId) return;
    try {
      await api.acceptAllFields(documentId);
      setActionSuccess('All extracted fields accepted and digital twin updated.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadDoc();
      await refreshPatientData();
    } catch (err: any) {
      alert(`Error accepting all fields: ${err.message}`);
    }
  };

  if (!document) {
    return (
      <div className="p-8 text-center glass-panel">
        <AlertCircle className="w-10 h-10 text-[#A5B3C8] mx-auto mb-2" />
        <p className="text-sm text-[#A5B3C8]">Document not found or access restricted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-panel rounded-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/medical-records')}
            className="p-1.5 rounded-lg bg-[#142137] text-[#A5B3C8] hover:text-[#F4F7FC]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#F4F7FC] truncate">{document.filename}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#5BE7E8]/10 text-[#5BE7E8]">
                {document.category}
              </span>
            </div>
            <p className="text-[11px] text-[#A5B3C8]">
              {document.report_date} | {document.source_institution} | AI Engine: {document.ai_provider}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionSuccess && (
            <span className="text-xs font-medium text-[#43D6B0] flex items-center gap-1">
              <CheckCheck className="w-4 h-4" /> {actionSuccess}
            </span>
          )}
          {isClinician && (
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#43D6B0]/20 hover:bg-[#43D6B0]/30 text-[#43D6B0] border border-[#43D6B0]/30 text-xs font-semibold transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Accept All Fields</span>
            </button>
          )}
          <a
            href={`/api/v1/documents/${document.id}/download`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-[#142137] hover:bg-[#192a45] text-[#A5B3C8] hover:text-[#F4F7FC] text-xs transition-colors"
            title="Download Original"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Dual Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* Left Panel: Document Preview & Page Navigation */}
        <div className="lg:col-span-7 glass-panel-elevated p-4 flex flex-col justify-between rounded-2xl relative overflow-hidden">
          {/* Document Viewer Toolbar */}
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(166,190,220,0.1)] text-xs text-[#A5B3C8]">
            <div className="flex items-center gap-2">
              <span>Page {currentPage} of {document.page_count}</span>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-[#101A2B] disabled:opacity-30 hover:text-[#F4F7FC]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= document.page_count}
                onClick={() => setCurrentPage((p) => Math.min(document.page_count, p + 1))}
                className="p-1 rounded bg-[#101A2B] disabled:opacity-30 hover:text-[#F4F7FC]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 rounded bg-[#101A2B] hover:text-[#F4F7FC]"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px]">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 rounded bg-[#101A2B] hover:text-[#F4F7FC]"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Document Page Canvas */}
          <div className="flex-1 my-3 bg-[#070B14] rounded-xl border border-[rgba(166,190,220,0.14)] p-6 overflow-auto relative flex flex-col items-center">
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="w-full max-w-xl bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg p-8 shadow-2xl space-y-4 text-xs font-mono transition-transform"
            >
              <div className="border-b border-[#5BE7E8]/30 pb-3 text-center">
                <p className="font-bold text-[#F4F7FC] text-sm tracking-wide">
                  ST. MARGARET MATERNAL-FETAL MEDICINE CENTER
                </p>
                <p className="text-[10px] text-[#5BE7E8] uppercase mt-0.5">
                  Longitudinal Antenatal Surveillance Report — Page {currentPage}
                </p>
              </div>

              {currentPage === 1 ? (
                <div className="space-y-4 text-[#A5B3C8]">
                  <div className="flex justify-between border-b border-[rgba(166,190,220,0.1)] pb-2 text-[11px]">
                    <span>SUBJECT: MAYA LIN (MRN-PT-2026-001)</span>
                    <span>GA: 31w 4d | DATE: 2026-09-15</span>
                  </div>

                  {/* Section 1: Hemodynamics Highlight Block */}
                  <div
                    className={`p-3 rounded-lg border transition-all ${
                      selectedField?.category === 'blood_pressure'
                        ? 'border-[#5BE7E8] bg-[#5BE7E8]/10 text-[#F4F7FC] ring-2 ring-[#5BE7E8]/40'
                        : 'border-transparent bg-[#101A2B]/50'
                    }`}
                  >
                    <p className="font-bold text-[#F4F7FC] text-[11px] mb-1">1. HEMODYNAMIC OBSERVATIONS</p>
                    <p className="text-sm font-bold text-[#5BE7E8]">Blood Pressure: 142/92 mmHg</p>
                    <p className="text-[10px] text-[#A5B3C8] mt-0.5">Measurement Context: Sitting, Right Arm, Automated Sphygmomanometer</p>
                  </div>

                  {/* Section 2: Urinalysis Highlight Block */}
                  <div
                    className={`p-3 rounded-lg border transition-all ${
                      selectedField?.category === 'urine_protein'
                        ? 'border-[#5BE7E8] bg-[#5BE7E8]/10 text-[#F4F7FC] ring-2 ring-[#5BE7E8]/40'
                        : 'border-transparent bg-[#101A2B]/50'
                    }`}
                  >
                    <p className="font-bold text-[#F4F7FC] text-[11px] mb-1">2. POINT-OF-CARE URINALYSIS</p>
                    <p className="text-sm font-bold text-[#E9B96E]">Urine Protein: 1+ (dipstick automated reader)</p>
                    <p className="text-xs font-bold text-[#F4F7FC]">Protein/Creatinine Ratio (UPCR): 0.34 mg/mg [Ref &lt; 0.30]</p>
                  </div>

                  {/* Section 3: Laboratory Highlight Block */}
                  <div
                    className={`p-3 rounded-lg border transition-all ${
                      selectedField?.category === 'laboratory'
                        ? 'border-[#5BE7E8] bg-[#5BE7E8]/10 text-[#F4F7FC] ring-2 ring-[#5BE7E8]/40'
                        : 'border-transparent bg-[#101A2B]/50'
                    }`}
                  >
                    <p className="font-bold text-[#F4F7FC] text-[11px] mb-1">3. COMPLETE BLOOD & BIOCHEMISTRY PANEL</p>
                    <p>Platelet Count: 168 x10^3/uL [Ref: 150 - 450]</p>
                    <p>AST (SGOT): 32 U/L | ALT (SGPT): 28 U/L</p>
                    <p>Serum Creatinine: 0.78 mg/dL [Ref: 0.40 - 0.90]</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-[#A5B3C8]">
                  <p className="font-bold text-[#F4F7FC] text-[11px]">HISTORICAL TREND LOGS & SIGNATURE</p>
                  <p>2026-07-20 (GA 24.0w): BP 122/78 mmHg | Protein: Neg | Platelets: 210k</p>
                  <p>2026-08-18 (GA 28.1w): BP 132/84 mmHg | Protein: Trace | Platelets: 192k</p>
                  <p>2026-09-15 (GA 31.4w): BP 142/92 mmHg | Protein: 1+ | Platelets: 168k</p>
                  <div className="pt-8 border-t border-[rgba(166,190,220,0.1)] text-[10px]">
                    Physician Signature: Dr. Elena Vance, MD, FACOG
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#A5B3C8] pt-2 border-t border-[rgba(166,190,220,0.1)]">
            <span>PyMuPDF Text & Vector Coordinates Preserved</span>
            <span className="text-[#5BE7E8] font-mono">
              {selectedField ? `Focus: ${selectedField.field_name} (Page ${selectedField.source_page})` : 'Select a field to locate'}
            </span>
          </div>
        </div>

        {/* Right Panel: Extracted Fields & AI Evidence Grounding */}
        <div className="lg:col-span-5 glass-panel p-5 flex flex-col justify-between rounded-2xl">
          <div>
            {/* View Switching Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#0B1220] rounded-xl border border-[rgba(166,190,220,0.14)] mb-4">
              <button
                onClick={() => setActiveTab('FIELDS')}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  activeTab === 'FIELDS'
                    ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                    : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
                }`}
              >
                Extracted Fields ({document.extracted_fields.length})
              </button>
              <button
                onClick={() => setActiveTab('SUMMARY')}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  activeTab === 'SUMMARY'
                    ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                    : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
                }`}
              >
                AI Clinical Summary
              </button>
            </div>

            {/* Tab 1: Extracted Fields List with Verification Actions */}
            {activeTab === 'FIELDS' && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {document.extracted_fields.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setSelectedField(f);
                      setCurrentPage(f.source_page || 1);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedField?.id === f.id
                        ? 'border-[#5BE7E8] bg-[#142137] shadow-lg shadow-[#5BE7E8]/5'
                        : 'border-[rgba(166,190,220,0.1)] bg-[#0B1220]/60 hover:bg-[#101A2B]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#A5B3C8]">
                        {f.category.replace('_', ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          f.review_status === 'ACCEPTED'
                            ? 'bg-[#43D6B0]/20 text-[#43D6B0]'
                            : f.review_status === 'REJECTED'
                            ? 'bg-[#F43F5E]/20 text-[#F43F5E]'
                            : f.review_status === 'MODIFIED'
                            ? 'bg-[#E9B96E]/20 text-[#E9B96E]'
                            : 'bg-[#5BE7E8]/15 text-[#5BE7E8]'
                        }`}
                      >
                        {f.review_status}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs font-semibold text-[#F4F7FC]">{f.field_name}</span>
                      <span className="text-sm font-bold font-mono text-[#5BE7E8]">
                        {f.clinician_correction || f.extracted_value}{' '}
                        <span className="text-[10px] text-[#A5B3C8] font-normal">{f.unit || ''}</span>
                      </span>
                    </div>

                    {f.source_text && (
                      <p className="text-[11px] text-[#A5B3C8] mt-1.5 italic bg-[#070B14]/60 p-1.5 rounded border border-[rgba(166,190,220,0.06)] truncate">
                        "{f.source_text}"
                      </p>
                    )}

                    {/* Clinician Review Buttons */}
                    {isClinician && (
                      <div className="mt-3 pt-2.5 border-t border-[rgba(166,190,220,0.1)] flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModifyingField(f);
                            setCorrectionValue(f.extracted_value);
                          }}
                          className="px-2 py-1 rounded bg-[#101A2B] hover:bg-[#142137] text-[#E9B96E] text-[11px] font-medium flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Modify
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReview(f.id, 'REJECT');
                          }}
                          className="px-2 py-1 rounded bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 text-[#F43F5E] text-[11px] font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReview(f.id, 'ACCEPT');
                          }}
                          className="px-2.5 py-1 rounded bg-[#43D6B0]/20 hover:bg-[#43D6B0]/30 text-[#43D6B0] text-[11px] font-bold flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Accept
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: AI Clinical Summary */}
            {activeTab === 'SUMMARY' && document.summary && (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 text-xs">
                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5BE7E8] block mb-1">
                    Factual Summary
                  </span>
                  <p className="text-[#F4F7FC] leading-relaxed">{document.summary.factual_summary}</p>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#43D6B0] block mb-1">
                    Key Findings
                  </span>
                  <p className="text-[#F4F7FC] leading-relaxed">{document.summary.key_findings}</p>
                </div>

                {document.summary.changes_vs_prior && (
                  <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#628BFF] block mb-1">
                      Trajectory vs Prior Reports
                    </span>
                    <p className="text-[#A5B3C8] leading-relaxed">{document.summary.changes_vs_prior}</p>
                  </div>
                )}

                {document.summary.clinician_review_prompts && (
                  <div className="p-3 bg-[#E9B96E]/10 rounded-xl border border-[#E9B96E]/30">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#E9B96E] block mb-1">
                      Questions for Clinician Review
                    </span>
                    <p className="text-[#F4F7FC] leading-relaxed">{document.summary.clinician_review_prompts}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modify Field Modal */}
      {modifyingField && (
        <div className="fixed inset-0 z-50 bg-[#070B14]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101A2B] border border-[#5BE7E8]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F4F7FC]">
              Correct Extracted Value: {modifyingField.field_name}
            </h3>
            <p className="text-xs text-[#A5B3C8]">
              Original extracted value: <strong>{modifyingField.extracted_value} {modifyingField.unit}</strong>
            </p>

            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
                Corrected Value
              </label>
              <input
                type="text"
                value={correctionValue}
                onChange={(e) => setCorrectionValue(e.target.value)}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
                Clinician Note / Reason for Correction
              </label>
              <textarea
                value={clinicianNotes}
                onChange={(e) => setClinicianNotes(e.target.value)}
                placeholder="e.g. Corrected to sitting repeat BP reading..."
                rows={3}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModifyingField(null)}
                className="px-3 py-1.5 rounded-lg bg-[#142137] text-xs text-[#A5B3C8]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview(modifyingField.id, 'MODIFY')}
                className="px-4 py-1.5 rounded-lg bg-[#5BE7E8] text-[#070B14] font-semibold text-xs"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
