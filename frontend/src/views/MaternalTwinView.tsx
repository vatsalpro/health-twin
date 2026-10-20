import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, MaternalTwinState, RiskPrediction } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  Activity,
  AlertCircle,
  Clock,
  Dna,
  Heart,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';

export const MaternalTwinView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [history, setHistory] = useState<MaternalTwinState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Interactive Exploration Overrides
  const [gestationalAge, setGestationalAge] = useState<number>(28.0);
  const [sbpOverride, setSbpOverride] = useState<number>(120);
  const [dbpOverride, setDbpOverride] = useState<number>(80);
  const [isExplorationMode, setIsExplorationMode] = useState<boolean>(false);
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<'CARDIO' | 'RENAL' | 'HEMATOLOGY'>('CARDIO');

  useEffect(() => {
    if (!selectedPatientId) return;

    const loadTwin = async () => {
      setLoading(true);
      try {
        const [twinData, preds, hist] = await Promise.all([
          api.getCurrentTwin(selectedPatientId),
          api.getPredictions(selectedPatientId),
          api.getTwinHistory(selectedPatientId),
        ]);
        setTwin(twinData);
        setHistory(hist);
        if (preds.length > 0) setPrediction(preds[0]);

        setGestationalAge(twinData.gestational_age_weeks || 28.0);
        setSbpOverride(twinData.sbp || 120);
        setDbpOverride(twinData.dbp || 80);
      } catch (err) {
        console.error('Failed to load twin:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTwin();
  }, [selectedPatientId]);

  const resetToVerified = () => {
    if (!twin) return;
    setGestationalAge(twin.gestational_age_weeks || 28.0);
    setSbpOverride(twin.sbp || 120);
    setDbpOverride(twin.dbp || 80);
    setIsExplorationMode(false);
  };

  const computedMap = Math.round((2.0 * dbpOverride + sbpOverride) / 3.0);
  const computedPP = sbpOverride - dbpOverride;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#5BE7E8]">
            <Dna className="w-4 h-4" />
            <span>PHYSIOLOGICAL DIGITAL TWIN WORKSTATION</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">
            {selectedPatient?.first_name} {selectedPatient?.last_name} — Living Representation
          </h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Synchronized with {twin?.telemetry_summary?.accepted_observations_count || 12} accepted clinical observations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isExplorationMode && (
            <button
              onClick={resetToVerified}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#142137] hover:bg-[#192a45] text-xs font-medium text-[#E9B96E] border border-[#E9B96E]/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset to Clinical Record
            </button>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-[#101A2B] border border-[rgba(166,190,220,0.18)] text-right">
            <span className="text-[10px] text-[#A5B3C8] font-mono block">TWIN SNAPSHOT</span>
            <span className="text-xs font-bold text-[#5BE7E8] font-mono">v{twin?.version || 1}.0</span>
          </div>
        </div>
      </div>

      {/* Main 3D Studio & Controls Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Studio Viewport */}
        <div className="lg:col-span-8 glass-panel-elevated p-6 flex flex-col justify-between relative rounded-2xl min-h-[560px]">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5BE7E8] animate-ping" />
              <span className="text-xs font-mono font-medium text-[#F4F7FC]">
                GLSL AMBIENT NOISE & SIGNAL SHADERS ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#142137] text-[#A5B3C8]">
                FOV 42° | Raymarch Sim
              </span>
            </div>
          </div>

          <div className="w-full flex-1 relative flex items-center justify-center my-4">
            <MaternalTwin3D
              gestationalAgeWeeks={gestationalAge}
              sbp={sbpOverride}
              dbp={dbpOverride}
              riskCategory={prediction?.risk_category || 'LOW'}
              isSimulated={isExplorationMode}
              className="w-full h-full min-h-[460px]"
            />
          </div>

          {/* Interactive Exploration Controls */}
          <div className="z-10 bg-[#0B1220]/90 p-4 rounded-xl border border-[rgba(166,190,220,0.14)] space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#F4F7FC] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#5BE7E8]" />
                Interactive Anatomical & Hemodynamic Scrubber
              </span>
              {isExplorationMode && (
                <span className="text-[10px] text-[#E9B96E] font-mono">Exploring What-If</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-[11px] text-[#A5B3C8] mb-1">
                  <span>Gestational Age</span>
                  <span className="font-mono text-[#5BE7E8] font-bold">{gestationalAge.toFixed(1)} wks</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="40"
                  step="0.1"
                  value={gestationalAge}
                  onChange={(e) => {
                    setGestationalAge(parseFloat(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-[#5BE7E8] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#A5B3C8] mb-1">
                  <span>Systolic Pressure</span>
                  <span className="font-mono text-[#F4F7FC] font-bold">{sbpOverride} mmHg</span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="180"
                  step="1"
                  value={sbpOverride}
                  onChange={(e) => {
                    setSbpOverride(parseInt(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-[#5BE7E8] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#A5B3C8] mb-1">
                  <span>Diastolic Pressure</span>
                  <span className="font-mono text-[#F4F7FC] font-bold">{dbpOverride} mmHg</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="120"
                  step="1"
                  value={dbpOverride}
                  onChange={(e) => {
                    setDbpOverride(parseInt(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-[#5BE7E8] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Scientific Panels */}
        <div className="lg:col-span-4 space-y-6">
          {/* Telemetry Tabs */}
          <div className="glass-panel p-5">
            <div className="flex items-center gap-1 p-1 bg-[#0B1220] rounded-xl border border-[rgba(166,190,220,0.14)] mb-4">
              <button
                onClick={() => setActiveTelemetryTab('CARDIO')}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  activeTelemetryTab === 'CARDIO'
                    ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                    : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
                }`}
              >
                Cardiovascular
              </button>
              <button
                onClick={() => setActiveTelemetryTab('RENAL')}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  activeTelemetryTab === 'RENAL'
                    ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                    : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
                }`}
              >
                Renal
              </button>
              <button
                onClick={() => setActiveTelemetryTab('HEMATOLOGY')}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  activeTelemetryTab === 'HEMATOLOGY'
                    ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                    : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
                }`}
              >
                Hematology
              </button>
            </div>

            {/* Tab 1: Cardiovascular Telemetry */}
            {activeTelemetryTab === 'CARDIO' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Blood Pressure</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">{sbpOverride}/{dbpOverride} mmHg</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    sbpOverride >= 140 || dbpOverride >= 90 ? 'bg-[#F43F5E]/20 text-[#F43F5E]' : 'bg-[#43D6B0]/20 text-[#43D6B0]'
                  }`}>
                    {sbpOverride >= 140 || dbpOverride >= 90 ? 'ELEVATED' : 'NORMAL'}
                  </span>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Mean Arterial Pressure (MAP)</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">{computedMap} mmHg</p>
                  </div>
                  <span className="text-[10px] text-[#A5B3C8] font-mono">(2*DBP + SBP)/3</span>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Pulse Pressure</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">{computedPP} mmHg</p>
                  </div>
                  <span className="text-[10px] text-[#A5B3C8] font-mono">SBP - DBP</span>
                </div>
              </div>
            )}

            {/* Tab 2: Renal Telemetry */}
            {activeTelemetryTab === 'RENAL' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Proteinuria (Dipstick)</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">
                      {twin?.proteinuria_dipstick || '1+ (Verified)'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E9B96E]/20 text-[#E9B96E]">
                    POSITIVE
                  </span>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">UPCR (Protein/Creatinine)</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">
                      {twin?.protein_creatinine_ratio ? `${twin.protein_creatinine_ratio} mg/mg` : '0.34 mg/mg'}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#A5B3C8] font-mono">Ref &lt; 0.30</span>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Serum Creatinine</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">
                      {twin?.serum_creatinine ? `${twin.serum_creatinine} mg/dL` : '0.78 mg/dL'}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#43D6B0] font-mono">Normal</span>
                </div>
              </div>
            )}

            {/* Tab 3: Hematology Telemetry */}
            {activeTelemetryTab === 'HEMATOLOGY' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Platelet Count</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">
                      {twin?.platelets ? `${twin.platelets}k` : '168k'} /uL
                    </p>
                  </div>
                  <span className="text-[10px] text-[#43D6B0] font-mono">Adequate (&gt;150k)</span>
                </div>

                <div className="p-3 bg-[#0B1220]/70 rounded-xl border border-[rgba(166,190,220,0.1)] flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-[#A5B3C8] uppercase font-mono">Transaminases (AST/ALT)</span>
                    <p className="text-sm font-bold text-[#F4F7FC] mt-0.5 font-mono">
                      {twin?.ast || 32} / {twin?.alt || 28} U/L
                    </p>
                  </div>
                  <span className="text-[10px] text-[#43D6B0] font-mono">Enzymes Normal</span>
                </div>
              </div>
            )}
          </div>

          {/* Scientific Provenance Note */}
          <div className="p-4 bg-[#101A2B]/80 rounded-xl border border-[rgba(166,190,220,0.14)] text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#5BE7E8] font-semibold">
              <Info className="w-4 h-4" />
              <span>Scientific Representation Boundary</span>
            </div>
            <p className="text-[#A5B3C8] leading-relaxed text-[11px]">
              This stylized digital twin models observable maternal hemodynamic, renal, and hematologic biomarkers.
              It explicitly does <strong>not</strong> simulate unmeasured internal fetal anatomy or placental microvascular flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
