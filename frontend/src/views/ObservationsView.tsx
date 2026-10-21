import React, { useEffect, useState, useMemo } from 'react';
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
  Legend
} from 'recharts';
import {
  Activity,
  Plus,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Filter,
  Search,
  HeartPulse,
  Droplets,
  FlaskConical
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';

export const ObservationsView: React.FC = () => {
  const { selectedPatient, selectedPatientId, refreshPatientData } = useAuth();
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [trajectories, setTrajectories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Manual observation modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [testType, setTestType] = useState<string>('blood_pressure');
  const [testName, setTestName] = useState<string>('systolic_bp');
  const [valueNum, setValueNum] = useState<number>(125);
  const [unit, setUnit] = useState<string>('mmHg');
  const [gaInput, setGaInput] = useState<number>(31.5);
  const [submitting, setSubmitting] = useState<boolean>(false);

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

  const handleCreateObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  const filteredObservations = useMemo(() => {
    return observations.filter((obs) => {
      if (typeFilter !== 'all' && obs.observation_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = obs.test_name.toLowerCase().includes(query);
        const matchesType = obs.observation_type.toLowerCase().includes(query);
        const matchesVal = (obs.value_text || `${obs.value_numeric}`).toLowerCase().includes(query);
        if (!matchesName && !matchesType && !matchesVal) return false;
      }
      return true;
    });
  }, [observations, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 uppercase tracking-wide">
            <Activity className="w-4 h-4" />
            <span>Longitudinal Clinical Time-Series</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Observations & Physiological Trends</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Verified maternal trajectory data for {selectedPatient?.first_name} {selectedPatient?.last_name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Record Clinical Observation</span>
          </Button>
        </div>
      </div>

      {/* Chart: Blood Pressure & MAP Longitudinal Trajectory */}
      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-sky-600" />
              <CardTitle>Longitudinal Hemodynamic Trajectory (SBP / DBP / MAP)</CardTitle>
            </div>
            <CardDescription>
              Progression over gestational age (weeks). Clinical stage 1 hypertension threshold marked at 140/90 mmHg.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Systolic
            </span>
            <span className="flex items-center gap-1.5 text-sky-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Diastolic
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> MAP
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectories} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="gestational_age_weeks"
                  stroke="#64748B"
                  tickFormatter={(val) => `${val}w`}
                  fontSize={11}
                />
                <YAxis domain={[50, 180]} stroke="#64748B" fontSize={11} unit=" mmHg" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '8px',
                    color: '#0F172A',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <ReferenceLine y={140} stroke="#DC2626" strokeDasharray="4 4" label={{ value: 'Hypertensive 140', fill: '#DC2626', fontSize: 10 }} />
                <ReferenceLine y={90} stroke="#D97706" strokeDasharray="4 4" label={{ value: 'Diastolic 90', fill: '#D97706', fontSize: 10 }} />
                <Line type="monotone" dataKey="sbp" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4, fill: '#DC2626' }} name="Systolic BP" />
                <Line type="monotone" dataKey="dbp" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4, fill: '#0284C7' }} name="Diastolic BP" />
                <Line type="monotone" dataKey="map" stroke="#D97706" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: '#D97706' }} name="MAP" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Observation History Table Card */}
      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Verified Clinical Observations Log</CardTitle>
            <CardDescription>
              Detailed record of accepted clinical observations with gestational timestamping ({filteredObservations.length} items)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Search test or value..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Observation Types</option>
              <option value="blood_pressure">Blood Pressure</option>
              <option value="laboratory">Laboratory Panels</option>
              <option value="vital_signs">Vital Signs</option>
              <option value="ultrasound">Ultrasound Biometry</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredObservations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <p>No clinical observations match the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                    <th className="pb-2.5">Date / Time</th>
                    <th className="pb-2.5">Gestational Age</th>
                    <th className="pb-2.5">Observation / Test</th>
                    <th className="pb-2.5">Observed Value</th>
                    <th className="pb-2.5">Classification</th>
                    <th className="pb-2.5">Evidence Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredObservations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono text-slate-600">
                        {new Date(obs.measurement_timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-sky-700">
                        {obs.gestational_age_weeks ? `${obs.gestational_age_weeks.toFixed(1)} wks` : 'Unassigned'}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900 capitalize">
                        {obs.test_name.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 font-bold font-mono text-slate-900">
                        {obs.value_text || `${obs.value_numeric} ${obs.unit || ''}`}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={obs.is_abnormal ? 'danger' : 'success'}
                          className="text-[10px]"
                        >
                          {obs.is_abnormal ? 'ABNORMAL' : 'NORMAL'}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 capitalize">
                          {obs.source_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Observation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record New Clinical Observation"
        subtitle="Manually add validated clinician or patient observations"
        maxWidth="md"
      >
        <form onSubmit={handleCreateObservation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Observation Category</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              >
                <option value="blood_pressure">Blood Pressure</option>
                <option value="laboratory">Laboratory</option>
                <option value="vital_signs">Vital Signs</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Test Name</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                required
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Numeric Value</label>
              <input
                type="number"
                step="0.1"
                value={valueNum}
                onChange={(e) => setValueNum(parseFloat(e.target.value) || 0)}
                required
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Gestational Age at Measurement (Weeks)</label>
            <input
              type="number"
              step="0.1"
              value={gaInput}
              onChange={(e) => setGaInput(parseFloat(e.target.value) || 28)}
              min="10"
              max="45"
              required
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Record Observation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
