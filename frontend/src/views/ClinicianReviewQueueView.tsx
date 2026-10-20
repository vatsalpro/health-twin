import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ClipboardList,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

export const ClinicianReviewQueueView: React.FC = () => {
  const { user, refreshPatientData } = useAuth();
  const navigate = useNavigate();

  const [queueData, setQueueData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await api.getClinicianReviewQueue();
      setQueueData(data);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleQuickReview = async (docId: string, fieldId: string, decision: 'ACCEPT' | 'REJECT') => {
    try {
      await api.reviewField(docId, fieldId, decision);
      setActionNotice(`Field ${fieldId.substring(0, 8)}... marked as ${decision}.`);
      setTimeout(() => setActionNotice(null), 3000);
      await loadQueue();
      await refreshPatientData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#E9B96E]">
            <ClipboardList className="w-4 h-4" />
            <span>CLINICIAN OVERSIGHT WORKSPACE</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">Clinical Review & Verification Queue</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Audit pending medical document extractions, confirm uncertain vital flags, and review high-risk research alerts.
          </p>
        </div>

        <button
          onClick={loadQueue}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#142137] hover:bg-[#192a45] text-xs font-medium text-[#5BE7E8] border border-[rgba(166,190,220,0.18)] transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-[#43D6B0]/15 border border-[#43D6B0]/30 text-xs text-[#43D6B0] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Grid: Unreviewed Extractions + Pending Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Unreviewed Fields Requiring Attention */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#F4F7FC] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E9B96E]" />
              Unreviewed Fields & Alerts ({queueData?.unreviewed_fields_count || 0})
            </h3>
            <span className="text-[10px] font-mono text-[#A5B3C8]">Awaiting Human Approval</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {!queueData?.unreviewed_fields || queueData.unreviewed_fields.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#A5B3C8] bg-[#0B1220]/40 rounded-xl">
                No unreviewed fields in queue. All extracted evidence has been human-validated.
              </div>
            ) : (
              queueData.unreviewed_fields.map((f: any) => (
                <div
                  key={f.field_id}
                  className="p-4 glass-panel-elevated rounded-xl border border-[rgba(166,190,220,0.14)] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F4F7FC]">{f.patient_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E9B96E]/20 text-[#E9B96E]">
                      {f.validation_status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-mono text-[#A5B3C8]">{f.field_name}</span>
                    <span className="text-sm font-bold font-mono text-[#5BE7E8]">
                      {f.extracted_value} {f.unit || ''}
                    </span>
                  </div>

                  {f.source_text && (
                    <p className="text-[11px] text-[#A5B3C8] italic bg-[#070B14]/60 p-2 rounded border border-[rgba(166,190,220,0.06)]">
                      "{f.source_text}"
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-[rgba(166,190,220,0.08)]">
                    <button
                      onClick={() => navigate(`/medical-records/${f.document_id}`)}
                      className="text-xs text-[#5BE7E8] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Document
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuickReview(f.document_id, f.field_id, 'REJECT')}
                        className="px-2.5 py-1 rounded bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#F43F5E] text-xs font-semibold"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleQuickReview(f.document_id, f.field_id, 'ACCEPT')}
                        className="px-3 py-1 rounded bg-[#43D6B0]/20 hover:bg-[#43D6B0]/30 text-[#43D6B0] text-xs font-bold"
                      >
                        Accept Field
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Documents & High Risk Research Subjects */}
        <div className="lg:col-span-5 space-y-6">
          {/* Documents Pending Review */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-[#F4F7FC] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#5BE7E8]" />
              Reports Pending Review ({queueData?.pending_documents_count || 0})
            </h3>

            <div className="space-y-3">
              {queueData?.pending_documents?.map((doc: any) => (
                <div
                  key={doc.document_id}
                  onClick={() => navigate(`/medical-records/${doc.document_id}`)}
                  className="p-3.5 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] hover:border-[#5BE7E8]/40 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-[#F4F7FC] group-hover:text-[#5BE7E8] transition-colors truncate">
                      {doc.filename}
                    </p>
                    <p className="text-[10px] text-[#A5B3C8] mt-0.5">
                      {doc.patient_name} ({doc.mrn}) | {doc.category}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#A5B3C8] group-hover:text-[#5BE7E8] group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* High Risk Research Alerts */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border-l-4 border-l-[#F43F5E]">
            <h3 className="text-base font-bold text-[#F4F7FC] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F43F5E]" />
              High Risk Research Subjects
            </h3>
            <p className="text-xs text-[#A5B3C8]">
              Subjects flagged by the 14-day preeclampsia model exceeding high risk thresholds.
            </p>

            <div className="space-y-3">
              {queueData?.high_risk_alerts?.map((alert: any) => (
                <div
                  key={alert.prediction_id}
                  onClick={() => navigate('/risk-forecast')}
                  className="p-3 bg-[#0B1220]/70 rounded-xl border border-[#F43F5E]/30 flex items-center justify-between cursor-pointer hover:bg-[#142137] transition-all"
                >
                  <div>
                    <span className="text-xs font-semibold text-[#F4F7FC]">{alert.patient_name}</span>
                    <span className="text-[10px] text-[#A5B3C8] block font-mono">
                      MRN: {alert.mrn} | GA: {alert.gestational_age_weeks}w
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-[#F43F5E]">
                      {(alert.risk_score * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-[#F43F5E] block uppercase font-mono">HIGH RISK</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
