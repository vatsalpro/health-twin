import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, SimulationResult, RiskPrediction, MaternalTwinState } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  FlaskConical,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Sliders,
  TrendingUp,
  ArrowRight,
  Info,
} from 'lucide-react';

export const SimulationLabView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [baselinePred, setBaselinePred] = useState<RiskPrediction | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Scenario parameters
  const [ga, setGa] = useState<number>(31.4);
  const [sbp, setSbp] = useState<number>(142);
  const [dbp, setDbp] = useState<number>(92);
  const [proteinDipstick, setProteinDipstick] = useState<string>('1+');
  const [platelets, setPlatelets] = useState<number>(168);
  const [ast, setAst] = useState<number>(32);
  const [alt, setAlt] = useState<number>(28);
  const [creatinine, setCreatinine] = useState<number>(0.78);

  const loadBaseline = async () => {
    if (!selectedPatientId) return;
    try {
      const [twinData, preds] = await Promise.all([
        api.getCurrentTwin(selectedPatientId),
        api.getPredictions(selectedPatientId),
      ]);
      setTwin(twinData);
      const validPred = preds.find((p) => !p.is_insufficient_data);
      if (validPred) {
        setBaselinePred(validPred);
      }

      // Initialize sliders with patient's baseline
      setGa(twinData.gestational_age_weeks || 31.4);
      setSbp(twinData.sbp || 142);
      setDbp(twinData.dbp || 92);
      setProteinDipstick(twinData.proteinuria_dipstick || '1+');
      setPlatelets(twinData.platelets || 168);
      setAst(twinData.ast || 32);
      setAlt(twinData.alt || 28);
      setCreatinine(twinData.serum_creatinine || 0.78);

      // Run initial simulation matching baseline
      runSimulation({
        gestational_age_weeks: twinData.gestational_age_weeks || 31.4,
        sbp: twinData.sbp || 142,
        dbp: twinData.dbp || 92,
        proteinuria_dipstick: twinData.proteinuria_dipstick || '1+',
        platelets: twinData.platelets || 168,
        ast: twinData.ast || 32,
        alt: twinData.alt || 28,
        serum_creatinine: twinData.serum_creatinine || 0.78,
      });
    } catch (err) {
      console.error('Failed to load baseline for simulation:', err);
    }
  };

  useEffect(() => {
    loadBaseline();
  }, [selectedPatientId]);

  const runSimulation = async (customParams?: any) => {
    if (!selectedPatientId) return;
    setSimulating(true);
    setSimulationError(null);
    const payload = customParams || {
      gestational_age_weeks: ga,
      sbp: sbp,
      dbp: dbp,
      proteinuria_dipstick: proteinDipstick,
      platelets: platelets,
      ast: ast,
      alt: alt,
      serum_creatinine: creatinine,
    };
    try {
      const res = await api.simulateScenario(selectedPatientId, payload);
      setSimulationResult(res);
    } catch (err: any) {
      console.error('Simulation call failed:', err);
      const msg = err.response?.data?.detail || err.message || 'Counterfactual simulation failed.';
      setSimulationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSimulating(false);
    }
  };

  const resetToBaseline = () => {
    loadBaseline();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#E9B96E]">
            <Sparkles className="w-4 h-4" />
            <span>COUNTERFACTUAL RESEARCH SIMULATION LAB</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">What-If Hypothesis Exploration</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Evaluate how simulated physiological deviations affect model log-odds. Does not alter patient records.
          </p>
        </div>

        <button
          onClick={resetToBaseline}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#142137] hover:bg-[#192a45] text-xs font-medium text-[#A5B3C8] hover:text-[#F4F7FC] border border-[rgba(166,190,220,0.18)] transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Verified Baseline</span>
        </button>
      </div>

      {/* Non-Causal Research Disclaimer Callout */}
      <div className="p-4 rounded-xl bg-[#E9B96E]/10 border border-[#E9B96E]/30 text-xs text-[#E9B96E] flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider font-mono text-[11px] block">
            Non-Causal Counterfactual Disclaimer
          </span>
          <p className="text-[#F4F7FC] leading-relaxed text-[11px] mt-0.5">
            This module models mathematical associations within the multivariable research pipeline.
            Simulating reduced blood pressure or normal lab values does <strong>not</strong> infer clinical prevention or treatment efficacy.
          </p>
        </div>
      </div>

      {simulationError && (
        <div className="p-4 rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs text-[#F43F5E] flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider font-mono text-[11px] block">
              Simulation Notice
            </span>
            <p className="text-[#F4F7FC] leading-relaxed text-[11px] mt-0.5">
              {simulationError}
            </p>
          </div>
        </div>
      )}

      {/* Workspace: 3D Visualization + Sliders + Outcome Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Scenario Sliders */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-[rgba(166,190,220,0.1)] pb-3">
            <h3 className="text-sm font-bold text-[#F4F7FC] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#E9B96E]" />
              Hypothetical Clinical Assumptions
            </h3>
            <span className="text-[10px] font-mono text-[#A5B3C8]">Interactive Parameters</span>
          </div>

          {/* SBP Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#A5B3C8]">Systolic Blood Pressure</span>
              <span className="font-mono font-bold text-[#F4F7FC]">{sbp} mmHg</span>
            </div>
            <input
              type="range"
              min="100"
              max="180"
              value={sbp}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSbp(val);
                runSimulation({ gestational_age_weeks: ga, sbp: val, dbp, proteinuria_dipstick: proteinDipstick, platelets, ast, alt, serum_creatinine: creatinine });
              }}
              className="w-full accent-[#E9B96E] cursor-pointer"
            />
          </div>

          {/* DBP Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#A5B3C8]">Diastolic Blood Pressure</span>
              <span className="font-mono font-bold text-[#F4F7FC]">{dbp} mmHg</span>
            </div>
            <input
              type="range"
              min="60"
              max="120"
              value={dbp}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDbp(val);
                runSimulation({ gestational_age_weeks: ga, sbp, dbp: val, proteinuria_dipstick: proteinDipstick, platelets, ast, alt, serum_creatinine: creatinine });
              }}
              className="w-full accent-[#E9B96E] cursor-pointer"
            />
          </div>

          {/* Proteinuria Dipstick */}
          <div>
            <label className="text-xs text-[#A5B3C8] block mb-1.5">Proteinuria Dipstick Grade</label>
            <div className="grid grid-cols-4 gap-2">
              {['Negative', 'Trace', '1+', '2+'].map((grade) => (
                <button
                  key={grade}
                  onClick={() => {
                    setProteinDipstick(grade);
                    runSimulation({ gestational_age_weeks: ga, sbp, dbp, proteinuria_dipstick: grade, platelets, ast, alt, serum_creatinine: creatinine });
                  }}
                  className={`py-1.5 text-xs font-mono font-medium rounded-lg border transition-all ${
                    proteinDipstick === grade
                      ? 'bg-[#E9B96E]/20 text-[#E9B96E] border-[#E9B96E]'
                      : 'bg-[#0B1220] border-[rgba(166,190,220,0.14)] text-[#A5B3C8] hover:text-[#F4F7FC]'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Platelets Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#A5B3C8]">Platelet Count</span>
              <span className="font-mono font-bold text-[#F4F7FC]">{platelets} x10^3/uL</span>
            </div>
            <input
              type="range"
              min="80"
              max="280"
              value={platelets}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setPlatelets(val);
                runSimulation({ gestational_age_weeks: ga, sbp, dbp, proteinuria_dipstick: proteinDipstick, platelets: val, ast, alt, serum_creatinine: creatinine });
              }}
              className="w-full accent-[#E9B96E] cursor-pointer"
            />
          </div>

          {/* Transaminases AST */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#A5B3C8]">Liver AST Transaminase</span>
              <span className="font-mono font-bold text-[#F4F7FC]">{ast} U/L</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              value={ast}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setAst(val);
                runSimulation({ gestational_age_weeks: ga, sbp, dbp, proteinuria_dipstick: proteinDipstick, platelets, ast: val, alt, serum_creatinine: creatinine });
              }}
              className="w-full accent-[#E9B96E] cursor-pointer"
            />
          </div>
        </div>

        {/* Right Column: Comparative Outcome & 3D Simulation Response */}
        <div className="lg:col-span-7 space-y-6">
          {/* Side-by-Side Baseline vs Simulated Risk Card */}
          <div className="glass-panel-elevated p-6 rounded-2xl space-y-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#E9B96E]">
              Counterfactual Risk Comparison (14-Day Horizon)
            </span>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-[#0B1220]/80 rounded-xl border border-[rgba(166,190,220,0.1)]">
                <span className="text-[10px] text-[#A5B3C8] uppercase font-mono block">Baseline Verified Risk</span>
                <p className="text-3xl font-extrabold font-mono text-[#A5B3C8] mt-1">
                  {baselinePred?.risk_score !== undefined
                    ? `${(baselinePred.risk_score * 100).toFixed(1)}%`
                    : '12.0%'}
                </p>
                <span className="text-[10px] font-mono text-[#43D6B0] mt-1 block">
                  {baselinePred?.risk_category || 'LOW RISK'}
                </span>
              </div>

              <div className="p-4 bg-[#142137] rounded-xl border border-[#E9B96E]/30 relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <Sparkles className="w-4 h-4 text-[#E9B96E] animate-pulse" />
                </div>
                <span className="text-[10px] text-[#E9B96E] uppercase font-mono block">Simulated Scenario Risk</span>
                <p className="text-3xl font-extrabold font-mono text-[#F4F7FC] mt-1">
                  {simulationResult
                    ? `${(simulationResult.simulated_risk_score * 100).toFixed(1)}%`
                    : '...'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono font-bold text-[#E9B96E]">
                    {simulationResult?.simulated_risk_category}
                  </span>
                  {simulationResult?.delta_risk_score !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        simulationResult.delta_risk_score > 0
                          ? 'bg-[#F43F5E]/20 text-[#F43F5E]'
                          : simulationResult.delta_risk_score < 0
                          ? 'bg-[#43D6B0]/20 text-[#43D6B0]'
                          : 'bg-[#A5B3C8]/20 text-[#A5B3C8]'
                      }`}
                    >
                      {simulationResult.delta_risk_score > 0 ? '+' : ''}
                      {(simulationResult.delta_risk_score * 100).toFixed(1)}% Δ
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Simulated 3D Maternal Twin Representation */}
            <div className="h-64 w-full bg-[#070B14]/70 rounded-xl border border-[rgba(166,190,220,0.12)] relative overflow-hidden flex items-center justify-center">
              <MaternalTwin3D
                gestationalAgeWeeks={ga}
                sbp={sbp}
                dbp={dbp}
                riskCategory={simulationResult?.simulated_risk_category as any || 'LOW'}
                isSimulated={true}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
