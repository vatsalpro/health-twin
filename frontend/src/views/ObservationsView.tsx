import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ClinicalObservation } from '../api/client';
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
  Plus,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const ObservationsView: React.FC = () => {
  const { selectedPatient, selectedPatientId, refreshPatientData } = useAuth();
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [trajectories, setTrajectories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Manual observation modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [testType, setTestType] = useState<string>('blood_pressure');
  const [testName, setTestName] = useState<string>('systolic_bp');
  const [valueNum, setValueNum] = useState<number>(125);
  const [unit, setUnit] = useState<string>('mmHg');
  const [gaInput, setGaInput] = useState<number>(31.5);

  const loadData = async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const [obsList, compData] = await Promise.all([
        api.getObservations(selectedPatientId),
        api.getHistoricalComparisons(selectedPatientId),
      ]);
      setObservations(obsList);
      setTrajectories(compData.trajectories || []);
    } catch (err) {
      console.error('Failed to load observations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPatientId]);

  const handleCreateObservation = async () => {
    if (!selectedPatientId) return;
    try {
      await api.createObservation(selectedPatientId, {
        observation_type: testType,
        test_name: testName,
        value_numeric: valueNum,
        unit: unit,
        gestational_age_weeks: gaInput,
        source_type: 'patient_reported',
      });
      setModalOpen(false);
      await refreshPatientData();
      await loadData();
    } catch (err: any) {
      alert(`Error recording observation: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <span className="text-xs font-mono text-[#5BE7E8] uppercase tracking-wider block">
            LONGITUDINAL CLINICAL TRAJECTORIES
          </span>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">Observations & Hemodynamic Trends</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Normalized clinical time-series for {selectedPatient?.first_name} {selectedPatient?.last_name}.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5BE7E8] to-[#43D6B0] hover:opacity-95 text-[#070B14] font-semibold text-xs shadow-lg shadow-[#5BE7E8]/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Measurement</span>
        </button>
      </div>

      {/* Chart 1: Blood Pressure & MAP Trajectory */}
      <div className="glass-panel-elevated p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#F4F7FC] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#5BE7E8]" />
              Longitudinal Hemodynamic Trajectory (SBP / DBP / MAP)
            </h3>
            <p className="text-xs text-[#A5B3C8]">
              Plotted against gestational age (weeks). Stage 1 threshold marked at 140 mmHg.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#F43F5E]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" /> SBP
            </span>
            <span className="flex items-center gap-1.5 text-[#5BE7E8]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5BE7E8]" /> DBP
            </span>
            <span className="flex items-center gap-1.5 text-[#E9B96E]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9B96E]" /> MAP
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trajectories} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(166,190,220,0.1)" />
              <XAxis
                dataKey="gestational_age_weeks"
                stroke="#A5B3C8"
                tickFormatter={(val) => `${val}w`}
                fontSize={11}
              />
              <YAxis domain={[60, 170]} stroke="#A5B3C8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B1220',
                  borderColor: 'rgba(166,190,220,0.2)',
                  borderRadius: '8px',
                  color: '#F4F7FC',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine y={140} stroke="#F43F5E" strokeDasharray="4 4" label={{ value: 'Hypertensive 140', fill: '#F43F5E', fontSize: 10 }} />
              <ReferenceLine y={90} stroke="#E9B96E" strokeDasharray="4 4" label={{ value: 'Diastolic 90', fill: '#E9B96E', fontSize: 10 }} />
              <Line type="monotone" dataKey="sbp" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 4, fill: '#F43F5E' }} name="Systolic BP" />
              <Line type="monotone" dataKey="dbp" stroke="#5BE7E8" strokeWidth={2.5} dot={{ r: 4, fill: '#5BE7E8' }} name="Diastolic BP" />
              <Line type="monotone" dataKey="map" stroke="#E9B96E" strokeWidth={2} strokeDasharray="2 2" dot={{ r: 3, fill: '#E9B96E' }} name="MAP" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Platelets and Transaminases Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platelets Chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-[#F4F7FC] mb-2 flex items-center gap-2">
            Platelet Trajectory (10^3/uL)
          </h3>
          <p className="text-[11px] text-[#A5B3C8] mb-4">Thrombocytopenia threshold at &lt; 150k</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectories} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(166,190,220,0.1)" />
                <XAxis dataKey="gestational_age_weeks" stroke="#A5B3C8" tickFormatter={(v) => `${v}w`} fontSize={10} />
                <YAxis domain={[120, 260]} stroke="#A5B3C8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1220', borderColor: 'rgba(166,190,220,0.2)', fontSize: '11px' }}
                />
                <ReferenceLine y={150} stroke="#F43F5E" strokeDasharray="3 3" label={{ value: '150k ref', fill: '#F43F5E', fontSize: 9 }} />
                <Line type="monotone" dataKey="platelets" stroke="#43D6B0" strokeWidth={2} dot={{ r: 4, fill: '#43D6B0' }} name="Platelets" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Liver Transaminases Chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-[#F4F7FC] mb-2 flex items-center gap-2">
            Transaminases AST / ALT (U/L)
          </h3>
          <p className="text-[11px] text-[#A5B3C8] mb-4">Elevated threshold at &gt; 40 U/L</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectories} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(166,190,220,0.1)" />
                <XAxis dataKey="gestational_age_weeks" stroke="#A5B3C8" tickFormatter={(v) => `${v}w`} fontSize={10} />
                <YAxis domain={[10, 60]} stroke="#A5B3C8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1220', borderColor: 'rgba(166,190,220,0.2)', fontSize: '11px' }}
                />
                <ReferenceLine y={40} stroke="#E9B96E" strokeDasharray="3 3" label={{ value: '40 U/L ref', fill: '#E9B96E', fontSize: 9 }} />
                <Line type="monotone" dataKey="ast" stroke="#628BFF" strokeWidth={2} dot={{ r: 4 }} name="AST" />
                <Line type="monotone" dataKey="alt" stroke="#5BE7E8" strokeWidth={2} dot={{ r: 4 }} name="ALT" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Observations Table */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-base font-bold text-[#F4F7FC] mb-4">Accepted Clinical Observations Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[rgba(166,190,220,0.14)] text-[10px] font-mono uppercase text-[#A5B3C8]">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Gestational Age</th>
                <th className="pb-3">Measurement</th>
                <th className="pb-3">Value</th>
                <th className="pb-3">Source Provenance</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(166,190,220,0.08)]">
              {observations.map((obs) => (
                <tr key={obs.id} className="hover:bg-[#101A2B]/40 transition-colors">
                  <td className="py-3 font-mono text-[#A5B3C8]">
                    {new Date(obs.measurement_timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3 font-mono font-medium text-[#5BE7E8]">
                    {obs.gestational_age_weeks}w
                  </td>
                  <td className="py-3 font-semibold text-[#F4F7FC]">{obs.test_name}</td>
                  <td className="py-3 font-mono font-bold text-[#F4F7FC]">
                    {obs.value_text || obs.value_numeric} {obs.unit || ''}
                  </td>
                  <td className="py-3 text-[#A5B3C8] capitalize">{obs.source_type.replace('_', ' ')}</td>
                  <td className="py-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#43D6B0]/15 text-[#43D6B0]">
                      {obs.review_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Observation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#070B14]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101A2B] border border-[#5BE7E8]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F4F7FC]">Record New Observation</h3>

            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
                Measurement Type
              </label>
              <select
                value={testName}
                onChange={(e) => {
                  setTestName(e.target.value);
                  if (e.target.value === 'systolic_bp' || e.target.value === 'diastolic_bp') {
                    setUnit('mmHg');
                    setTestType('blood_pressure');
                  } else if (e.target.value === 'platelet_count') {
                    setUnit('10^3/uL');
                    setTestType('laboratory');
                  } else if (e.target.value === 'proteinuria_dipstick') {
                    setUnit('dipstick_grade');
                    setTestType('urine_protein');
                  }
                }}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
              >
                <option value="systolic_bp">Systolic BP (mmHg)</option>
                <option value="diastolic_bp">Diastolic BP (mmHg)</option>
                <option value="platelet_count">Platelet Count (10^3/uL)</option>
                <option value="ast">AST (U/L)</option>
                <option value="alt">ALT (U/L)</option>
                <option value="protein_creatinine_ratio">Protein/Creatinine Ratio (mg/mg)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
                Value ({unit})
              </label>
              <input
                type="number"
                step="0.1"
                value={valueNum}
                onChange={(e) => setValueNum(parseFloat(e.target.value))}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8] block mb-1">
                Gestational Age (weeks)
              </label>
              <input
                type="number"
                step="0.1"
                value={gaInput}
                onChange={(e) => setGaInput(parseFloat(e.target.value))}
                className="w-full bg-[#0B1220] border border-[rgba(166,190,220,0.2)] rounded-lg px-3 py-2 text-xs text-[#F4F7FC]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#142137] text-xs text-[#A5B3C8]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateObservation}
                className="px-4 py-1.5 rounded-lg bg-[#5BE7E8] text-[#070B14] font-semibold text-xs"
              >
                Save & Update Twin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
