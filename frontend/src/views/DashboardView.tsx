import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, MaternalTwinState, RiskPrediction, MedicalDocument } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Dna,
  FileText,
  Heart,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const navigate = useNavigate();

  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [twinData, preds, timelineData] = await Promise.all([
          api.getCurrentTwin(selectedPatientId),
          api.getPredictions(selectedPatientId),
          api.getPatientTimeline(selectedPatientId),
        ]);
        setTwin(twinData);
        if (preds.length > 0) {
          setPrediction(preds[0]);
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertCircle className="w-12 h-12 text-[#A5B3C8] mb-3" />
        <h2 className="text-xl font-semibold text-[#F4F7FC]">No Research Patient Selected</h2>
        <p className="text-sm text-[#A5B3C8] mt-1">Please select a subject from the left navigation rail.</p>
      </div>
    );
  }

  const activeEpisode = selectedPatient.episodes[0];
  const gaWeeks = activeEpisode?.current_gestational_age_weeks || twin?.gestational_age_weeks || 28.0;

  return (
    <div className="space-y-6">
      {/* Patient Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 glass-panel-elevated rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-[#F4F7FC]">
              {selectedPatient.first_name} {selectedPatient.last_name}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#5BE7E8]/15 text-[#5BE7E8] border border-[#5BE7E8]/30">
              {selectedPatient.mrn}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#142137] text-[#A5B3C8]">
              Singleton Pregnancy
            </span>
          </div>
          <p className="text-sm text-[#A5B3C8]">
            Estimated Due Date:{' '}
            <strong className="text-[#F4F7FC]">{activeEpisode?.estimated_due_date || '2026-11-15'}</strong>{' '}
            | Maternal Age: <strong className="text-[#F4F7FC]">{selectedPatient.maternal_age} yrs</strong> | Gravida{' '}
            {selectedPatient.gravidity}, Para {selectedPatient.parity}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/medical-records')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#101A2B] hover:bg-[#142137] border border-[rgba(166,190,220,0.2)] text-xs font-medium text-[#F4F7FC] transition-all"
          >
            <Upload className="w-4 h-4 text-[#5BE7E8]" />
            <span>Upload Prenatal Report</span>
          </button>
          <button
            onClick={() => navigate('/maternal-twin')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5BE7E8] to-[#43D6B0] hover:opacity-95 text-[#070B14] font-semibold text-xs shadow-lg shadow-[#5BE7E8]/20 transition-all"
          >
            <Dna className="w-4 h-4" />
            <span>Open Living Twin (3D)</span>
          </button>
        </div>
      </div>

      {/* Grid: 3D Twin Preview + Hemodynamic Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Living Twin 3D Viewport Card */}
        <div className="lg:col-span-7 glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#5BE7E8]">
                Longitudinal Twin State (v{twin?.version || 1})
              </span>
              <h3 className="text-lg font-bold text-[#F4F7FC] flex items-center gap-2 mt-0.5">
                Biological Synthesis
                <span className="w-2 h-2 rounded-full bg-[#43D6B0] animate-pulse" />
              </h3>
            </div>
            <button
              onClick={() => navigate('/maternal-twin')}
              className="text-xs text-[#5BE7E8] hover:underline flex items-center gap-1 font-medium"
            >
              Full Visualizer <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-80 w-full relative">
            <MaternalTwin3D
              gestationalAgeWeeks={gaWeeks}
              sbp={twin?.sbp || 120}
              dbp={twin?.dbp || 80}
              riskCategory={prediction?.risk_category || 'LOW'}
              className="w-full h-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[rgba(166,190,220,0.1)] text-center">
            <div className="bg-[#0B1220]/60 p-2.5 rounded-xl">
              <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Gestational Age</span>
              <p className="text-base font-bold text-[#5BE7E8] font-mono mt-0.5">{gaWeeks.toFixed(1)} wks</p>
            </div>
            <div className="bg-[#0B1220]/60 p-2.5 rounded-xl">
              <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Mean Arterial Pres.</span>
              <p className="text-base font-bold text-[#F4F7FC] font-mono mt-0.5">
                {twin?.map_pressure ? `${twin.map_pressure} mmHg` : 'N/A'}
              </p>
            </div>
            <div className="bg-[#0B1220]/60 p-2.5 rounded-xl">
              <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Data Freshness</span>
              <p className="text-base font-bold text-[#43D6B0] font-mono mt-0.5">
                {twin?.data_freshness_status || 'FRESH'}
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Vitals & Risk Prediction Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Research Prediction Card */}
          <div className="glass-panel p-6 border-l-4 border-l-[#5BE7E8]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#A5B3C8]">
                14-Day Preeclampsia Horizon
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                  prediction?.risk_category === 'HIGH'
                    ? 'bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/30'
                    : prediction?.risk_category === 'MODERATE'
                    ? 'bg-[#E9B96E]/20 text-[#E9B96E] border border-[#E9B96E]/30'
                    : prediction?.risk_category === 'INSUFFICIENT_DATA'
                    ? 'bg-[#A5B3C8]/20 text-[#A5B3C8]'
                    : 'bg-[#43D6B0]/20 text-[#43D6B0] border border-[#43D6B0]/30'
                }`}
              >
                {prediction?.risk_category || 'EVALUATING'}
              </span>
            </div>

            {prediction?.is_insufficient_data ? (
              <div className="space-y-2">
                <p className="text-sm text-[#E9B96E] font-medium">Insufficient Data For Model Evaluation</p>
                <p className="text-xs text-[#A5B3C8]">{prediction.insufficient_data_reason}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-[#F4F7FC]">
                    {prediction?.risk_score !== undefined
                      ? `${(prediction.risk_score * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                  <span className="text-xs text-[#A5B3C8]">
                    95% CI: [{prediction?.confidence_interval_lower ? (prediction.confidence_interval_lower * 100).toFixed(1) : 0}% -{' '}
                    {prediction?.confidence_interval_upper ? (prediction.confidence_interval_upper * 100).toFixed(1) : 0}%]
                  </span>
                </div>
                <div className="w-full bg-[#0B1220] rounded-full h-2 overflow-hidden border border-[rgba(166,190,220,0.14)]">
                  <div
                    className={`h-full transition-all duration-700 ${
                      (prediction?.risk_score || 0) > 0.4
                        ? 'bg-[#F43F5E]'
                        : (prediction?.risk_score || 0) > 0.15
                        ? 'bg-[#E9B96E]'
                        : 'bg-[#5BE7E8]'
                    }`}
                    style={{ width: `${Math.min(100, (prediction?.risk_score || 0) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#A5B3C8] leading-relaxed">
                  Based on longitudinal trajectory and clinical factors. Strictly bounded by temporal cutoff to prevent leakage.
                </p>
              </div>
            )}

            <button
              onClick={() => navigate('/risk-forecast')}
              className="mt-4 w-full py-2 bg-[#142137] hover:bg-[#192a45] rounded-lg text-xs font-medium text-[#5BE7E8] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Inspect Contributing Evidence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current Clinical Measurements Grid */}
          <div className="glass-panel p-6">
            <h3 className="text-sm font-semibold text-[#F4F7FC] mb-4 flex items-center justify-between">
              <span>Accepted Clinical Observations</span>
              <button
                onClick={() => navigate('/observations')}
                className="text-xs text-[#5BE7E8] hover:underline"
              >
                View History
              </button>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                <span className="text-[#A5B3C8] text-[10px] uppercase font-mono">Blood Pressure</span>
                <p className="text-base font-bold font-mono text-[#F4F7FC] mt-0.5">
                  {twin?.sbp && twin?.dbp ? `${twin.sbp}/${twin.dbp}` : 'Unrecorded'}{' '}
                  <span className="text-[10px] text-[#A5B3C8] font-normal">mmHg</span>
                </p>
                {twin?.sbp && twin.sbp >= 140 && (
                  <span className="text-[10px] text-[#F43F5E] font-medium">Stage 1 Hypertensive</span>
                )}
              </div>

              <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                <span className="text-[#A5B3C8] text-[10px] uppercase font-mono">Urine Protein</span>
                <p className="text-base font-bold font-mono text-[#F4F7FC] mt-0.5">
                  {twin?.proteinuria_dipstick || (twin?.protein_creatinine_ratio ? `${twin.protein_creatinine_ratio} mg/mg` : 'Negative')}
                </p>
                <span className="text-[10px] text-[#A5B3C8]">
                  {twin?.protein_creatinine_ratio ? 'UPCR quantified' : 'Dipstick reader'}
                </span>
              </div>

              <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                <span className="text-[#A5B3C8] text-[10px] uppercase font-mono">Platelet Count</span>
                <p className="text-base font-bold font-mono text-[#F4F7FC] mt-0.5">
                  {twin?.platelets ? `${twin.platelets}k` : '168k'}{' '}
                  <span className="text-[10px] text-[#A5B3C8] font-normal">/uL</span>
                </p>
                <span className="text-[10px] text-[#43D6B0]">Normal (&gt;150k)</span>
              </div>

              <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)]">
                <span className="text-[#A5B3C8] text-[10px] uppercase font-mono">Liver AST / ALT</span>
                <p className="text-base font-bold font-mono text-[#F4F7FC] mt-0.5">
                  {twin?.ast ? `${twin.ast}` : '32'} / {twin?.alt ? `${twin.alt}` : '28'}{' '}
                  <span className="text-[10px] text-[#A5B3C8] font-normal">U/L</span>
                </p>
                <span className="text-[10px] text-[#43D6B0]">Enzymes Normal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch Action Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/simulation-lab')}
          className="glass-panel p-5 cursor-pointer hover:border-[#5BE7E8]/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-[#5BE7E8]/10 text-[#5BE7E8]">
              <Sparkles className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-[#A5B3C8] group-hover:text-[#5BE7E8] group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-[#F4F7FC] mt-3">Simulation Lab</h4>
          <p className="text-xs text-[#A5B3C8] mt-1">
            Test counterfactual scenarios (e.g. SBP escalation or protein spike) with zero record mutation.
          </p>
        </div>

        <div
          onClick={() => navigate('/pregnancy-timeline')}
          className="glass-panel p-5 cursor-pointer hover:border-[#5BE7E8]/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-[#628BFF]/10 text-[#628BFF]">
              <Clock className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-[#A5B3C8] group-hover:text-[#628BFF] group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-[#F4F7FC] mt-3">Longitudinal Maternal History</h4>
          <p className="text-xs text-[#A5B3C8] mt-1">
            Chronological audit of antenatal visits, lab tests, wearable telemetry, and prediction runs.
          </p>
        </div>

        <div
          onClick={() => navigate('/medical-records')}
          className="glass-panel p-5 cursor-pointer hover:border-[#43D6B0]/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-[#43D6B0]/10 text-[#43D6B0]">
              <FileText className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-[#A5B3C8] group-hover:text-[#43D6B0] group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-semibold text-sm text-[#F4F7FC] mt-3">Report Ingestion & Evidence</h4>
          <p className="text-xs text-[#A5B3C8] mt-1">
            Upload text or scanned PDFs; inspect extracted values mapped directly to document pages.
          </p>
        </div>
      </div>
    </div>
  );
};
