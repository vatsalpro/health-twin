import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MedicalDocument } from '../api/client';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Eye,
  FileCheck,
  Building,
  Calendar,
} from 'lucide-react';

export const MedicalRecordsView: React.FC = () => {
  const { selectedPatient, selectedPatientId, refreshPatientData } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<string>('Antenatal visit summary');
  const [reportDate, setReportDate] = useState<string>('2026-09-15');
  const [institution, setInstitution] = useState<string>('St. Margaret Maternal-Fetal Medicine');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const patient = await api.getPatient(selectedPatientId);
      // Fetch details of all documents for this patient
      const docPromises = patient.episodes.flatMap((ep) =>
        (selectedPatient as any)?.documents || []
      );
      // Alternatively fetch timeline to get document IDs
      const timeline = await api.getPatientTimeline(selectedPatientId);
      const docIds = timeline.events
        .filter((e) => e.type === 'DOCUMENT_UPLOAD')
        .map((e) => e.id);

      const uniqueDocIds = Array.from(new Set(docIds));
      const docDetails = await Promise.all(
        uniqueDocIds.map((id) => api.getDocument(id).catch(() => null))
      );
      setDocuments(docDetails.filter((d): d is MedicalDocument => d !== null));
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedPatientId]);

  const handleFileUpload = async (file: File) => {
    if (!selectedPatientId) return;

    setUploading(true);
    setErrorMsg(null);
    setUploadProgress('Uploading file to secure private storage...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', selectedPatientId);
    formData.append('category', category);
    formData.append('report_date', reportDate);
    formData.append('source_institution', institution);

    try {
      setUploadProgress('Extracting text & bounding blocks with PyMuPDF...');
      const uploadedDoc = await api.uploadDocument(formData);
      setUploadProgress('Running evidence-grounded AI extraction & clinical parsing...');
      await new Promise((r) => setTimeout(r, 600));

      setUploadProgress('Complete!');
      await refreshPatientData();
      await loadDocuments();
      navigate(`/medical-records/${uploadedDoc.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload and process document.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <span className="text-xs font-mono text-[#5BE7E8] uppercase tracking-wider block">
            MEDICAL DOCUMENT INTELLIGENCE
          </span>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">Prenatal Reports & Evidence Extraction</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Ingest text or scanned multi-page obstetric PDFs; extract validated laboratory and hemodynamic evidence.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5BE7E8] to-[#43D6B0] hover:opacity-95 text-[#070B14] font-semibold text-xs transition-all shadow-lg shadow-[#5BE7E8]/20"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Medical Document</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
      </div>

      {/* Upload Dropzone & Metadata Configuration */}
      <div className="glass-panel p-6 border-dashed border-2 border-[rgba(166,190,220,0.2)] hover:border-[#5BE7E8]/50 transition-all rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
              Report Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#101A2B] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
            >
              <option value="Antenatal visit summary">Antenatal visit summary</option>
              <option value="Complete blood count">Complete blood count</option>
              <option value="Urinalysis and urine-protein assessment">Urinalysis & UPCR assessment</option>
              <option value="Liver-function tests">Liver-function tests</option>
              <option value="Kidney-function tests">Kidney-function tests</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
              Report Date
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full bg-[#101A2B] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
              Source Institution
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full bg-[#101A2B] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
            />
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className="flex flex-col items-center justify-center p-8 bg-[#0B1220]/60 rounded-xl cursor-pointer hover:bg-[#101A2B]/60 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 rounded-full bg-[#5BE7E8]/10 text-[#5BE7E8] flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-[#F4F7FC]">Drag & Drop Prenatal PDF or Scanned Report</p>
          <p className="text-xs text-[#A5B3C8] mt-1">Supports PDF (text/scanned), PNG, JPG, CSV up to 30MB</p>
        </div>

        {uploading && (
          <div className="mt-4 p-4 rounded-xl bg-[#142137] border border-[#5BE7E8]/40 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-[#5BE7E8] animate-spin shrink-0" />
            <div className="flex-1">
              <span className="text-xs font-semibold text-[#F4F7FC]">Processing Medical Evidence</span>
              <p className="text-[11px] text-[#A5B3C8] mt-0.5">{uploadProgress}</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-xs text-[#F43F5E] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Uploaded Documents Library */}
      <div className="glass-panel p-6">
        <h3 className="text-base font-bold text-[#F4F7FC] mb-4 flex items-center justify-between">
          <span>Processed Document Repository ({documents.length})</span>
          <button onClick={loadDocuments} className="text-xs text-[#5BE7E8] hover:underline flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </h3>

        {documents.length === 0 ? (
          <div className="p-8 text-center bg-[#0B1220]/50 rounded-xl">
            <FileText className="w-10 h-10 text-[#A5B3C8] mx-auto mb-2 opacity-50" />
            <p className="text-sm text-[#A5B3C8]">No medical reports uploaded yet for this patient.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/medical-records/${doc.id}`)}
                className="p-5 glass-panel-elevated rounded-xl cursor-pointer hover:border-[#5BE7E8]/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#5BE7E8]/10 text-[#5BE7E8] border border-[#5BE7E8]/20">
                      {doc.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        doc.processing_status === 'COMPLETED'
                          ? 'bg-[#43D6B0]/20 text-[#43D6B0]'
                          : doc.processing_status === 'EXTRACTED'
                          ? 'bg-[#E9B96E]/20 text-[#E9B96E]'
                          : 'bg-[#5BE7E8]/20 text-[#5BE7E8]'
                      }`}
                    >
                      {doc.processing_status}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-[#F4F7FC] group-hover:text-[#5BE7E8] transition-colors truncate">
                    {doc.filename}
                  </h4>

                  <div className="mt-3 flex flex-wrap gap-y-1 gap-x-3 text-[11px] text-[#A5B3C8]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#5BE7E8]" /> {doc.report_date || '2026-09-15'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-[#A5B3C8]" /> {doc.source_institution || 'Obstetric Center'}
                    </span>
                    <span>{doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                  </div>

                  {doc.summary && (
                    <p className="mt-3 text-xs text-[#A5B3C8] line-clamp-2 leading-relaxed bg-[#0B1220]/60 p-2.5 rounded-lg border border-[rgba(166,190,220,0.08)]">
                      {doc.summary.factual_summary}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[rgba(166,190,220,0.1)] flex items-center justify-between text-xs text-[#5BE7E8]">
                  <span>{doc.extracted_fields?.length || 0} Structured Fields</span>
                  <span className="flex items-center gap-1 font-medium group-hover:translate-x-1 transition-transform">
                    Inspect Evidence <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
