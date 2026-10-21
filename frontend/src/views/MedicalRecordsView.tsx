import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MedicalDocument } from '../api/client';
import {
  FileText,
  Upload,
  Clock,
  ArrowRight,
  RefreshCw,
  Building,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'EXTRACTED':
        return <Badge variant="warning">EXTRACTED</Badge>;
      default:
        return <Badge variant="primary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="MEDICAL DOCUMENT INTELLIGENCE"
        title="Prenatal Reports & Evidence Extraction"
        description="Ingest text or scanned multi-page obstetric PDFs; extract validated laboratory and hemodynamic evidence."
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              isLoading={uploading}
            >
              Upload Document
            </Button>
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
          </>
        }
      />

      {/* Upload Dropzone & Metadata Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Ingestion & Metadata</CardTitle>
          <CardDescription>
            Configure report metadata before uploading to ensure proper clinical chronological mapping.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Report Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                <option value="Antenatal visit summary">Antenatal visit summary</option>
                <option value="Complete blood count">Complete blood count</option>
                <option value="Urinalysis and urine-protein assessment">Urinalysis & UPCR assessment</option>
                <option value="Liver-function tests">Liver-function tests</option>
                <option value="Kidney-function tests">Kidney-function tests</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Source Institution
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50/30 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Drag & Drop Prenatal PDF or Scanned Report</p>
            <p className="text-xs text-slate-500 mt-1">Supports PDF (text/scanned), PNG, JPG, CSV up to 30MB</p>
          </div>

          {uploading && (
            <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-sky-600 animate-spin shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-900">Processing Medical Evidence</span>
                <p className="text-xs text-slate-600 mt-0.5">{uploadProgress}</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <Alert
              variant="danger"
              title="Upload Error"
              description={errorMsg}
            />
          )}
        </CardContent>
      </Card>

      {/* Uploaded Documents Library */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Processed Document Repository ({documents.length})</CardTitle>
            <CardDescription>
              Antenatal records processed with evidence grounding and bounding box coordinates.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDocuments}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No medical reports uploaded yet for this patient.</p>
              <p className="text-xs text-slate-500 mt-0.5">Use the upload box above to ingest antenatal records.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/medical-records/${doc.id}`)}
                  className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="neutral">{doc.category}</Badge>
                      {getStatusBadge(doc.processing_status)}
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                      {doc.filename}
                    </h4>

                    <div className="mt-2.5 flex flex-wrap gap-y-1 gap-x-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> {doc.report_date || '2026-09-15'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-400" /> {doc.source_institution || 'Obstetric Center'}
                      </span>
                      <span>{doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                    </div>

                    {doc.summary && (
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {doc.summary.factual_summary}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-sky-700">
                    <span className="font-medium">{doc.extracted_fields?.length || 0} Structured Fields</span>
                    <span className="flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform">
                      Inspect Evidence <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
