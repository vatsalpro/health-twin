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
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

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
      <PageHeader
        badge="CLINICIAN OVERSIGHT WORKSPACE"
        title="Clinical Review & Verification Queue"
        description="Audit pending medical document extractions, confirm uncertain vital flags, and review high-risk research alerts."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadQueue}
            isLoading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Queue
          </Button>
        }
      />

      {actionNotice && (
        <Alert
          variant="success"
          title="Review Updated"
          description={actionNotice}
        />
      )}

      {/* Grid: Unreviewed Extractions + Pending Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Unreviewed Fields Requiring Attention */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-base">
                  Unreviewed Fields & Alerts ({queueData?.unreviewed_fields_count || 0})
                </CardTitle>
              </div>
              <Badge variant="warning">Awaiting Approval</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading queue items...</div>
                ) : !queueData?.unreviewed_fields || queueData.unreviewed_fields.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    No unreviewed fields in queue. All extracted evidence has been human-validated.
                  </div>
                ) : (
                  queueData.unreviewed_fields.map((f: any) => (
                    <div
                      key={f.field_id}
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{f.patient_name}</span>
                        <Badge variant="warning">{f.validation_status}</Badge>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-mono text-slate-500">{f.field_name}</span>
                        <span className="text-sm font-bold font-mono text-sky-800">
                          {f.extracted_value} {f.unit || ''}
                        </span>
                      </div>

                      {f.source_text && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                          "{f.source_text}"
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-sky-700 hover:text-sky-800"
                          onClick={() => navigate(`/medical-records/${f.document_id}`)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Inspect Document
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-rose-600 hover:bg-rose-50"
                            onClick={() => handleQuickReview(f.document_id, f.field_id, 'REJECT')}
                            icon={<X className="w-3.5 h-3.5" />}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => handleQuickReview(f.document_id, f.field_id, 'ACCEPT')}
                            icon={<Check className="w-3.5 h-3.5" />}
                          >
                            Accept Field
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Documents & High Risk Research Subjects */}
        <div className="lg:col-span-5 space-y-6">
          {/* Documents Pending Review */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <CardTitle className="text-base">
                  Reports Pending Review ({queueData?.pending_documents_count || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {queueData?.pending_documents?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No pending documents</p>
                ) : (
                  queueData?.pending_documents?.map((doc: any) => (
                    <div
                      key={doc.document_id}
                      onClick={() => navigate(`/medical-records/${doc.document_id}`)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <div className="truncate pr-2">
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                          {doc.filename}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {doc.patient_name} ({doc.mrn}) • {doc.category}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* High Risk Research Alerts */}
          <Card className="border-l-4 border-l-rose-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <CardTitle className="text-base">High Risk Research Subjects</CardTitle>
              </div>
              <CardDescription>
                Subjects flagged by the 14-day preeclampsia model exceeding high risk thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {queueData?.high_risk_alerts?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No high risk alerts</p>
                ) : (
                  queueData?.high_risk_alerts?.map((alert: any) => (
                    <div
                      key={alert.prediction_id}
                      onClick={() => navigate('/risk-forecast')}
                      className="p-3 bg-rose-50/50 hover:bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="text-xs font-semibold text-slate-900">{alert.patient_name}</span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          MRN: {alert.mrn} • GA: {alert.gestational_age_weeks}w
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-rose-700">
                          {(alert.risk_score * 100).toFixed(1)}%
                        </span>
                        <Badge variant="danger" size="sm" className="block mt-0.5">HIGH RISK</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
