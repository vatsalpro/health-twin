import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, SimulationResult, RiskPrediction, MaternalTwinState, SimulationScenario } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Sliders,
  TrendingUp,
  Save,
  Download,
  Trash2,
  Heart,
  Activity,
  Clock,
  Apple,
  Moon,
  Radio,
  Calendar,
  Baby,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';

type SimulationCategory =
  | 'cardiovascular'
  | 'preeclampsia_risk'
  | 'gestational_timeline'
  | 'metabolic_health'
  | 'sleep_stress'
  | 'sensor_reliability'
  | 'monitoring_schedule'
  | 'postpartum';

interface CategoryConfig {
  id: SimulationCategory;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'cardiovascular', name: 'Cardiovascular Dynamics', tagline: 'MAP, pulse pressure & arterial compliance', icon: Heart },
  { id: 'preeclampsia_risk', name: 'Preeclampsia Risk Explorer', tagline: 'Multi-marker interaction & risk projection', icon: TrendingUp },
  { id: 'gestational_timeline', name: 'Gestational Projections', tagline: 'Longitudinal trimester trajectory', icon: Clock },
  { id: 'metabolic_health', name: 'Metabolic & Glycemia', tagline: 'Fasting vs postprandial excursions', icon: Apple },
  { id: 'sleep_stress', name: 'Sleep & Autonomic Tone', tagline: 'HRV and nocturnal dipping balance', icon: Moon },
  { id: 'sensor_reliability', name: 'Sensor Noise & Packet Loss', tagline: 'Telemetry uncertainty intervals', icon: Radio },
  { id: 'monitoring_schedule', name: 'Monitoring Cadence', tagline: 'HBPM frequency & detection latency', icon: Calendar },
  { id: 'postpartum', name: 'Postpartum Recovery', tagline: 'Post-delivery hemodynamic rebound curve', icon: Baby },
];

export const SimulationLabView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [baselinePred, setBaselinePred] = useState<RiskPrediction | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Active Category
  const [activeCategory, setActiveCategory] = useState<SimulationCategory>('cardiovascular');

  // Baseline Mode (Verified vs Hypothetical)
  const [useHypotheticalBaseline, setUseHypotheticalBaseline] = useState<boolean>(false);

  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<SimulationScenario[]>([]);
  const [scenarioNameInput, setScenarioNameInput] = useState<string>('');
  const [isSavingScenario, setIsSavingScenario] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // --- Category Parameters (Editable directly by user) ---
  // Category A: Cardiovascular
  const [sbp, setSbp] = useState<number>(140);
  const [dbp, setDbp] = useState<number>(90);
  const [heartRate, setHeartRate] = useState<number>(78);
  const [bpFreq, setBpFreq] = useState<number>(2);
  const [variabilitySigma, setVariabilitySigma] = useState<number>(4);
  const [missingPct, setMissingPct] = useState<number>(5);

  // Category B: Preeclampsia Risk
  const [ga, setGa] = useState<number>(30.0);
  const [proteinDipstick, setProteinDipstick] = useState<string>('1+');
  const [platelets, setPlatelets] = useState<number>(168);
  const [ast, setAst] = useState<number>(32);
  const [alt, setAlt] = useState<number>(28);
  const [creatinine, setCreatinine] = useState<number>(0.78);

  // Category C: Gestational Timeline
  const [targetGa, setTargetGa] = useState<number>(38.0);
  const [sbpSlope, setSbpSlope] = useState<number>(0.6);
  const [dbpSlope, setDbpSlope] = useState<number>(0.4);

  // Category D: Metabolic Health
  const [fastingGlucose, setFastingGlucose] = useState<number>(92);
  const [postMealGlucose, setPostMealGlucose] = useState<number>(134);
  const [glucoseUnit, setGlucoseUnit] = useState<string>('mg/dL');
  const [maternalWeight, setMaternalWeight] = useState<number>(68.5);

  // Category E: Sleep & Stress
  const [sleepHours, setSleepHours] = useState<number>(7.2);
  const [sleepRegIdx, setSleepRegIdx] = useState<number>(80);
  const [dailySteps, setDailySteps] = useState<number>(6800);
  const [hrvRmssd, setHrvRmssd] = useState<number>(38);
  const [stressScale, setStressScale] = useState<number>(4);

  // Category F: Sensor Reliability
  const [missingPacketRate, setMissingPacketRate] = useState<number>(8);
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [duplicateRate, setDuplicateRate] = useState<number>(2);
  const [noiseSigma, setNoiseSigma] = useState<number>(3.5);
  const [disconnectHours, setDisconnectHours] = useState<number>(0);

  // Category G: Monitoring Schedule
  const [selectedProtocol, setSelectedProtocol] = useState<string>('manual_daily');
  const [monitoringDays, setMonitoringDays] = useState<number>(14);

  // Category H: Postpartum
  const [postpartumDay, setPostpartumDay] = useState<number>(4);
  const [deliveryType, setDeliveryType] = useState<string>('vaginal');
  const [postpartumSbp, setPostpartumSbp] = useState<number>(136);
  const [postpartumDbp, setPostpartumDbp] = useState<number>(86);
  const [postpartumSymptoms, setPostpartumSymptoms] = useState<string[]>([]);

  // Active Patient Baseline Anchor
  const patientBaselineGA = useMemo(() => {
    return (
      selectedPatient?.episodes?.[0]?.current_gestational_age_weeks ??
      twin?.gestational_age_weeks ??
      31.4
    );
  }, [selectedPatient, twin]);

  const patientBaselineSbp = useMemo(() => {
    return twin?.sbp ?? (useHypotheticalBaseline ? 120 : 120);
  }, [twin, useHypotheticalBaseline]);

  const patientBaselineDbp = useMemo(() => {
    return twin?.dbp ?? (useHypotheticalBaseline ? 80 : 80);
  }, [twin, useHypotheticalBaseline]);

  const patientBaselineHr = 72;

  // Effective Simulated Telemetry for 3D Twin & Visual Metrics
  const { effectiveGA, effectiveSbp, effectiveDbp, effectiveMap, effectivePp } = useMemo(() => {
    let gaVal = patientBaselineGA;
    let sbpVal = sbp;
    let dbpVal = dbp;

    if (activeCategory === 'cardiovascular') {
      gaVal = patientBaselineGA;
      sbpVal = sbp;
      dbpVal = dbp;
    } else if (activeCategory === 'preeclampsia_risk') {
      gaVal = ga;
      sbpVal = sbp;
      dbpVal = dbp;
    } else if (activeCategory === 'gestational_timeline') {
      gaVal = targetGa;
      // Deterministic hemodynamic projection at target gestational age
      const weeksDelta = Math.max(0, targetGa - patientBaselineGA);
      sbpVal = Math.round(patientBaselineSbp + sbpSlope * weeksDelta);
      dbpVal = Math.round(patientBaselineDbp + dbpSlope * weeksDelta);
    } else if (activeCategory === 'postpartum') {
      gaVal = 40.0; // Postpartum reference anatomical state
      sbpVal = postpartumSbp;
      dbpVal = postpartumDbp;
    } else {
      // metabolic_health, sleep_stress, sensor_reliability, monitoring_schedule
      gaVal = patientBaselineGA;
      sbpVal = patientBaselineSbp;
      dbpVal = patientBaselineDbp;
    }

    const mapVal = Math.round((dbpVal + (sbpVal - dbpVal) / 3) * 10) / 10;
    const ppVal = Math.round(sbpVal - dbpVal);

    return {
      effectiveGA: gaVal,
      effectiveSbp: sbpVal,
      effectiveDbp: dbpVal,
      effectiveMap: mapVal,
      effectivePp: ppVal,
    };
  }, [
    activeCategory,
    patientBaselineGA,
    patientBaselineSbp,
    patientBaselineDbp,
    ga,
    sbp,
    dbp,
    targetGa,
    sbpSlope,
    dbpSlope,
    postpartumSbp,
    postpartumDbp,
  ]);

  // Category-specific Validation Checks (Never silently mutate user entries)
  const getValidationErrorsForCategory = useCallback(
    (cat: SimulationCategory): string[] => {
      const errors: string[] = [];
      if (cat === 'cardiovascular' || cat === 'preeclampsia_risk') {
        if (sbp <= dbp) {
          errors.push(`Systolic blood pressure (${sbp} mmHg) must be strictly greater than diastolic blood pressure (${dbp} mmHg).`);
        }
        if (sbp < 70 || sbp > 240) {
          errors.push(`Systolic BP (${sbp} mmHg) outside physiological safety window (70–240 mmHg).`);
        }
        if (dbp < 40 || dbp > 160) {
          errors.push(`Diastolic BP (${dbp} mmHg) outside physiological safety window (40–160 mmHg).`);
        }
      } else if (cat === 'postpartum') {
        if (postpartumSbp <= postpartumDbp) {
          errors.push(`Postpartum systolic BP (${postpartumSbp} mmHg) must be strictly greater than diastolic BP (${postpartumDbp} mmHg).`);
        }
        if (postpartumSbp < 70 || postpartumSbp > 240) {
          errors.push(`Postpartum systolic BP (${postpartumSbp} mmHg) outside safety window (70–240 mmHg).`);
        }
        if (postpartumDbp < 40 || postpartumDbp > 160) {
          errors.push(`Postpartum diastolic BP (${postpartumDbp} mmHg) outside safety window (40–160 mmHg).`);
        }
      } else if (cat === 'gestational_timeline') {
        if (targetGa <= patientBaselineGA) {
          errors.push(`Target gestational age (${targetGa} wks) must be greater than current week (${patientBaselineGA.toFixed(1)} wks).`);
        }
      }
      return errors;
    },
    [sbp, dbp, postpartumSbp, postpartumDbp, targetGa, patientBaselineGA]
  );

  const validationErrors = useMemo(
    () => getValidationErrorsForCategory(activeCategory),
    [getValidationErrorsForCategory, activeCategory]
  );

  const isValidInput = validationErrors.length === 0;

  // Execute Simulation
  const executeSimulation = useCallback(async (cat: SimulationCategory, customPayload?: any) => {
    if (!selectedPatientId) return;

    // Check validation specifically for the category being simulated
    const catErrors = getValidationErrorsForCategory(cat);
    if (!customPayload && catErrors.length > 0) {
      setSimulationError(catErrors[0]);
      return;
    }

    setSimulating(true);
    setSimulationError(null);

    let payload: Record<string, any> = { category: cat };

    if (customPayload) {
      payload = { ...customPayload, category: cat };
    } else if (cat === 'cardiovascular') {
      payload = {
        category: 'cardiovascular',
        sbp,
        dbp,
        baseline_sbp: patientBaselineSbp,
        baseline_dbp: patientBaselineDbp,
        baseline_hr: patientBaselineHr,
        heart_rate: heartRate,
        frequency_per_day: bpFreq,
        variability_sigma: variabilitySigma,
        missing_pct: missingPct,
      };
    } else if (cat === 'preeclampsia_risk') {
      payload = {
        category: 'preeclampsia_risk',
        gestational_age_weeks: ga,
        sbp,
        dbp,
        proteinuria_dipstick: proteinDipstick,
        platelets,
        ast,
        alt,
        serum_creatinine: creatinine,
        allow_uncalibrated_baseline: useHypotheticalBaseline,
      };
    } else if (cat === 'gestational_timeline') {
      payload = {
        category: 'gestational_timeline',
        current_ga_weeks: patientBaselineGA,
        target_ga_weeks: targetGa,
        baseline_sbp: patientBaselineSbp,
        baseline_dbp: patientBaselineDbp,
        sbp_slope: sbpSlope,
        dbp_slope: dbpSlope,
      };
    } else if (cat === 'metabolic_health') {
      payload = {
        category: 'metabolic_health',
        fasting_glucose: fastingGlucose,
        post_meal_glucose: postMealGlucose,
        unit: glucoseUnit,
        weight_kg: maternalWeight,
      };
    } else if (cat === 'sleep_stress') {
      payload = {
        category: 'sleep_stress',
        sleep_hours: sleepHours,
        sleep_regularity_idx: sleepRegIdx,
        daily_steps: dailySteps,
        resting_hr: 72,
        hrv_rmssd_ms: hrvRmssd,
        stress_scale: stressScale,
      };
    } else if (cat === 'sensor_reliability') {
      payload = {
        category: 'sensor_reliability',
        missing_packet_pct: missingPacketRate,
        transmission_delay_min: delayMinutes,
        duplicate_rate_pct: duplicateRate,
        sensor_noise_sigma: noiseSigma,
        device_disconnect_hours: disconnectHours,
      };
    } else if (cat === 'monitoring_schedule') {
      payload = {
        category: 'monitoring_schedule',
        protocol: selectedProtocol,
        monitoring_days: monitoringDays,
      };
    } else if (cat === 'postpartum') {
      payload = {
        category: 'postpartum',
        postpartum_day: postpartumDay,
        delivery_type: deliveryType,
        postpartum_sbp: postpartumSbp,
        postpartum_dbp: postpartumDbp,
        symptoms: postpartumSymptoms,
      };
    }

    try {
      const res = await api.simulateScenario(selectedPatientId, payload);
      setSimulationResult(res);
    } catch (err: any) {
      console.error('Simulation execution failed:', err);
      const msg = err.response?.data?.detail || err.message || 'Simulation execution failed.';
      setSimulationError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSimulating(false);
    }
  }, [
    selectedPatientId,
    getValidationErrorsForCategory,
    sbp,
    dbp,
    patientBaselineSbp,
    patientBaselineDbp,
    patientBaselineHr,
    patientBaselineGA,
    useHypotheticalBaseline,
    heartRate,
    bpFreq,
    variabilitySigma,
    missingPct,
    ga,
    proteinDipstick,
    platelets,
    ast,
    alt,
    creatinine,
    targetGa,
    sbpSlope,
    dbpSlope,
    fastingGlucose,
    postMealGlucose,
    glucoseUnit,
    maternalWeight,
    sleepHours,
    sleepRegIdx,
    dailySteps,
    hrvRmssd,
    stressScale,
    missingPacketRate,
    delayMinutes,
    duplicateRate,
    noiseSigma,
    disconnectHours,
    selectedProtocol,
    monitoringDays,
    postpartumDay,
    deliveryType,
    postpartumSbp,
    postpartumDbp,
    postpartumSymptoms
  ]);

  // Load Baseline Data Truthfully
  const loadBaseline = useCallback(async () => {
    if (!selectedPatientId) return;
    try {
      const [twinData, preds, scenarios] = await Promise.all([
        api.getCurrentTwin(selectedPatientId),
        api.getPredictions(selectedPatientId),
        api.getScenarios(selectedPatientId),
      ]);
      setTwin(twinData);
      setSavedScenarios(scenarios || []);
      const validPred = preds.find((p) => !p.is_insufficient_data);
      if (validPred) {
        setBaselinePred(validPred);
      } else {
        setBaselinePred(null);
      }

      // Initialize inputs from patient's true baseline if recorded
      if (twinData.sbp && twinData.dbp) {
        setSbp(twinData.sbp);
        setDbp(twinData.dbp);
      } else {
        // Clear or indicate hypothetical
        setSbp(120);
        setDbp(80);
      }

      const activeGA =
        selectedPatient?.episodes?.[0]?.current_gestational_age_weeks ??
        twinData.gestational_age_weeks ??
        31.4;
      setGa(activeGA);
      setTargetGa(Math.min(41, Math.max(Math.ceil(activeGA) + 1, 38.0)));

      if (twinData.proteinuria_dipstick) {
        setProteinDipstick(twinData.proteinuria_dipstick);
      }
      if (twinData.platelets) {
        setPlatelets(twinData.platelets);
      }
      if (twinData.ast) setAst(twinData.ast);
      if (twinData.alt) setAlt(twinData.alt);
      if (twinData.serum_creatinine) setCreatinine(twinData.serum_creatinine);

      // Execute initial run
      executeSimulation(activeCategory);
    } catch (err) {
      console.error('Failed to load baseline for simulation:', err);
    }
  }, [selectedPatientId, selectedPatient, activeCategory, executeSimulation]);

  useEffect(() => {
    loadBaseline();
  }, [selectedPatientId]);

  // Reset to verified patient baseline
  const handleResetToBaseline = () => {
    setSbp(patientBaselineSbp);
    setDbp(patientBaselineDbp);
    setGa(patientBaselineGA);
    setTargetGa(Math.min(41, Math.max(Math.ceil(patientBaselineGA) + 1, 38.0)));
    setUseHypotheticalBaseline(false);
    executeSimulation(activeCategory);
  };

  // Save Scenario
  const handleSaveScenario = async () => {
    if (!selectedPatientId || !simulationResult || !scenarioNameInput.trim()) return;
    setIsSavingScenario(true);
    try {
      const saved = await api.saveScenario(selectedPatientId, {
        name: scenarioNameInput.trim(),
        category: activeCategory,
        parameters: { sbp, dbp, heartRate, ga, proteinDipstick, platelets },
        results: simulationResult,
      });
      setSavedScenarios([saved, ...savedScenarios]);
      setShowSaveModal(false);
      setScenarioNameInput('');
      setSaveSuccessMsg(`Scenario '${saved.name}' saved successfully.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save scenario.');
    } finally {
      setIsSavingScenario(false);
    }
  };

  // Export Scenarios
  const handleExport = async (format: 'csv' | 'json') => {
    if (!selectedPatientId) return;

    // Case 1: If saved scenarios exist, download the latest scenario using authenticated API client
    if (savedScenarios.length > 0) {
      try {
        await api.downloadScenarioExport(selectedPatientId, savedScenarios[0].id, format);
        return;
      } catch (err: any) {
        console.warn('API scenario download error, falling back to local simulation export:', err);
      }
    }

    // Case 2: If there is an active simulation result on screen, export it directly to CSV or JSON
    if (simulationResult) {
      if (format === 'json') {
        const data = {
          export_type: 'Active Counterfactual Simulation',
          patient_id: selectedPatientId,
          timestamp: new Date().toISOString(),
          category: activeCategory,
          parameters: { sbp, dbp, heartRate, ga, proteinDipstick, platelets },
          results: simulationResult,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation_${activeCategory}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }

      // Format CSV
      const rows: string[][] = [
        ['Section', 'Field', 'Value'],
        ['Metadata', 'Export Type', 'Active Counterfactual Simulation'],
        ['Metadata', 'Category', activeCategory],
        ['Metadata', 'Patient ID', selectedPatientId],
        ['Metadata', 'Timestamp', new Date().toISOString()],
        ['Parameter', 'Systolic BP (mmHg)', sbp.toString()],
        ['Parameter', 'Diastolic BP (mmHg)', dbp.toString()],
        ['Parameter', 'Heart Rate (bpm)', heartRate.toString()],
        ['Parameter', 'Gestational Age (weeks)', ga.toString()],
        ['Parameter', 'Proteinuria Dipstick', proteinDipstick],
        ['Parameter', 'Platelets (x10^3/uL)', platelets.toString()],
        ['Result', 'Scenario Label', simulationResult.scenario_label || 'Active Simulation'],
        ['Result', 'Simulated Risk Score', simulationResult.simulated_risk_score !== undefined ? `${(simulationResult.simulated_risk_score * 100).toFixed(1)}%` : 'N/A'],
        ['Result', 'Risk Category', simulationResult.simulated_risk_category || 'N/A'],
        ['Result', 'Delta Risk from Baseline', simulationResult.delta_risk_score !== undefined ? `${(simulationResult.delta_risk_score * 100).toFixed(1)}%` : 'N/A'],
        ['Disclaimer', 'Notice', 'Counterfactual simulation only. Not a causal treatment recommendation.'],
      ];

      const csvContent = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation_${activeCategory}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }

    alert('No active simulation results or saved scenarios to export. Please run a simulation first.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 uppercase tracking-wide">
            <Sparkles className="w-4 h-4" />
            <span>Advanced Maternal Digital Twin Simulation Lab</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Counterfactual Physiological Modeling
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Evaluate hypothetical hemodynamics and multivariable risks without altering patient medical records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToBaseline}
            title="Reset parameters to verified patient baseline"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>Reset Baseline</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            disabled={!simulationResult}
          >
            <Save className="w-4 h-4 text-white" />
            <span>Save Scenario</span>
          </Button>
        </div>
      </div>

      {/* Safety Notice */}
      <Alert type="info" title="Research Simulation Safety Disclaimer">
        All projections generated in this lab are counterfactual research estimates. 
        Adjusting parameter sliders does <strong>NOT</strong> modify actual clinical records, and simulated outcomes do not infer direct therapeutic efficacy.
      </Alert>

      {saveSuccessMsg && (
        <Alert type="success">{saveSuccessMsg}</Alert>
      )}

      {/* Desktop 3-Column Layout: Left (Categories & Saved) | Center (Results & Twin) | Right (Controls) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Scenario Categories & Saved Library (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Categories Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Simulation Domains</CardTitle>
            </CardHeader>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setSimulationError(null);
                      executeSimulation(cat.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-start gap-2.5 ${
                      isActive
                        ? 'bg-sky-50 text-sky-900 border-l-4 border-sky-600 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-sky-700' : 'text-slate-400'}`} />
                    <div>
                      <p className="leading-snug">{cat.name}</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">{cat.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Saved Scenarios Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Saved Scenarios ({savedScenarios.length})</CardTitle>
            </CardHeader>
            {savedScenarios.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No saved research scenarios yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {savedScenarios.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white transition-all text-xs flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 truncate">{sc.name}</p>
                      <span className="text-[10px] text-slate-500 capitalize">{sc.category.replace('_', ' ')}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete scenario '${sc.name}'?`)) {
                          await api.deleteScenario(selectedPatientId!, sc.id);
                          setSavedScenarios(savedScenarios.filter((s) => s.id !== sc.id));
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Delete scenario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* CENTER COLUMN: Visualization, Baseline Comparison & Outcomes (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Baseline Verification Status Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Baseline Anchor</span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">
                {twin?.sbp && twin?.dbp ? (
                  <span className="text-emerald-700">Verified Clinical Baseline ({twin.sbp}/{twin.dbp} mmHg)</span>
                ) : (
                  <span className="text-amber-700">Hypothetical Baseline Active (120/80 mmHg)</span>
                )}
              </p>
            </div>
            {!twin?.sbp && (
              <Badge variant="warning">HYPOTHETICAL</Badge>
            )}
          </div>

          {/* Outcome Summary Card */}
          <Card className="border-l-4 border-l-sky-600">
            <CardHeader>
              <div>
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Simulation Outcome</span>
                <CardTitle className="mt-0.5">
                  {simulationResult?.scenario_label || 'Projected Physiological State'}
                </CardTitle>
              </div>
              {simulationResult && (
                <Badge
                  variant={
                    simulationResult.simulated_risk_category === 'HIGH'
                      ? 'danger'
                      : simulationResult.simulated_risk_category === 'MODERATE'
                      ? 'warning'
                      : 'success'
                  }
                  className="font-bold uppercase"
                >
                  {simulationResult.simulated_risk_category} RISK
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                {activeCategory === 'cardiovascular' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">MAP / Pulse Pres.</span>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {effectiveMap.toFixed(1)} / {effectivePp} <span className="text-xs font-normal text-slate-500">mmHg</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Pulse Pres: {effectivePp} mmHg
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Myocardial Workload</span>
                      <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {Math.round((sbp * heartRate) / 100)} <span className="text-xs font-normal text-slate-500">RPP</span>
                      </p>
                      <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
                        HR: {heartRate} bpm
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'preeclampsia_risk' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Simulated Risk</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {simulationResult ? `${(simulationResult.simulated_risk_score * 100).toFixed(1)}%` : '—'}
                      </p>
                      {simulationResult && (
                        <span className={`text-[10px] font-semibold ${simulationResult.delta_risk_score > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {simulationResult.delta_risk_score > 0 ? '+' : ''}{(simulationResult.delta_risk_score * 100).toFixed(1)}% vs baseline
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">MAP / Pulse Pres.</span>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {effectiveMap.toFixed(1)} / {effectivePp} <span className="text-xs font-normal text-slate-500">mmHg</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        GA: {ga.toFixed(1)}w • Dipstick: {proteinDipstick}
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'gestational_timeline' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Target Horizon</span>
                      <p className="text-2xl font-extrabold font-mono text-sky-900 mt-0.5">
                        {targetGa.toFixed(1)} <span className="text-xs font-normal text-slate-500">wks</span>
                      </p>
                      <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
                        +{Math.max(0, targetGa - patientBaselineGA).toFixed(1)}w trajectory
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Projected Hemodynamics</span>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {effectiveSbp}/{effectiveDbp} <span className="text-xs font-normal text-slate-500">mmHg</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Slope: +{sbpSlope}/+{dbpSlope} mmHg/wk
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'metabolic_health' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Fasting Glycemia</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {fastingGlucose} <span className="text-xs font-normal text-slate-500">{glucoseUnit}</span>
                      </p>
                      <span className={`text-[10px] font-semibold ${fastingGlucose < 95 ? 'text-emerald-600' : fastingGlucose < 105 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {fastingGlucose < 95 ? 'Normal Target' : fastingGlucose < 105 ? 'Borderline' : 'Elevated'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Postprandial Excursion</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        +{postMealGlucose - fastingGlucose} <span className="text-xs font-normal text-slate-500">{glucoseUnit}</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Post-meal: {postMealGlucose} {glucoseUnit}
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'sleep_stress' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Sleep Adequacy</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {sleepHours} <span className="text-xs font-normal text-slate-500">hrs</span>
                      </p>
                      <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
                        Regularity: {sleepRegIdx}% • Steps: {dailySteps}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Autonomic Tone (HRV)</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {hrvRmssd} <span className="text-xs font-normal text-slate-500">ms</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Stress Index: {stressScale}/10
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'sensor_reliability' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Telemetry Quality</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {simulationResult?.detailed_results?.impact_metrics?.trend_reliability_score !== undefined
                          ? `${simulationResult.detailed_results.impact_metrics.trend_reliability_score}%`
                          : `${Math.max(5, 100 - missingPacketRate * 1.5).toFixed(0)}%`}
                      </p>
                      <span className={`text-[10px] font-semibold ${
                        (simulationResult?.detailed_results?.impact_metrics?.reliability_category === 'UNRELIABLE_DEGRADED' || missingPacketRate > 20)
                          ? 'text-rose-600'
                          : (simulationResult?.detailed_results?.impact_metrics?.reliability_category === 'ACCEPTABLE' || missingPacketRate > 8)
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}>
                        {simulationResult?.detailed_results?.impact_metrics?.reliability_category?.replace('_', ' ') || 'ACTIVE STREAM'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Data Completeness</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {simulationResult?.detailed_results?.impact_metrics?.effective_completeness_pct !== undefined
                          ? `${simulationResult.detailed_results.impact_metrics.effective_completeness_pct}%`
                          : `${Math.max(0, 100 - missingPacketRate)}%`}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Loss: {missingPacketRate}% • Latency: {delayMinutes}m
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'monitoring_schedule' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Monitoring Cadence</span>
                      <p className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {simulationResult?.detailed_results?.protocol_details?.readings_per_day ?? 1}x <span className="text-xs font-normal text-slate-500">/ day</span>
                      </p>
                      <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
                        {simulationResult?.detailed_results?.protocol_details?.name ?? 'Standard Cuff'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Telemetry Coverage</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        {simulationResult?.detailed_results?.protocol_details?.coverage_pct ?? 35}%
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Detection Latency: ~{simulationResult?.detailed_results?.protocol_details?.detection_delay_hours ?? 18}h
                      </span>
                    </div>
                  </>
                )}

                {activeCategory === 'postpartum' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Postpartum Horizon</span>
                      <p className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5">
                        Day {postpartumDay}
                      </p>
                      <span className="text-[10px] text-sky-700 font-semibold block mt-0.5 uppercase">
                        {deliveryType} delivery
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Hemodynamics</span>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {postpartumSbp}/{postpartumDbp} <span className="text-xs font-normal text-slate-500">mmHg</span>
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        MAP: {(postpartumDbp + (postpartumSbp - postpartumDbp) / 3).toFixed(1)} mmHg
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* 3D Anatomical Twin Canvas */}
              <div className="h-64 w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative">
                <MaternalTwin3D
                  gestationalAgeWeeks={effectiveGA}
                  sbp={effectiveSbp}
                  dbp={effectiveDbp}
                  riskCategory={simulationResult?.simulated_risk_category as any || 'LOW'}
                  isSimulated={true}
                  className="w-full h-full"
                />
              </div>

              {/* A. CARDIOVASCULAR DETAILS */}
              {activeCategory === 'cardiovascular' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Heart className="w-4 h-4 text-rose-600" />
                      Hemodynamic Indices & Vascular Compliance
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sbp >= 160 || dbp >= 110 ? 'bg-rose-100 text-rose-800' : sbp >= 140 || dbp >= 90 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {sbp >= 160 || dbp >= 110 ? 'SEVERE HTN' : sbp >= 140 || dbp >= 90 ? 'STAGE 1 HTN' : 'NORMOTENSIVE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">RPP Index</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{Math.round((sbp * heartRate) / 100)}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pulse Pressure</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{sbp - dbp} mmHg</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mean Arterial</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{effectiveMap.toFixed(1)} mmHg</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    MAP = DBP + ⅓(SBP - DBP). Rate Pressure Product (RPP) models myocardial oxygen demand.
                  </p>
                </div>
              )}

              {/* B. PREECLAMPSIA RISK DETAILS */}
              {activeCategory === 'preeclampsia_risk' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      Multivariate Risk Markers & SHAP Weights
                    </span>
                    {simulationResult?.uncertainty_interval && (
                      <span className="text-[10px] font-mono text-slate-500">
                        95% CI: [{(((simulationResult.uncertainty_interval as any).lower ?? (simulationResult.uncertainty_interval as any).lower_bound_95ci ?? 0) * 100).toFixed(1)}% – {(((simulationResult.uncertainty_interval as any).upper ?? (simulationResult.uncertainty_interval as any).upper_bound_95ci ?? 0) * 100).toFixed(1)}%]
                      </span>
                    )}
                  </div>
                  {simulationResult?.feature_contributions && simulationResult.feature_contributions.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {simulationResult.feature_contributions.slice(0, 4).map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100 text-[11px]">
                          <span className="text-slate-700 font-medium">{f.feature_label}</span>
                          <span className={`font-mono font-bold ${f.direction === 'increases_risk' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {f.direction === 'increases_risk' ? '+' : ''}{f.contribution.toFixed(1)} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600">Multi-marker risk model evaluation anchored to current clinical visit evidence.</p>
                  )}
                </div>
              )}

              {/* C. GESTATIONAL TIMELINE DETAILS */}
              {activeCategory === 'gestational_timeline' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Clock className="w-4 h-4 text-sky-600" />
                      Longitudinal Trimester Trajectory Steps
                    </span>
                    <span className="text-[10px] text-sky-700 font-semibold">
                      Anchor: {patientBaselineGA.toFixed(1)}w → Target: {targetGa.toFixed(1)}w
                    </span>
                  </div>
                  {simulationResult?.detailed_results?.timeline && simulationResult.detailed_results.timeline.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {simulationResult.detailed_results.timeline.map((step: any, idx: number) => (
                        <div key={idx} className={`flex items-center justify-between p-1.5 rounded-lg border text-[11px] ${
                          step.source === 'CURRENT_OBSERVED' ? 'bg-sky-50/70 border-sky-200 font-semibold' : 'bg-white border-slate-100'
                        }`}>
                          <span className="font-mono text-slate-800">{step.gestational_age_weeks.toFixed(1)}w</span>
                          <span className="font-mono text-slate-700">{step.sbp}/{step.dbp} mmHg</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            step.source === 'CURRENT_OBSERVED' ? 'bg-sky-200/60 text-sky-900' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {step.source === 'CURRENT_OBSERVED' ? 'Current Anchor' : 'Simulated Future'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600">Linear slope extrapolation based on patient baseline vitals.</p>
                  )}
                </div>
              )}

              {/* D. METABOLIC HEALTH DETAILS */}
              {activeCategory === 'metabolic_health' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Apple className="w-4 h-4 text-emerald-600" />
                      ACOG Glycemia & GDM Threshold Comparison
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      fastingGlucose >= 105 || postMealGlucose >= 160 ? 'bg-rose-100 text-rose-800' : fastingGlucose >= 95 || postMealGlucose >= 140 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {fastingGlucose >= 105 || postMealGlucose >= 160 ? 'GDM SCREENING POSITIVE' : fastingGlucose >= 95 || postMealGlucose >= 140 ? 'BORDERLINE EXCURSION' : 'TARGET GLYCEMIA'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Fasting Target (&lt;95)</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{fastingGlucose} {glucoseUnit}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Postprandial Target (&lt;140)</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{postMealGlucose} {glucoseUnit}</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Excursion is +{postMealGlucose - fastingGlucose} {glucoseUnit}. Fasting &gt;=95 or 1-hr &gt;=140 warrants a confirmatory diagnostic 3-hour oral glucose tolerance test (OGTT).
                  </p>
                </div>
              )}

              {/* E. SLEEP & STRESS DETAILS */}
              {activeCategory === 'sleep_stress' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Moon className="w-4 h-4 text-purple-600" />
                      Autonomic Tone & Nocturnal Dipping Analysis
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      stressScale >= 7 || sleepHours < 6 ? 'bg-rose-100 text-rose-800' : stressScale >= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {stressScale >= 7 || sleepHours < 6 ? 'SYMPATHETIC DOMINANCE' : 'BALANCED TONE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">HRV rMSSD</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{hrvRmssd} ms</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sleep Regularity</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{sleepRegIdx}%</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dipping Pattern</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{sleepHours >= 7 ? 'Normal' : 'Non-dipper'}</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Non-dipping nocturnal blood pressure and depressed HRV correlate with vascular endothelial strain and gestational hypertension.
                  </p>
                </div>
              )}

              {/* F. SENSOR NOISE & PACKET LOSS DETAILS */}
              {activeCategory === 'sensor_reliability' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Radio className="w-4 h-4 text-sky-600 animate-pulse" />
                      Ambulatory Telemetry Degradation Pipeline
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      missingPacketRate > 20
                        ? 'bg-rose-100 text-rose-800'
                        : missingPacketRate > 8
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {missingPacketRate > 20 ? 'HIGH LOSS' : missingPacketRate > 8 ? 'MODERATE LOSS' : 'OPTIMAL STREAM'}
                    </span>
                  </div>

                  {/* Packet Retention Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-medium text-slate-600">
                      <span>Packet Delivery: {(100 - missingPacketRate).toFixed(0)}%</span>
                      <span className="text-rose-600">Dropped: {missingPacketRate}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.max(0, 100 - missingPacketRate)}%` }}
                        title={`Retained packets: ${100 - missingPacketRate}%`}
                      />
                      <div
                        className="bg-rose-500 transition-all duration-300"
                        style={{ width: `${missingPacketRate}%` }}
                        title={`Dropped packets: ${missingPacketRate}%`}
                      />
                    </div>
                  </div>

                  {/* Latency & Noise Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/80">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Noise Jitter</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">±{noiseSigma} mmHg</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sync Buffer</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{delayMinutes} min</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Disconnect</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{disconnectHours}h</p>
                    </div>
                  </div>

                  {/* Clinical Detection Notice */}
                  {(simulationResult?.detailed_results?.impact_metrics?.risk_of_undetected_spikes === 'HIGH' || missingPacketRate > 20 || delayMinutes > 40) ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>High Clinical Blindspot Risk</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-rose-700">
                        Severe packet dropout ({missingPacketRate}%) and transmission latency ({delayMinutes} min) introduce critical blindspots. Acute hypertensive surges (SBP ≥ 160) could occur between telemetry syncs without triggering real-time clinical alerts.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Adequate Telemetry Integrity</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-emerald-700">
                        Packet delivery ({100 - missingPacketRate}%) and low signal noise (±{noiseSigma}σ) maintain dependable confidence intervals for algorithmic preeclampsia screening.
                      </p>
                    </div>
                  )}

                  {simulationResult?.detailed_results?.research_implication && (
                    <p className="text-[10px] text-slate-500 italic border-t border-slate-200/60 pt-1.5">
                      {simulationResult.detailed_results.research_implication}
                    </p>
                  )}
                </div>
              )}

              {/* G. MONITORING SCHEDULE DETAILS */}
              {activeCategory === 'monitoring_schedule' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Calendar className="w-4 h-4 text-sky-600" />
                      HBPM Cadence & Detection Latency Trade-Off
                    </span>
                    <span className="text-[10px] text-sky-700 font-semibold">
                      Horizon: {monitoringDays} Days
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Expected Readings</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{simulationResult?.detailed_results?.projected_totals?.expected_readings ?? 28}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Retained Readings</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{simulationResult?.detailed_results?.projected_totals?.retained_readings ?? 25}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Detection Delay</span>
                      <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">~{simulationResult?.detailed_results?.protocol_details?.detection_delay_hours ?? 18}h</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Higher frequency monitoring accelerates detection of accelerating blood pressure trajectories while balancing patient burden.
                  </p>
                </div>
              )}

              {/* H. POSTPARTUM DETAILS */}
              {activeCategory === 'postpartum' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <Baby className="w-4 h-4 text-rose-600" />
                      Postpartum Rebound Curve & Vigilance Window
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      postpartumDay >= 3 && postpartumDay <= 6 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {postpartumDay >= 3 && postpartumDay <= 6 ? 'PEAK RISK WINDOW (DAYS 3–6)' : `DAY ${postpartumDay}`}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-100 space-y-1 text-[11px]">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-700">Clinical Vigilance Status:</span>
                      <span className={`font-bold ${postpartumSbp >= 140 || postpartumDbp >= 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {postpartumSbp >= 140 || postpartumDbp >= 90 ? 'ELEVATED BP — MONITOR CLOSELY' : 'STABLE NORMOTENSIVE'}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-snug">
                      Delayed postpartum preeclampsia peaks between days 3 and 6 after delivery due to fluid mobilization. Scheduled in-clinic check recommended at Day 7.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Editable Parameter Controls (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm">Editable Parameters</CardTitle>
                <CardDescription>Adjust variables to project counterfactual state</CardDescription>
              </div>
              <Badge variant="primary">LIVE CONTROLS</Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Validation Error Banner (Explicit - Never silently modify) */}
              {!isValidInput && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1 text-rose-900">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Parameter Validation Error</span>
                  </div>
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-[11px] leading-snug">{err}</p>
                  ))}
                </div>
              )}

              {/* Quick Scenario Templates */}
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1.5">
                  Scenario Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeCategory === 'cardiovascular' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(118);
                          setDbp(76);
                          setHeartRate(72);
                          executeSimulation('cardiovascular', { sbp: 118, dbp: 76, heart_rate: 72 });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 hover:text-sky-800 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Normotensive (118/76)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(142);
                          setDbp(92);
                          setHeartRate(82);
                          executeSimulation('cardiovascular', { sbp: 142, dbp: 92, heart_rate: 82 });
                        }}
                        className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors font-medium"
                      >
                        Stage 1 HTN (142/92)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(160);
                          setDbp(105);
                          setHeartRate(92);
                          executeSimulation('cardiovascular', { sbp: 160, dbp: 105, heart_rate: 92 });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Severe HTN (160/105)
                      </button>
                    </>
                  )}

                  {activeCategory === 'preeclampsia_risk' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(145);
                          setDbp(94);
                          setProteinDipstick('2+');
                          setPlatelets(135);
                          setAst(45);
                          setAlt(40);
                          setCreatinine(0.95);
                          executeSimulation('preeclampsia_risk', {
                            sbp: 145,
                            dbp: 94,
                            proteinuria_dipstick: '2+',
                            platelets: 135,
                            ast: 45,
                            alt: 40,
                            serum_creatinine: 0.95,
                            gestational_age_weeks: ga,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors font-medium"
                      >
                        Proteinuria Surge (2+)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(152);
                          setDbp(98);
                          setProteinDipstick('2+');
                          setPlatelets(85);
                          setAst(85);
                          setAlt(75);
                          setCreatinine(1.15);
                          executeSimulation('preeclampsia_risk', {
                            sbp: 152,
                            dbp: 98,
                            proteinuria_dipstick: '2+',
                            platelets: 85,
                            ast: 85,
                            alt: 75,
                            serum_creatinine: 1.15,
                            gestational_age_weeks: ga,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Low Platelets / HELLP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSbp(118);
                          setDbp(76);
                          setProteinDipstick('Negative');
                          setPlatelets(210);
                          setAst(24);
                          setAlt(20);
                          setCreatinine(0.70);
                          executeSimulation('preeclampsia_risk', {
                            sbp: 118,
                            dbp: 76,
                            proteinuria_dipstick: 'Negative',
                            platelets: 210,
                            ast: 24,
                            alt: 20,
                            serum_creatinine: 0.70,
                            gestational_age_weeks: ga,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Baseline Normal
                      </button>
                    </>
                  )}

                  {activeCategory === 'gestational_timeline' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const w = Math.min(41, Math.max(Math.ceil(patientBaselineGA) + 1, 35.0));
                          setTargetGa(w);
                          setSbpSlope(0.4);
                          setDbpSlope(0.3);
                          executeSimulation('gestational_timeline', { target_ga_weeks: w, sbp_slope: 0.4, dbp_slope: 0.3 });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Near-Term (35.0w)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const w = Math.min(41, Math.max(Math.ceil(patientBaselineGA) + 1, 37.0));
                          setTargetGa(w);
                          setSbpSlope(0.6);
                          setDbpSlope(0.4);
                          executeSimulation('gestational_timeline', { target_ga_weeks: w, sbp_slope: 0.6, dbp_slope: 0.4 });
                        }}
                        className="px-2.5 py-1 text-xs bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-lg border border-sky-200 transition-colors font-medium"
                      >
                        Full Term (37.0w)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const w = Math.min(41, Math.max(Math.ceil(patientBaselineGA) + 1, 39.0));
                          setTargetGa(w);
                          setSbpSlope(1.2);
                          setDbpSlope(0.8);
                          executeSimulation('gestational_timeline', { target_ga_weeks: w, sbp_slope: 1.2, dbp_slope: 0.8 });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Accelerating Rise (+1.2/wk)
                      </button>
                    </>
                  )}

                  {activeCategory === 'metabolic_health' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFastingGlucose(88);
                          setPostMealGlucose(118);
                          executeSimulation('metabolic_health', {
                            fasting_glucose: 88,
                            post_meal_glucose: 118,
                            unit: glucoseUnit,
                            weight_kg: maternalWeight,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Normal Target (88/118)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFastingGlucose(98);
                          setPostMealGlucose(145);
                          executeSimulation('metabolic_health', {
                            fasting_glucose: 98,
                            post_meal_glucose: 145,
                            unit: glucoseUnit,
                            weight_kg: maternalWeight,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors font-medium"
                      >
                        Borderline Excursion (98/145)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFastingGlucose(112);
                          setPostMealGlucose(172);
                          executeSimulation('metabolic_health', {
                            fasting_glucose: 112,
                            post_meal_glucose: 172,
                            unit: glucoseUnit,
                            weight_kg: maternalWeight,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        GDM High Surge (112/172)
                      </button>
                    </>
                  )}

                  {activeCategory === 'sleep_stress' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSleepHours(8.2);
                          setSleepRegIdx(88);
                          setHrvRmssd(48);
                          setStressScale(2);
                          executeSimulation('sleep_stress', {
                            sleep_hours: 8.2,
                            sleep_regularity_idx: 88,
                            hrv_rmssd_ms: 48,
                            stress_scale: 2,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-200 transition-colors font-medium"
                      >
                        Restorative Sleep (8.2h, HRV 48)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSleepHours(5.5);
                          setSleepRegIdx(60);
                          setHrvRmssd(22);
                          setStressScale(8);
                          executeSimulation('sleep_stress', {
                            sleep_hours: 5.5,
                            sleep_regularity_idx: 60,
                            hrv_rmssd_ms: 22,
                            stress_scale: 8,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Sleep Deficit (5.5h, Stress 8)
                      </button>
                    </>
                  )}

                  {activeCategory === 'sensor_reliability' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMissingPacketRate(18);
                          setNoiseSigma(5.5);
                          setDelayMinutes(25);
                          setDisconnectHours(0);
                          executeSimulation('sensor_reliability', {
                            missing_packet_pct: 18,
                            sensor_noise_sigma: 5.5,
                            transmission_delay_min: 25,
                            device_disconnect_hours: 0,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors font-medium"
                      >
                        Noisy Stream (18%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMissingPacketRate(40);
                          setNoiseSigma(7.5);
                          setDelayMinutes(60);
                          setDisconnectHours(3);
                          executeSimulation('sensor_reliability', {
                            missing_packet_pct: 40,
                            sensor_noise_sigma: 7.5,
                            transmission_delay_min: 60,
                            device_disconnect_hours: 3,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Critical Dropout (40%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMissingPacketRate(0);
                          setNoiseSigma(0.8);
                          setDelayMinutes(0);
                          setDisconnectHours(0);
                          executeSimulation('sensor_reliability', {
                            missing_packet_pct: 0,
                            sensor_noise_sigma: 0.8,
                            transmission_delay_min: 0,
                            device_disconnect_hours: 0,
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Calibrated Sensor
                      </button>
                    </>
                  )}

                  {activeCategory === 'monitoring_schedule' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProtocol('manual_daily');
                          executeSimulation('monitoring_schedule', { protocol: 'manual_daily', monitoring_days: monitoringDays });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Once-Daily (1x)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProtocol('manual_multi');
                          executeSimulation('monitoring_schedule', { protocol: 'manual_multi', monitoring_days: monitoringDays });
                        }}
                        className="px-2.5 py-1 text-xs bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-lg border border-sky-200 transition-colors font-medium"
                      >
                        Three-Times-Daily (3x)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProtocol('continuous_wearable');
                          executeSimulation('monitoring_schedule', { protocol: 'continuous_wearable', monitoring_days: monitoringDays });
                        }}
                        className="px-2.5 py-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-200 transition-colors font-medium"
                      >
                        Wearable Stream (48x)
                      </button>
                    </>
                  )}

                  {activeCategory === 'postpartum' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPostpartumDay(2);
                          setPostpartumSbp(122);
                          setPostpartumDbp(78);
                          setPostpartumSymptoms([]);
                          executeSimulation('postpartum', {
                            postpartum_day: 2,
                            postpartum_sbp: 122,
                            postpartum_dbp: 78,
                            symptoms: [],
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-sky-50 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                      >
                        Early Day 2 (122/78)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostpartumDay(4);
                          setPostpartumSbp(148);
                          setPostpartumDbp(96);
                          setPostpartumSymptoms(['headache']);
                          executeSimulation('postpartum', {
                            postpartum_day: 4,
                            postpartum_sbp: 148,
                            postpartum_dbp: 96,
                            symptoms: ['headache'],
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-lg border border-rose-200 transition-colors font-medium"
                      >
                        Peak Window Day 4 (148/96)
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* MODULE A: Cardiovascular */}
              {activeCategory === 'cardiovascular' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Systolic Blood Pressure (SBP)</span>
                      <span className="font-mono font-bold text-slate-900">{sbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="200"
                      value={sbp}
                      onChange={(e) => setSbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Diastolic Blood Pressure (DBP)</span>
                      <span className="font-mono font-bold text-slate-900">{dbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="140"
                      value={dbp}
                      onChange={(e) => setDbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Heart Rate</span>
                      <span className="font-mono font-bold text-slate-900">{heartRate} bpm</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="130"
                      value={heartRate}
                      onChange={(e) => setHeartRate(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600 font-medium block mb-1">Measurements/Day</label>
                      <select
                        value={bpFreq}
                        onChange={(e) => setBpFreq(parseInt(e.target.value))}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={1}>1x / day</option>
                        <option value={2}>2x / day</option>
                        <option value={4}>4x / day</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-medium block mb-1">Noise (±σ mmHg)</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={variabilitySigma}
                        onChange={(e) => setVariabilitySigma(parseFloat(e.target.value) || 4)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE B: Preeclampsia Risk */}
              {activeCategory === 'preeclampsia_risk' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Gestational Age</span>
                      <span className="font-mono font-bold text-sky-700">{ga.toFixed(1)} wks</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="41"
                      step="0.5"
                      value={ga}
                      onChange={(e) => setGa(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Systolic BP</span>
                      <span className="font-mono font-bold text-slate-900">{sbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="200"
                      value={sbp}
                      onChange={(e) => setSbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Diastolic BP</span>
                      <span className="font-mono font-bold text-slate-900">{dbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="140"
                      value={dbp}
                      onChange={(e) => setDbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1.5">Proteinuria Dipstick</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['Negative', 'Trace', '1+', '2+'].map((g) => (
                        <button
                          key={g}
                          onClick={() => setProteinDipstick(g)}
                          className={`py-1.5 text-xs font-mono font-medium rounded-lg border transition-all ${
                            proteinDipstick === g
                              ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">AST (U/L)</label>
                      <input
                        type="number"
                        value={ast}
                        onChange={(e) => setAst(parseFloat(e.target.value) || 25)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">ALT (U/L)</label>
                      <input
                        type="number"
                        value={alt}
                        onChange={(e) => setAlt(parseFloat(e.target.value) || 22)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Creatinine</label>
                      <input
                        type="number"
                        step="0.05"
                        value={creatinine}
                        onChange={(e) => setCreatinine(parseFloat(e.target.value) || 0.75)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE C: Gestational Timeline */}
              {activeCategory === 'gestational_timeline' && (
                <div className="space-y-4">
                  <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200 flex justify-between items-center text-xs">
                    <span className="text-sky-900 font-medium">Current Baseline GA:</span>
                    <span className="font-mono font-bold text-sky-800">{patientBaselineGA.toFixed(1)} wks</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Target Gestational Week</span>
                      <span className="font-mono font-bold text-sky-700">{targetGa} wks</span>
                    </div>
                    <input
                      type="range"
                      min={Math.min(40, Math.ceil(patientBaselineGA))}
                      max="42"
                      step="0.5"
                      value={targetGa}
                      onChange={(e) => setTargetGa(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{Math.min(40, Math.ceil(patientBaselineGA))} wks</span>
                      <span>42 wks</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">SBP Slope (+mmHg/wk)</span>
                      <span className="font-mono font-bold text-slate-900">+{sbpSlope} mmHg/wk</span>
                    </div>
                    <input
                      type="range"
                      min="-1.0"
                      max="3.0"
                      step="0.1"
                      value={sbpSlope}
                      onChange={(e) => setSbpSlope(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">DBP Slope (+mmHg/wk)</span>
                      <span className="font-mono font-bold text-slate-900">+{dbpSlope} mmHg/wk</span>
                    </div>
                    <input
                      type="range"
                      min="-1.0"
                      max="2.0"
                      step="0.1"
                      value={dbpSlope}
                      onChange={(e) => setDbpSlope(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* MODULE D: Metabolic Health */}
              {activeCategory === 'metabolic_health' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">Glucose Unit</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {['mg/dL', 'mmol/L'].map((u) => (
                        <button
                          key={u}
                          onClick={() => setGlucoseUnit(u)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                            glucoseUnit === u ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Fasting Plasma Glucose</span>
                      <span className="font-mono font-bold text-slate-900">{fastingGlucose} {glucoseUnit}</span>
                    </div>
                    <input
                      type="range"
                      min="65"
                      max="160"
                      value={fastingGlucose}
                      onChange={(e) => setFastingGlucose(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Post-Meal (1-Hr) Glucose</span>
                      <span className="font-mono font-bold text-slate-900">{postMealGlucose} {glucoseUnit}</span>
                    </div>
                    <input
                      type="range"
                      min="85"
                      max="220"
                      value={postMealGlucose}
                      onChange={(e) => setPostMealGlucose(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Maternal Weight (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={maternalWeight}
                      onChange={(e) => setMaternalWeight(parseFloat(e.target.value) || 68)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* MODULE E: Sleep & Stress */}
              {activeCategory === 'sleep_stress' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Sleep Duration</span>
                      <span className="font-mono font-bold text-slate-900">{sleepHours} hrs</span>
                    </div>
                    <input
                      type="range"
                      min="4.0"
                      max="11.0"
                      step="0.5"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">HRV (rMSSD)</span>
                      <span className="font-mono font-bold text-slate-900">{hrvRmssd} ms</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="80"
                      value={hrvRmssd}
                      onChange={(e) => setHrvRmssd(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Self-Reported Stress (1–10)</span>
                      <span className="font-mono font-bold text-slate-900">{stressScale}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={stressScale}
                      onChange={(e) => setStressScale(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* MODULE F: Sensor Reliability */}
              {activeCategory === 'sensor_reliability' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Simulated Packet Loss</span>
                      <span className="font-mono font-bold text-rose-700">{missingPacketRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={missingPacketRate}
                      onChange={(e) => setMissingPacketRate(parseInt(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0% (Clean)</span>
                      <span>60% (Critical)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Telemetry Sync Latency</span>
                      <span className="font-mono font-bold text-slate-900">{delayMinutes} min</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0 min (Real-time)</span>
                      <span>120 min (High delay)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Sensor Noise Jitter</span>
                      <span className="font-mono font-bold text-slate-900">±{noiseSigma} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="0.5"
                      value={noiseSigma}
                      onChange={(e) => setNoiseSigma(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>±0 (Calibrated)</span>
                      <span>±12 (Artifact-heavy)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Device Disconnect Duration</span>
                      <span className="font-mono font-bold text-amber-700">{disconnectHours} hrs</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="1"
                      value={disconnectHours}
                      onChange={(e) => setDisconnectHours(parseInt(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0 hrs (Continuous)</span>
                      <span>12 hrs (Extended offline)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE G: Monitoring Schedule */}
              {activeCategory === 'monitoring_schedule' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1.5">Monitoring Protocol</label>
                    <div className="space-y-2">
                      {[
                        { id: 'manual_daily', name: 'Once-Daily Manual Cuff', desc: 'Standard antenatal home protocol (1x/day)' },
                        { id: 'manual_multi', name: 'Three-Times Daily (TID)', desc: 'Higher diurnal sensitivity (3x/day)' },
                        { id: 'continuous_wearable', name: 'Continuous Wearable Sensor', desc: 'Maximum telemetry completeness (48x/day)' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedProtocol(p.id);
                            executeSimulation('monitoring_schedule', { protocol: p.id, monitoring_days: monitoringDays });
                          }}
                          className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${
                            selectedProtocol === p.id
                              ? 'bg-sky-50 border-sky-400 text-sky-900 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Observation Horizon</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[7, 14, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setMonitoringDays(d);
                            executeSimulation('monitoring_schedule', { protocol: selectedProtocol, monitoring_days: d });
                          }}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            monitoringDays === d
                              ? 'bg-sky-50 border-sky-400 text-sky-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          {d} Days
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE H: Postpartum */}
              {activeCategory === 'postpartum' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Delivery Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['vaginal', 'cesarean'].map((m) => (
                        <button
                          key={m}
                          onClick={() => setDeliveryType(m)}
                          className={`py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${
                            deliveryType === m
                              ? 'bg-sky-50 border-sky-400 text-sky-900 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Postpartum Day</span>
                      <span className="font-mono font-bold text-sky-700">Day {postpartumDay}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="42"
                      value={postpartumDay}
                      onChange={(e) => setPostpartumDay(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Postpartum SBP</span>
                      <span className="font-mono font-bold text-slate-900">{postpartumSbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="90"
                      max="180"
                      value={postpartumSbp}
                      onChange={(e) => setPostpartumSbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">Postpartum DBP</span>
                      <span className="font-mono font-bold text-slate-900">{postpartumDbp} mmHg</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="120"
                      value={postpartumDbp}
                      onChange={(e) => setPostpartumDbp(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-medium block mb-1">Reported Symptoms</label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { id: 'headache', label: 'Severe Headache' },
                        { id: 'vision_changes', label: 'Visual Changes' },
                        { id: 'epigastric_pain', label: 'RUQ/Epigastric' },
                        { id: 'dyspnea', label: 'Shortness of Breath' }
                      ].map((sym) => {
                        const checked = postpartumSymptoms.includes(sym.id);
                        return (
                          <button
                            key={sym.id}
                            type="button"
                            onClick={() => {
                              const updated = checked
                                ? postpartumSymptoms.filter((s) => s !== sym.id)
                                : [...postpartumSymptoms, sym.id];
                              setPostpartumSymptoms(updated);
                              executeSimulation('postpartum', { symptoms: updated });
                            }}
                            className={`p-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                              checked
                                ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            {sym.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Run & Recalculate */}
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => executeSimulation(activeCategory)}
                  disabled={!isValidInput}
                  isLoading={simulating}
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Run Counterfactual Simulation</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Scenario Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Simulation Scenario"
        subtitle="Archive parameter state for cohort review and longitudinal comparisons"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveScenario}
              isLoading={isSavingScenario}
              disabled={!scenarioNameInput.trim()}
            >
              Save Scenario
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">Scenario Identifier / Name</label>
          <input
            type="text"
            value={scenarioNameInput}
            onChange={(e) => setScenarioNameInput(e.target.value)}
            placeholder="e.g. SBP escalation at 32 weeks"
            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
          />
          <p className="text-xs text-slate-500">
            Current category: <strong className="capitalize">{activeCategory.replace('_', ' ')}</strong>
          </p>
        </div>
      </Modal>
    </div>
  );
};
