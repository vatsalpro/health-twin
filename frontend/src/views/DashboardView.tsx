import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MaternalTwinState, RiskPrediction } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
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
  Cpu
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

export const DashboardView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const navigate = useNavigate();

  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [twinData, preds] = await Promise.all([
          api.getCurrentTwin(selectedPatientId),
          api.getPredictions(selectedPatientId),
        ]);
        setTwin(twinData);
        if (preds.length > 0) {
          const validPred = preds.find((p) => !p.is_insufficient_data) || preds[0];
          setPrediction(validPred);
        } else {
          setPrediction(null);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [selectedPatientId]);

  if (!selectedPatient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-800">No Research Subject Selected</h2>
        <p className="text-sm text-slate-500 mt-1">Please select an active patient from the sidebar context switcher.</p>
      </div>
    );
  }

  const activeEpisode = selectedPatient.episodes[0];
  const gaWeeks = activeEpisode?.current_gestational_age_weeks || twin?.gestational_age_weeks;

  return (
    <div className="space-y-6">
      {/* Patient Overview Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {selectedPatient.first_name} {selectedPatient.last_name}
            </h2>
            <Badge variant="primary" className="font-mono">
              MRN: {selectedPatient.mrn}
            </Badge>
            <Badge variant="neutral">
              Singleton Episode
            </Badge>
            {twin?.data_freshness_status && (
              <Badge variant={twin.data_freshness_status === 'FRESH' ? 'success' : 'warning'}>
                {twin.data_freshness_status} OBSERVATIONS
              </Badge>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
            <span>EDD: <strong className="text-slate-800 font-semibold">{activeEpisode?.estimated_due_date || 'Not calculated'}</strong></span>
            <span>•</span>
            <span>Maternal Age: <strong className="text-slate-800 font-semibold">{selectedPatient.maternal_age} yrs</strong></span>
            <span>•</span>
            <span>Obstetric History: <strong className="text-slate-800 font-semibold">G{selectedPatient.gravidity} P{selectedPatient.parity}</strong></span>
            <span>•</span>
            <span>Gestational Age: <strong className="text-sky-700 font-semibold font-mono">{gaWeeks ? `${gaWeeks.toFixed(1)} weeks` : 'Not recorded'}</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/medical-records')}
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Upload Document</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/measurements-devices')}
          >
            <Cpu className="w-4 h-4 text-sky-700" />
            <span>Manual Vitals Entry</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/simulation-lab')}
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Launch Simulation</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Blood Pressure"
          value={twin?.sbp && twin?.dbp ? `${twin.sbp}/${twin.dbp}` : '—'}
          unit={twin?.sbp ? 'mmHg' : undefined}
          secondary={twin?.map_pressure ? `MAP: ${twin.map_pressure} mmHg` : 'No verified recording'}
          statusBadge={
            twin?.sbp && twin.sbp >= 140
              ? { text: 'Elevated (≥140)', variant: 'danger' }
              : twin?.sbp
              ? { text: 'Normotensive', variant: 'success' }
              : { text: 'Not available', variant: 'neutral' }
          }
          icon={<HeartPulse className="w-4 h-4" />}
        />

        <MetricCard
          label="Gestational Age"
          value={gaWeeks ? gaWeeks.toFixed(1) : '—'}
          unit={gaWeeks ? 'weeks' : undefined}
          secondary={
            gaWeeks
              ? gaWeeks < 20
                ? 'Pre-20w (Chronic screening)'
                : '≥ 20w (Gestational horizon)'
              : 'Gestational age unverified'
          }
          statusBadge={
            gaWeeks
              ? { text: `Trimester ${gaWeeks < 13 ? '1' : gaWeeks < 27 ? '2' : '3'}`, variant: 'info' }
              : { text: 'Not available', variant: 'neutral' }
          }
          icon={<Calendar className="w-4 h-4" />}
        />

        <MetricCard
          label="Proteinuria"
          value={
            twin?.protein_creatinine_ratio !== undefined && twin?.protein_creatinine_ratio !== null
              ? twin.protein_creatinine_ratio
              : twin?.proteinuria_dipstick || '—'
          }
          unit={twin?.protein_creatinine_ratio ? 'mg/mg' : undefined}
          secondary={
            twin?.protein_creatinine_ratio
              ? 'UPCR quantified'
              : twin?.proteinuria_dipstick
              ? 'Dipstick observation'
              : 'No protein test recorded'
          }
          statusBadge={
            (twin?.protein_creatinine_ratio && twin.protein_creatinine_ratio >= 0.3) ||
            (twin?.proteinuria_dipstick && ['1+', '2+', '3+'].includes(twin.proteinuria_dipstick))
              ? { text: 'Proteinuria Detected', variant: 'warning' }
              : twin?.proteinuria_dipstick
              ? { text: 'Normal / Negative', variant: 'success' }
              : { text: 'Not available', variant: 'neutral' }
          }
          icon={<Activity className="w-4 h-4" />}
        />

        <MetricCard
          label="Platelet Count"
          value={twin?.platelets ? twin.platelets : '—'}
          unit={twin?.platelets ? '×10³/µL' : undefined}
          secondary={
            twin?.platelets
              ? twin.platelets < 100
                ? 'Thrombocytopenia alert'
                : 'Platelet count normal'
              : 'No CBC laboratory record'
          }
          statusBadge={
            twin?.platelets && twin.platelets < 100
              ? { text: 'Low (<100k)', variant: 'danger' }
              : twin?.platelets
              ? { text: 'Adequate', variant: 'success' }
              : { text: 'Not available', variant: 'neutral' }
          }
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Main Grid: Living Twin 3D Viewport + Risk Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Living Twin 3D Canvas Box */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Maternal Digital Twin (3D)</CardTitle>
                <Badge variant="primary" className="font-mono text-[10px]">
                  Version {twin?.version || 1}
                </Badge>
              </div>
              <CardDescription>
                Visual anatomical synthesis reflecting verified maternal observations and gestational stage.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/maternal-twin')}
            >
              <span>Full Visualizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>

          <CardContent className="h-80 w-full relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
            <MaternalTwin3D
              gestationalAgeWeeks={gaWeeks || 28.0}
              sbp={twin?.sbp || undefined}
              dbp={twin?.dbp || undefined}
              riskCategory={prediction?.risk_category || 'UNKNOWN'}
              className="w-full h-full"
            />
          </CardContent>

          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Baseline SBP/DBP</span>
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
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Telemetry Sync</span>
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
                className="font-bold uppercase tracking-wider"
              >
                {prediction?.risk_category || 'EVALUATING'}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              {prediction?.is_insufficient_data ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <p className="font-semibold text-amber-800">Insufficient Clinical Data for Assessment</p>
                  <p className="text-amber-700 leading-relaxed">
                    {prediction.insufficient_data_reason ||
                      'Risk assessment requires patient gestational age ≥ 20 weeks and validated baseline blood pressure measurements.'}
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
                      <span className="text-xs text-slate-500 ml-2">predicted risk probability</span>
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
                    Evaluated by the longitudinal preeclampsia risk model using verified clinical observations.
                    Strict temporal cutoffs are enforced to prevent prospective data leakage.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate('/risk-forecast')}
              >
                <span>Inspect Biomarker Evidence & Feature Weights</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Secondary Laboratory Values Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Additional Organ System Markers</CardTitle>
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
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Liver Enzymes (AST / ALT)</span>
                  <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    {twin?.ast !== undefined && twin?.ast !== null ? `${twin.ast}` : 'Not recorded'} / {twin?.alt !== undefined && twin?.alt !== null ? `${twin.alt}` : 'Not recorded'}
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
                      : 'Not recorded'}
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

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/simulation-lab')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">Simulation Lab (What-If?)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Explore counterfactual scenarios with explicit mathematical formulas and zero risk of record contamination.
          </p>
        </div>

        <div
          onClick={() => navigate('/measurements-devices')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Cpu className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">Measurements & Connected Sensors</h4>
          <p className="text-xs text-slate-500 mt-1">
            Unified entry for BP, glucose, separate weight & temperature, pulse oximetry, and mock device streams.
          </p>
        </div>

        <div
          onClick={() => navigate('/pregnancy-timeline')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Clock className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-slate-900 mt-3">Longitudinal Antenatal Timeline</h4>
          <p className="text-xs text-slate-500 mt-1">
            Chronological log of obstetric visits, lab panels, and maternal physiological progressions.
          </p>
        </div>
      </div>
    </div>
  );
};
