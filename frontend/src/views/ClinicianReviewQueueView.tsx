import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, EmergencyEventRecord } from '../api/client';
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
  PhoneCall,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

export const ClinicianReviewQueueView: React.FC = () => {
  const { user, selectedPatient, selectedPatientId, refreshPatientData } = useAuth();
  const navigate = useNavigate();

  const [queueData, setQueueData] = useState<any>(null);
  const [emergencies, setEmergencies] = useState<EmergencyEventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ACTIVE'>('ALL');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const pid = filterMode === 'ACTIVE' && selectedPatientId ? selectedPatientId : undefined;
      const [data, emList] = await Promise.all([
        api.getClinicianReviewQueue(pid),
        api.getActiveEmergencies().catch(() => []),
      ]);
      setQueueData(data);
      setEmergencies(emList);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedPatientId, filterMode]);

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

  const handleAcknowledgeEmergency = async (eventId: string) => {
    try {
      await api.acknowledgeEmergency(eventId, 'Clinician triaged and escalated to obstetrics labor & delivery.');
      setActionNotice('Emergency event acknowledged and logged.');
      setTimeout(() => setActionNotice(null), 3000);
      await loadQueue();
    } catch (err: any) {
      alert(`Error acknowledging emergency: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="CLINICIAN OVERSIGHT WORKSPACE"
        title="Clinical Review & Verification Queue"
        description="Audit pending medical document extractions, confirm uncertain vital flags, and review high-risk research alerts."
        actions={
          <div className="flex items-center gap-2.5">
            {/* Filter Toggle: All Subjects vs Active Subject */}
            <div className="flex items-center p-1 bg-purple-50 border border-purple-200/80 rounded-xl text-xs">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterMode === 'ALL'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100/70'
                }`}
              >
                All Subjects
              </button>
              <button
                onClick={() => setFilterMode('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterMode === 'ACTIVE'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100/70'
                }`}
                title={selectedPatient ? `Filter review queue for ${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Filter by active subject'}
              >
                {selectedPatient ? selectedPatient.first_name : 'Active Subject'}
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadQueue}
              isLoading={loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Active Maternal Emergencies Section */}
      {emergencies && emergencies.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-500 shadow-lg space-y-3 animate-emergency-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-900">
              <ShieldAlert className="w-6 h-6 text-red-600 animate-bounce" />
              <h3 className="font-black text-base tracking-tight uppercase">
                Active Maternal Emergency Alerts ({emergencies.length})
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white animate-pulse">
              15-Min Escalation SLA Active
            </span>
          </div>

          <div className="space-y-3">
            {emergencies.map((em) => (
              <div
                key={em.id}
                className="p-4 rounded-xl bg-white border border-red-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{em.patient_name || 'Patient'}</span>
                    {em.mrn && <span className="font-mono text-xs text-slate-500">MRN: {em.mrn}</span>}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-800 uppercase">
                      {em.severity}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-red-900">
                    {em.symptoms_summary}
                  </p>
                  {em.trigger_message && (
                    <p className="text-[11px] text-slate-600 italic">
                      &ldquo;{em.trigger_message}&rdquo;
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Reported: {new Date(em.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="tel:911"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Triage / 911</span>
                  </a>
                  <button
                    onClick={() => handleAcknowledgeEmergency(em.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge & Triage</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                {filterMode === 'ACTIVE' && selectedPatient && (
                  <Badge variant="purple" size="sm">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </Badge>
                )}
                <Badge variant="warning">Awaiting Approval</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading queue items...</div>
                ) : !queueData?.unreviewed_fields || queueData.unreviewed_fields.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-purple-50/40 rounded-xl border border-purple-200">
                    <CheckCircle2 className="w-7 h-7 text-purple-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-800">
                      {filterMode === 'ACTIVE' && selectedPatient
                        ? `No pending reviews for ${selectedPatient.first_name} ${selectedPatient.last_name}`
                        : 'No unreviewed fields in queue'}
                    </p>
                    <p className="text-slate-500 mt-1">
                      {filterMode === 'ACTIVE'
                        ? 'All clinical extractions for this subject have been validated.'
                        : 'All extracted evidence across all subjects has been human-validated.'}
                    </p>
                    {filterMode === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 text-purple-700 hover:bg-purple-100"
                        onClick={() => setFilterMode('ALL')}
                      >
                        Show All Patients
                      </Button>
                    )}
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
