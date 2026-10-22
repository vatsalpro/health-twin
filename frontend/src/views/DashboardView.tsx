import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MaternalTwinState, RiskPrediction, ClinicalObservation } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock,
  Dna,
  FileText,
  HeartPulse,
  Sparkles,
  TrendingUp,
  Upload,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
  Pill,
} from 'lucide-react';
import { CraneDoctorMascot } from '../components/CraneDoctorMascot';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

export const DashboardView: React.FC = () => {
  const { user, selectedPatient, selectedPatientId } = useAuth();
  const navigate = useNavigate();

  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [trajectories, setTrajectories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [twinData, preds, obsData, compData] = await Promise.all([
          api.getCurrentTwin(selectedPatientId).catch(() => null),
          api.getPredictions(selectedPatientId).catch(() => []),
          api.getObservations(selectedPatientId).catch(() => []),
          api.getHistoricalComparisons(selectedPatientId).catch(() => ({ trajectories: [] })),
        ]);
        setTwin(twinData);
        if (preds && preds.length > 0) {
          const validPred = preds.find((p) => !p.is_insufficient_data) || preds[0];
          setPrediction(validPred);
        } else {
          setPrediction(null);
        }
        setObservations(obsData || []);
        setTrajectories(compData?.trajectories || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [selectedPatientId]);

  // Compute Recent Changes (comparing latest vs previous measurement)
  const recentChanges = useMemo(() => {
    // Sort accepted observations chronologically
    const acceptedObs = [...observations].filter((o) => o.review_status === 'ACCEPTED');

    const getDeltaForTest = (testKeys: string[]) => {
      const matching = acceptedObs
        .filter((o) => testKeys.includes(o.test_name.toLowerCase().replace(/[\s_]/g, '')))
        .sort((a, b) => new Date(a.measurement_timestamp).getTime() - new Date(b.measurement_timestamp).getTime());

      if (matching.length < 2) {
        if (matching.length === 1) {
          return {
            hasHistory: false,
            latest: matching[0],
            previous: null,
            delta: null,
            message: `Baseline: ${matching[0].value_numeric} ${matching[0].unit} on ${new Date(matching[0].measurement_timestamp).toLocaleDateString()}`,
          };
        }
        return { hasHistory: false, latest: null, previous: null, delta: null, message: 'No recorded observations' };
      }

      const prev = matching[matching.length - 2];
      const curr = matching[matching.length - 1];
      const prevVal = prev.value_numeric ?? 0;
      const currVal = curr.value_numeric ?? 0;
      const deltaVal = currVal - prevVal;

      return {
        hasHistory: true,
        latest: curr,
        previous: prev,
        delta: deltaVal,
        prevDate: new Date(prev.measurement_timestamp).toLocaleDateString(),
        currDate: new Date(curr.measurement_timestamp).toLocaleDateString(),
      };
    };

    return {
      sbp: getDeltaForTest(['systolicbp', 'sbp', 'bloodpressuresystolic']),
      dbp: getDeltaForTest(['diastolicbp', 'dbp', 'bloodpressurediastolic']),
      platelets: getDeltaForTest(['platelets', 'plateletcount', 'cbcplatelets']),
      upcr: getDeltaForTest(['proteinuria', 'upcr', 'proteincreatinineratio']),
    };
  }, [observations]);

  // Format chart data from trajectories or observations
  interface BpChartPoint {
    label: string;
    ga?: number;
    sbp?: number;
    dbp?: number;
    map?: number;
    date?: string;
  }

  const bpChartData = useMemo<BpChartPoint[]>(() => {
    if (trajectories && trajectories.length > 0) {
      return trajectories
        .filter((t) => t.sbp !== undefined || t.dbp !== undefined)
        .map((t) => ({
          label: t.gestational_age_weeks ? `Wk ${t.gestational_age_weeks.toFixed(0)}` : t.date || 'Visit',
          ga: t.gestational_age_weeks,
          sbp: t.sbp,
          dbp: t.dbp,
          map: t.map_pressure || (t.sbp && t.dbp ? Math.round((t.sbp + 2 * t.dbp) / 3) : undefined),
          date: t.date,
        }));
    }

    // Fallback: build from observations
    const dateMap: Record<string, BpChartPoint> = {};
    observations.forEach((obs) => {
      const d = new Date(obs.measurement_timestamp).toLocaleDateString();
      if (!dateMap[d]) {
        dateMap[d] = {
          label: obs.gestational_age_weeks ? `Wk ${obs.gestational_age_weeks.toFixed(0)}` : d,
          ga: obs.gestational_age_weeks,
          date: d,
        };
      }
      const k = obs.test_name.toLowerCase().replace(/[\s_]/g, '');
      if (k === 'systolicbp' || k === 'sbp') dateMap[d].sbp = obs.value_numeric;
      if (k === 'diastolicbp' || k === 'dbp') dateMap[d].dbp = obs.value_numeric;
      if (dateMap[d].sbp && dateMap[d].dbp) {
        dateMap[d].map = Math.round((dateMap[d].sbp! + 2 * dateMap[d].dbp!) / 3);
      }
    });

    return Object.values(dateMap);
  }, [trajectories, observations]);

  if (!selectedPatient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-800">No Patient Profile Selected</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          {isClinician
            ? 'Please select an active research subject from the sidebar selector to review maternal telemetry.'
            : 'Your active clinical profile is loading. Please refresh or contact your healthcare coordinator.'}
        </p>
      </div>
    );
  }

  const activeEpisode = selectedPatient.episodes?.[0];
  const gaWeeks = activeEpisode?.current_gestational_age_weeks || twin?.gestational_age_weeks;

  return (
    <div className="space-y-6">
      {/* Patient Clinical Context Banner */}
      <div className="glass-panel p-5 md:p-6 rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {selectedPatient.first_name} {selectedPatient.last_name}
            </h2>
            <Badge variant="primary" className="font-mono text-xs">
              MRN: {selectedPatient.mrn}
            </Badge>
            <Badge variant="neutral">
              Singleton Pregnancy
            </Badge>
            {twin?.data_freshness_status && (
              <Badge variant={twin.data_freshness_status === 'FRESH' ? 'success' : 'warning'}>
                {twin.data_freshness_status} TELEMETRY
              </Badge>
            )}
            {selectedPatient.chronic_hypertension && (
              <Badge variant="warning">Chronic HTN</Badge>
            )}
            {selectedPatient.prior_preeclampsia && (
              <Badge variant="danger">Prior Preeclampsia</Badge>
            )}
          </div>

          <div className="text-xs md:text-sm text-slate-600 mt-2 flex items-center gap-3 flex-wrap">
            <span>Gestational Age: <strong className="text-sky-700 font-semibold font-mono">{gaWeeks ? `${gaWeeks.toFixed(1)} weeks` : 'Not recorded'}</strong></span>
            <span>•</span>
            <span>EDD: <strong className="text-slate-800 font-semibold">{activeEpisode?.estimated_due_date || 'Not calculated'}</strong></span>
            <span>•</span>
            <span>Maternal Age: <strong className="text-slate-800 font-semibold">{selectedPatient.maternal_age} yrs</strong></span>
            <span>•</span>
            <span>Obstetric History: <strong className="text-slate-800 font-semibold">G{selectedPatient.gravidity} P{selectedPatient.parity}</strong></span>
          </div>
        </div>

        {/* Role-Specific Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isClinician ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/clinician/review-queue')}
                icon={<ClipboardList className="w-4 h-4 text-amber-600" />}
              >
                Review Queue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/medical-records')}
                icon={<Upload className="w-4 h-4 text-slate-600" />}
              >
                Upload PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/measurements-devices')}
                icon={<Cpu className="w-4 h-4 text-sky-700" />}
              >
                Log Vitals
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/simulation-lab')}
                icon={<Sparkles className="w-4 h-4 text-white" />}
              >
                Simulation Lab
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/pregnancy-timeline')}
                icon={<Clock className="w-4 h-4 text-slate-600" />}
              >
                Care Timeline
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/measurements-devices')}
                icon={<Cpu className="w-4 h-4 text-sky-700" />}
              >
                Log Home Measurement
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/maternal-twin')}
                icon={<Dna className="w-4 h-4 text-white" />}
              >
                My Digital Twin
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dr. Crane AI Doctor & Care Coordination Banner (Patients Only) */}
      {!isClinician && (
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-purple-200/90 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-1 rounded-2xl bg-purple-100/60 border border-purple-200 shrink-0">
            <CraneDoctorMascot expression="friendly" size="md" showBadge={false} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-purple-950 text-base">Dr. Crane AI Doctor Assistant</h3>
              <Badge variant="purple" size="sm">Grounded Care Plan</Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
              Have questions about your prescribed medications, blood pressure trends, or upcoming visits?
              Dr. Crane provides instant, clinician-approved answers and 24/7 emergency escalation.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/medications')}
            icon={<Pill className="w-3.5 h-3.5 text-purple-700" />}
          >
            My Medications
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/appointments')}
            icon={<Calendar className="w-3.5 h-3.5 text-teal-700" />}
          >
            Appointments
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/ai-assistant')}
            icon={<Sparkles className="w-3.5 h-3.5 text-white" />}
          >
            Ask Dr. Crane
          </Button>
        </div>
      </div>
      )}

      {/* Primary KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blood Pressure & MAP */}
        <MetricCard
          label="Blood Pressure & MAP"
          value={twin?.sbp && twin?.dbp ? `${twin.sbp}/${twin.dbp}` : '—'}
          unit={twin?.sbp ? 'mmHg' : undefined}
          secondary={twin?.map_pressure ? `Mean Arterial: ${twin.map_pressure} mmHg` : 'No validated blood pressure'}
          statusBadge={
            twin?.sbp && twin.sbp >= 140
              ? { text: 'Elevated (≥140/90)', variant: 'danger' }
              : twin?.sbp
              ? { text: 'Normotensive', variant: 'success' }
              : { text: 'Pending Verification', variant: 'neutral' }
          }
          icon={<HeartPulse className="w-4 h-4 text-sky-600" />}
        />

        {/* Gestational Age */}
        <MetricCard
          label="Gestational Horizon"
          value={gaWeeks ? gaWeeks.toFixed(1) : '—'}
          unit={gaWeeks ? 'weeks' : undefined}
          secondary={
            gaWeeks
              ? gaWeeks < 20
                ? 'Pre-20w (Baseline Surveillance)'
                : '≥ 20w (Preeclampsia Horizon Active)'
              : 'Gestational age unverified'
          }
          statusBadge={
            gaWeeks
              ? { text: `Trimester ${gaWeeks < 13 ? '1' : gaWeeks < 27 ? '2' : '3'}`, variant: 'info' }
              : { text: 'Not Available', variant: 'neutral' }
          }
          icon={<Calendar className="w-4 h-4 text-teal-600" />}
        />

        {/* Proteinuria / UPCR */}
        <MetricCard
          label="Proteinuria / UPCR"
          value={
            twin?.protein_creatinine_ratio !== undefined && twin?.protein_creatinine_ratio !== null
              ? twin.protein_creatinine_ratio
              : twin?.proteinuria_dipstick || '—'
          }
          unit={twin?.protein_creatinine_ratio ? 'mg/mg' : undefined}
          secondary={
            twin?.protein_creatinine_ratio
              ? 'Spot Urine Protein-Creatinine Ratio'
              : twin?.proteinuria_dipstick
              ? 'Urinalysis Dipstick Observation'
              : 'No protein assay on file'
          }
          statusBadge={
            (twin?.protein_creatinine_ratio && twin.protein_creatinine_ratio >= 0.3) ||
            (twin?.proteinuria_dipstick && ['1+', '2+', '3+'].includes(twin.proteinuria_dipstick))
              ? { text: 'Proteinuria Detected', variant: 'warning' }
              : twin?.proteinuria_dipstick
              ? { text: 'Normal / Negative', variant: 'success' }
              : { text: 'Not Tested', variant: 'neutral' }
          }
          icon={<Activity className="w-4 h-4 text-amber-600" />}
        />

        {/* Platelet Count */}
        <MetricCard
          label="Platelet Count"
          value={twin?.platelets ? twin.platelets : '—'}
          unit={twin?.platelets ? '×10³/µL' : undefined}
          secondary={
            twin?.platelets
              ? twin.platelets < 100
                ? 'Thrombocytopenia Warning (<100k)'
                : 'Complete Blood Count Normal'
              : 'No CBC panel recorded'
          }
          statusBadge={
            twin?.platelets && twin.platelets < 100
              ? { text: 'Low (<100k)', variant: 'danger' }
              : twin?.platelets
              ? { text: 'Adequate', variant: 'success' }
              : { text: 'Not Tested', variant: 'neutral' }
          }
          icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
        />
      </div>

      {/* Recent Longitudinal Changes Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Recent Longitudinal Changes</span>
              </CardTitle>
              <CardDescription>
                Comparison between latest verified measurements and the preceding clinical observation.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/observations')}
              className="text-xs text-sky-700"
            >
              <span>Full Trend Log</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* SBP Delta */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Systolic BP</span>
              {recentChanges.sbp.hasHistory ? (
                <div className="mt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {recentChanges.sbp.latest?.value_numeric} mmHg
                    </span>
                    <span
                      className={`text-xs font-semibold font-mono flex items-center ${
                        recentChanges.sbp.delta! > 0
                          ? 'text-rose-600'
                          : recentChanges.sbp.delta! < 0
                          ? 'text-sky-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {recentChanges.sbp.delta! > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : recentChanges.sbp.delta! < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      {recentChanges.sbp.delta! > 0 ? `+${recentChanges.sbp.delta}` : recentChanges.sbp.delta} mmHg
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Prev: {recentChanges.sbp.previous?.value_numeric} mmHg on {recentChanges.sbp.prevDate}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">{recentChanges.sbp.message}</p>
              )}
            </div>

            {/* DBP Delta */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Diastolic BP</span>
              {recentChanges.dbp.hasHistory ? (
                <div className="mt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {recentChanges.dbp.latest?.value_numeric} mmHg
                    </span>
                    <span
                      className={`text-xs font-semibold font-mono flex items-center ${
                        recentChanges.dbp.delta! > 0
                          ? 'text-rose-600'
                          : recentChanges.dbp.delta! < 0
                          ? 'text-sky-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {recentChanges.dbp.delta! > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : recentChanges.dbp.delta! < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      {recentChanges.dbp.delta! > 0 ? `+${recentChanges.dbp.delta}` : recentChanges.dbp.delta} mmHg
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Prev: {recentChanges.dbp.previous?.value_numeric} mmHg on {recentChanges.dbp.prevDate}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">{recentChanges.dbp.message}</p>
              )}
            </div>

            {/* Platelets Delta */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Platelets (CBC)</span>
              {recentChanges.platelets.hasHistory ? (
                <div className="mt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {recentChanges.platelets.latest?.value_numeric}
                    </span>
                    <span
                      className={`text-xs font-semibold font-mono flex items-center ${
                        recentChanges.platelets.delta! < 0
                          ? 'text-amber-600'
                          : recentChanges.platelets.delta! > 0
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {recentChanges.platelets.delta! < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                      {recentChanges.platelets.delta! > 0
                        ? `+${recentChanges.platelets.delta}`
                        : recentChanges.platelets.delta}k
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Prev: {recentChanges.platelets.previous?.value_numeric}k on {recentChanges.platelets.prevDate}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">{recentChanges.platelets.message}</p>
              )}
            </div>

            {/* Proteinuria UPCR Delta */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Proteinuria / UPCR</span>
              {recentChanges.upcr.hasHistory ? (
                <div className="mt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {recentChanges.upcr.latest?.value_numeric} mg/mg
                    </span>
                    <span
                      className={`text-xs font-semibold font-mono flex items-center ${
                        recentChanges.upcr.delta! > 0
                          ? 'text-rose-600'
                          : recentChanges.upcr.delta! < 0
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {recentChanges.upcr.delta! > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {recentChanges.upcr.delta! > 0
                        ? `+${recentChanges.upcr.delta?.toFixed(2)}`
                        : recentChanges.upcr.delta?.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Prev: {recentChanges.upcr.previous?.value_numeric} mg/mg on {recentChanges.upcr.prevDate}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">{recentChanges.upcr.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Living Twin 3D Viewport + Risk Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Compact Maternal Digital Twin 3D Panel */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Maternal Digital Twin (3D)</CardTitle>
                  <Badge variant="primary" className="font-mono text-[10px]">
                    v{twin?.version || 1}
                  </Badge>
                </div>
                <CardDescription>
                  Organic multi-scale anatomical twin coupled to maternal heart rate, MAP velocity, and gestational weeks.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/maternal-twin')}
              >
                <span>Full Lab</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="h-72 w-full relative bg-purple-50/20 backdrop-blur-xs rounded-2xl overflow-hidden border border-purple-100/50">
            <MaternalTwin3D
              gestationalAgeWeeks={gaWeeks || 28.0}
              sbp={twin?.sbp || undefined}
              dbp={twin?.dbp || undefined}
              riskCategory={prediction?.risk_category || 'UNKNOWN'}
              className="w-full h-full"
            />
          </CardContent>

          <div className="p-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Baseline Blood Pressure</span>
              <p className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                {twin?.sbp && twin?.dbp ? `${twin.sbp}/${twin.dbp} mmHg` : 'Not recorded'}
              </p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Pulse Pressure</span>
              <p className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                {twin?.pulse_pressure ? `${twin.pulse_pressure} mmHg` : 'Not recorded'}
              </p>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Telemetry Status</span>
              <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                {twin?.data_freshness_status || 'SYNCHRONIZED'}
              </p>
            </div>
          </div>
        </Card>

        {/* 14-Day Preeclampsia Research Risk Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-l-4 border-l-sky-600">
            <CardHeader>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Predictive Research Horizon
                </span>
                <CardTitle className="mt-0.5">14-Day Preeclampsia Risk Forecast</CardTitle>
              </div>
              <Badge
                variant={
                  prediction?.risk_category === 'HIGH'
                    ? 'danger'
                    : prediction?.risk_category === 'MODERATE'
                    ? 'warning'
                    : prediction?.risk_category === 'LOW'
                    ? 'success'
                    : 'neutral'
                }
                className="font-bold uppercase tracking-wider text-[11px]"
              >
                {prediction?.risk_category || 'EVALUATING'}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              {prediction?.is_insufficient_data ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <p className="font-semibold text-amber-800">Insufficient Data for Assessment</p>
                  <p className="text-amber-700 leading-relaxed">
                    {prediction.insufficient_data_reason ||
                      'Risk assessment requires patient gestational age ≥ 20.0 weeks and validated baseline blood pressure measurements per ACOG/ISSHP criteria.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold font-mono text-slate-900">
                        {prediction?.risk_score !== undefined
                          ? `${(prediction.risk_score * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">estimated 14-day risk</span>
                    </div>
                    {prediction?.confidence_interval_lower !== undefined && (
                      <span className="text-xs font-mono text-slate-500">
                        95% CI: [{(prediction.confidence_interval_lower * 100).toFixed(0)}% – {(prediction.confidence_interval_upper! * 100).toFixed(0)}%]
                      </span>
                    )}
                  </div>

                  {/* Accessible Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                    <div
                      className={`h-full transition-all duration-700 ${
                        (prediction?.risk_score || 0) >= 0.4
                          ? 'bg-rose-600'
                          : (prediction?.risk_score || 0) >= 0.15
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, (prediction?.risk_score || 0) * 100)}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Evaluated by the calibrated multivariable research model using verified clinical observations.
                    Strict temporal cutoff is enforced to prevent data leakage.
                  </p>
                </div>
              )}

              {isClinician && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => navigate('/risk-forecast')}
                >
                  <span>Inspect Feature Contributions & Biomarkers</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Secondary Organ System Biomarkers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Secondary Clinical Biomarkers
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-sky-700 hover:text-sky-800"
                onClick={() => navigate('/observations')}
              >
                <span>All Observations</span>
              </Button>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Liver Enzymes (AST/ALT)</span>
                  <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {twin?.ast !== undefined && twin?.ast !== null ? `${twin.ast}` : '—'} / {twin?.alt !== undefined && twin?.alt !== null ? `${twin.alt}` : '—'}
                    {twin?.ast !== undefined && <span className="text-[10px] text-slate-500 font-normal"> U/L</span>}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {twin?.ast && twin.ast > 70 ? 'Elevated transaminases' : 'ACOG threshold: ≤ 70 U/L'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Serum Creatinine</span>
                  <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {twin?.serum_creatinine !== undefined && twin?.serum_creatinine !== null
                      ? `${twin.serum_creatinine} mg/dL`
                      : '—'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {twin?.serum_creatinine && twin.serum_creatinine > 1.1
                      ? 'Renal impairment alert'
                      : 'Threshold: ≤ 1.1 mg/dL'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Longitudinal Blood Pressure Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-sky-600" />
                <span>Longitudinal Blood Pressure Trajectory</span>
              </CardTitle>
              <CardDescription>
                Historical systolic, diastolic, and calculated mean arterial pressure trends across gestational weeks.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Systolic
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Diastolic
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> MAP
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {bpChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bpChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 180]}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                    unit=" mmHg"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs">
                          <p className="font-bold text-slate-900 mb-1">{d.label} ({d.date || 'Visit'})</p>
                          {d.sbp && <p className="text-rose-600 font-mono">SBP: {d.sbp} mmHg</p>}
                          {d.dbp && <p className="text-sky-600 font-mono">DBP: {d.dbp} mmHg</p>}
                          {d.map && <p className="text-teal-600 font-mono">MAP: {d.map} mmHg</p>}
                        </div>
                      );
                    }}
                  />
                  {/* Clinical Diagnostic Thresholds */}
                  <ReferenceLine y={140} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'SBP ≥140', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }} />
                  <ReferenceLine y={90} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'DBP ≥90', fill: '#F59E0B', fontSize: 10, position: 'insideBottomRight' }} />
                  <Line type="monotone" dataKey="sbp" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4, fill: '#EF4444' }} />
                  <Line type="monotone" dataKey="dbp" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4, fill: '#0284C7' }} />
                  <Line type="monotone" dataKey="map" stroke="#0D9488" strokeWidth={1.5} strokeDasharray="2 2" dot={{ r: 3, fill: '#0D9488' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-slate-200/70">
              <Activity className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Longitudinal Blood Pressure Recordings</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Upload antenatal reports or log verified sphygmomanometer readings to construct the longitudinal hemodynamic trajectory.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-Based Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate(isClinician ? '/simulation-lab' : '/pregnancy-timeline')}
          className="glass-panel p-5 rounded-2xl shadow-xs hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              {isClinician ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">
            {isClinician ? 'Simulation Lab (What-If?)' : 'Care & Visit Timeline'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {isClinician
              ? 'Counterfactual modeling of blood pressure, metabolic shifts, and sensor uncertainty.'
              : 'Chronological timeline of your antenatal checkups, tests, and baby milestones.'}
          </p>
        </div>

        <div
          onClick={() => navigate('/measurements-devices')}
          className="glass-panel p-5 rounded-2xl shadow-xs hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Cpu className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">
            {isClinician ? 'Sensor Hub & Vitals' : 'My Daily Vitals Log'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {isClinician
              ? 'Manage connected Bluetooth monitors, CGM streams, and manual ambulatory records.'
              : 'Easily record home blood pressure, glucose, temperature, and weight.'}
          </p>
        </div>

        <div
          onClick={() => navigate(isClinician ? '/medical-records' : '/maternal-twin')}
          className="glass-panel p-5 rounded-2xl shadow-xs hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              {isClinician ? <FileText className="w-5 h-5" /> : <Dna className="w-5 h-5" />}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">
            {isClinician ? 'Antenatal Documents & PDFs' : 'My Health Twin (3D)'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {isClinician
              ? 'Inspect uploaded lab reports with coordinate-accurate AI bounding box extraction.'
              : 'Explore the 3D anatomical visualization of your pregnancy progression.'}
          </p>
        </div>
      </div>
    </div>
  );
};
