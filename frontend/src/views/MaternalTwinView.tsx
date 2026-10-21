import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, MaternalTwinState, RiskPrediction } from '../api/client';
import { MaternalTwin3D } from '../components/MaternalTwin3D';
import {
  Activity,
  AlertCircle,
  Clock,
  Dna,
  HeartPulse,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export const MaternalTwinView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const [twin, setTwin] = useState<MaternalTwinState | null>(null);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
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
        const [twinData, preds] = await Promise.all([
          api.getCurrentTwin(selectedPatientId),
          api.getPredictions(selectedPatientId),
        ]);
        setTwin(twinData);
        if (preds.length > 0) setPrediction(preds[0]);

        if (twinData.gestational_age_weeks) {
          setGestationalAge(twinData.gestational_age_weeks);
        }
        if (twinData.sbp && twinData.dbp) {
          setSbpOverride(twinData.sbp);
          setDbpOverride(twinData.dbp);
        }
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
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 uppercase tracking-wide">
            <Dna className="w-4 h-4" />
            <span>Maternal Living Twin Visualizer</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            {selectedPatient?.first_name} {selectedPatient?.last_name} — Living Representation
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Synchronized with verified clinical observations and longitudinal telemetry snapshot v{twin?.version || 1}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isExplorationMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetToVerified}
            >
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <span>Reset to Clinical Record</span>
            </Button>
          )}

          <Badge variant="primary" className="font-mono text-xs py-1.5 px-3">
            Twin Version {twin?.version || 1}.0
          </Badge>
        </div>
      </div>

      {/* Explanatory Banner: Visual Illustration vs Clinical Observation */}
      <Alert type="info" title="Scientific Visualization Disclosure">
        The 3D model below is a geometric rendering driven by verified blood pressure, gestational age, and risk classification.
        It serves as an intuitive anatomical anchor for clinical discussions and does not represent an actual ultrasound or radiological scan.
      </Alert>

      {/* Main Grid: 3D Viewport on Left | Vitals & Telemetry on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Viewport (lg:col-span-8) */}
        <Card className="lg:col-span-8 flex flex-col justify-between min-h-[580px]">
          <CardHeader>
            <div>
              <CardTitle>Biological Synthesis</CardTitle>
              <CardDescription>
                {isExplorationMode ? (
                  <span className="text-amber-600 font-semibold">Interactive Exploration Mode Active (What-If Scrubber)</span>
                ) : (
                  <span className="text-emerald-700 font-semibold">Synchronized with Verified Clinical Record</span>
                )}
              </CardDescription>
            </div>
            <Badge variant={isExplorationMode ? 'warning' : 'success'}>
              {isExplorationMode ? 'HYPOTHETICAL PREVIEW' : 'CLINICAL SNAPSHOT'}
            </Badge>
          </CardHeader>

          {/* 3D Canvas Box */}
          <div className="w-full flex-1 relative flex items-center justify-center my-3 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 min-h-[440px]">
            <MaternalTwin3D
              gestationalAgeWeeks={gestationalAge}
              sbp={sbpOverride}
              dbp={dbpOverride}
              riskCategory={prediction?.risk_category || 'LOW'}
              isSimulated={isExplorationMode}
              className="w-full h-full min-h-[440px]"
            />
          </div>

          {/* Interactive Anatomical Scrubber Controls */}
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-600" />
                Interactive Anatomical & Hemodynamic Scrubber
              </span>
              {isExplorationMode && (
                <span className="text-[11px] text-amber-700 font-medium">Unsaved Preview (Zero database mutation)</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Gestational Age</span>
                  <span className="font-mono font-bold text-sky-700">{gestationalAge.toFixed(1)} wks</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="40"
                  step="0.5"
                  value={gestationalAge}
                  onChange={(e) => {
                    setGestationalAge(parseFloat(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Systolic Pressure</span>
                  <span className="font-mono font-bold text-slate-900">{sbpOverride} mmHg</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="190"
                  value={sbpOverride}
                  onChange={(e) => {
                    setSbpOverride(parseInt(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Diastolic Pressure</span>
                  <span className="font-mono font-bold text-slate-900">{dbpOverride} mmHg</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="130"
                  value={dbpOverride}
                  onChange={(e) => {
                    setDbpOverride(parseInt(e.target.value));
                    setIsExplorationMode(true);
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Right Telemetry Panels (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Verified Organ Biomarkers</CardTitle>
            </CardHeader>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4">
              {[
                { id: 'CARDIO', label: 'Cardiovascular' },
                { id: 'RENAL', label: 'Renal Function' },
                { id: 'HEMATOLOGY', label: 'Hematology' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTelemetryTab(tab.id as any)}
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                    activeTelemetryTab === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTelemetryTab === 'CARDIO' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Mean Arterial Pressure (MAP)</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{computedMap} mmHg</p>
                  </div>
                  <Badge variant={computedMap >= 105 ? 'warning' : 'success'}>
                    {computedMap >= 105 ? 'ELEVATED' : 'TARGET'}
                  </Badge>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Pulse Pressure</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{computedPP} mmHg</p>
                  </div>
                  <Badge variant="neutral">NORMATIVE</Badge>
                </div>
              </div>
            )}

            {activeTelemetryTab === 'RENAL' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Proteinuria Dipstick</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      {twin?.proteinuria_dipstick || 'Not recorded'}
                    </p>
                  </div>
                  <Badge variant={twin?.proteinuria_dipstick && twin.proteinuria_dipstick !== 'Negative' ? 'warning' : 'success'}>
                    {twin?.proteinuria_dipstick || 'NORMAL'}
                  </Badge>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Serum Creatinine</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      {twin?.serum_creatinine ? `${twin.serum_creatinine} mg/dL` : 'Not recorded'}
                    </p>
                  </div>
                  <Badge variant="neutral">≤ 1.1 mg/dL</Badge>
                </div>
              </div>
            )}

            {activeTelemetryTab === 'HEMATOLOGY' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Platelet Count</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      {twin?.platelets ? `${twin.platelets} ×10³/µL` : 'Not recorded'}
                    </p>
                  </div>
                  <Badge variant={twin?.platelets && twin.platelets < 100 ? 'danger' : 'success'}>
                    {twin?.platelets ? '>150k NORMAL' : 'UNRECORDED'}
                  </Badge>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Liver Enzymes AST/ALT</span>
                    <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      {twin?.ast !== undefined && twin?.ast !== null ? `${twin.ast}` : '—'} / {twin?.alt !== undefined && twin?.alt !== null ? `${twin.alt}` : '—'} U/L
                    </p>
                  </div>
                  <Badge variant="neutral">THRESHOLD ≤ 70</Badge>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
