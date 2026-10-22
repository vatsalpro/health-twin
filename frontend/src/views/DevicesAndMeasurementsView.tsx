import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, DeviceConnection, DeviceMeasurement } from '../api/client';
import {
  Cpu,
  Plus,
  Battery,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Bluetooth,
  Cloud,
  Activity,
  HeartPulse,
  Thermometer,
  Scale,
  Apple,
  Moon,
  Info,
  Calendar,
  Layers,
  FileCode,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';

type MeasurementFormType =
  | 'blood_pressure'
  | 'pulse_oximetry'
  | 'blood_glucose'
  | 'temperature'
  | 'weight'
  | 'wearable_vitals';

export const DevicesAndMeasurementsView: React.FC = () => {
  const { selectedPatientId } = useAuth();
  const [devices, setDevices] = useState<DeviceConnection[]>([]);
  const [measurements, setMeasurements] = useState<DeviceMeasurement[]>([]);
  const [specs, setSpecs] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Modal State
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showSpecsModal, setShowSpecsModal] = useState<boolean>(false);
  const [formType, setFormType] = useState<MeasurementFormType>('blood_pressure');

  // Manual Form States
  // BP
  const [formSbp, setFormSbp] = useState<number>(120);
  const [formDbp, setFormDbp] = useState<number>(80);
  const [formBpPulse, setFormBpPulse] = useState<number>(75);
  const [formPosition, setFormPosition] = useState<string>('sitting');

  // SpO2
  const [formSpo2, setFormSpo2] = useState<number>(98);
  const [formPulseOxRate, setFormPulseOxRate] = useState<number>(76);

  // Glucose
  const [formGlucose, setFormGlucose] = useState<number>(95);
  const [formGlucoseUnit, setFormGlucoseUnit] = useState<string>('mg/dL');
  const [formMealContext, setFormMealContext] = useState<string>('fasting');

  // Temperature (Independent)
  const [formTemp, setFormTemp] = useState<number>(36.8);
  const [formTempUnit, setFormTempUnit] = useState<string>('°C');

  // Weight (Independent)
  const [formWeight, setFormWeight] = useState<number>(68.5);
  const [formWeightUnit, setFormWeightUnit] = useState<string>('kg');

  // Wearables
  const [formSleep, setFormSleep] = useState<number>(7.5);
  const [formHrv, setFormHrv] = useState<number>(42);
  const [formWearableHr, setFormWearableHr] = useState<number>(68);

  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const [devList, measList, specData] = await Promise.all([
        api.getDevices(selectedPatientId),
        api.getMeasurements(selectedPatientId, { limit: 60 }),
        api.getDeviceSpecs(selectedPatientId),
      ]);
      setDevices(devList || []);
      setMeasurements(measList || []);
      setSpecs(specData);
    } catch (err) {
      console.error('Failed to load devices/measurements:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleConnectDevice = async (dev: DeviceConnection) => {
    if (!selectedPatientId) return;
    try {
      if (dev.connection_status === 'connected') {
        await api.disconnectMockDevice(selectedPatientId, dev.id);
        showToast('success', `Device '${dev.model_name}' disconnected.`);
      } else {
        await api.connectMockDevice(selectedPatientId, dev.id);
        showToast('success', `Device '${dev.model_name}' connected successfully.`);
      }
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Connection toggle failed.');
    }
  };

  const handleGenerateReadings = async (devId: string, count = 2) => {
    if (!selectedPatientId) return;
    setSyncingDeviceId(devId);
    try {
      const res = await api.generateMockReadings(selectedPatientId, devId, count);
      showToast('success', res.message || `Ingested ${count} simulated readings.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Telemetry generation failed.');
    } finally {
      setSyncingDeviceId(null);
    }
  };

  // Submit Manual Form
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setSubmitting(true);

    try {
      const timestamp = new Date().toISOString();
      let payload: any = {
        patient_id: selectedPatientId,
        source_type: 'manual',
        measurement_timestamp: timestamp,
      };

      if (formType === 'blood_pressure') {
        if (formSbp <= formDbp) {
          throw new Error('Systolic blood pressure must be greater than diastolic blood pressure.');
        }
        payload = {
          ...payload,
          measurement_type: 'blood_pressure',
          value_numeric: formSbp,
          value_secondary: formDbp,
          value_text: `${formSbp}/${formDbp} mmHg`,
          unit: 'mmHg',
          context_data: { pulse: formBpPulse, position: formPosition, notes: formNotes },
        };
      } else if (formType === 'pulse_oximetry') {
        payload = {
          ...payload,
          measurement_type: 'pulse_oximetry',
          value_numeric: formSpo2,
          value_secondary: formPulseOxRate,
          value_text: `${formSpo2}% SpO2`,
          unit: '%',
          context_data: { pulse_bpm: formPulseOxRate, notes: formNotes },
        };
      } else if (formType === 'blood_glucose') {
        payload = {
          ...payload,
          measurement_type: 'blood_glucose',
          value_numeric: formGlucose,
          value_text: `${formGlucose} ${formGlucoseUnit}`,
          unit: formGlucoseUnit,
          context_data: { meal_context: formMealContext, notes: formNotes },
        };
      } else if (formType === 'temperature') {
        payload = {
          ...payload,
          measurement_type: 'temperature',
          value_numeric: formTemp,
          value_text: `${formTemp} ${formTempUnit}`,
          unit: formTempUnit.includes('F') ? 'F' : 'degC',
          context_data: { notes: formNotes },
        };
      } else if (formType === 'weight') {
        payload = {
          ...payload,
          measurement_type: 'weight',
          value_numeric: formWeight,
          value_text: `${formWeight} ${formWeightUnit}`,
          unit: formWeightUnit,
          context_data: { notes: formNotes },
        };
      } else if (formType === 'wearable_vitals') {
        payload = {
          ...payload,
          measurement_type: 'wearable_vitals',
          value_numeric: formWearableHr,
          value_secondary: formHrv,
          value_text: `${formWearableHr} bpm`,
          unit: 'bpm',
          context_data: { hrv_rmssd_ms: formHrv, sleep_hours: formSleep, notes: formNotes },
        };
      }

      await api.createMeasurement(selectedPatientId, payload);
      showToast('success', `${formType.replace('_', ' ')} recorded successfully as first-class measurement.`);
      setShowManualModal(false);
      setFormNotes('');
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMeasurements = useMemo(() => {
    return measurements.filter((m) => {
      if (typeFilter !== 'all' && m.measurement_type !== typeFilter) return false;
      if (sourceFilter !== 'all' && m.source_type !== sourceFilter) return false;
      return true;
    });
  }, [measurements, typeFilter, sourceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 uppercase tracking-wide">
            <Cpu className="w-4 h-4" />
            <span>Maternal IoT & Sensor Telemetry Hub</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Measurements & Connected Sensors</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Ingest manual vitals, continuous streams, and mock medical hardware with verified unit conversion.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSpecsModal(true)}
          >
            <FileCode className="w-4 h-4 text-slate-600" />
            <span>Integration Specs</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowManualModal(true)}
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Record Manual Vital</span>
          </Button>
        </div>
      </div>

      {notification && (
        <Alert type={notification.type === 'success' ? 'success' : 'danger'}>
          {notification.message}
        </Alert>
      )}

      {/* Connected Devices Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Connected Medical Devices & Wearables</h3>
            <p className="text-xs text-slate-500">Live mock connectors for Omron BP, Masimo PulseOx, Dexcom CGM, and Oura Ring</p>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            {devices.filter((d) => d.connection_status === 'connected').length} Active Devices
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {devices.map((dev) => {
            const isConnected = dev.connection_status === 'connected';
            const isSyncing = syncingDeviceId === dev.id;

            return (
              <Card key={dev.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                      {dev.manufacturer}
                    </span>
                    <Badge variant={isConnected ? 'success' : 'neutral'}>
                      {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{dev.model_name}</h4>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">
                    {dev.device_type.replace('_', ' ')}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5 text-slate-400" />
                      {dev.battery_percentage || 90}%
                    </span>
                    <span className="flex items-center gap-1">
                      {dev.connection_protocol === 'bluetooth_ble' ? (
                        <Bluetooth className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5 text-teal-600" />
                      )}
                      <span className="capitalize">{dev.connection_protocol?.replace('_', ' ') || 'BLE'}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <Button
                    variant={isConnected ? 'outline' : 'secondary'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handleConnectDevice(dev)}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Button>

                  {isConnected && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGenerateReadings(dev.id, 2)}
                      isLoading={isSyncing}
                      title="Generate synthetic telemetry packet"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Measurement History & Longitudinal Feed */}
      <Card>
        <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Longitudinal Measurement History</CardTitle>
            <CardDescription>
              Chronological log of verified clinical vital signs and multi-sensor records ({filteredMeasurements.length} records)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="blood_pressure">Blood Pressure</option>
              <option value="pulse_oximetry">Pulse Oximetry</option>
              <option value="blood_glucose">Blood Glucose</option>
              <option value="temperature">Temperature</option>
              <option value="weight">Weight</option>
              <option value="wearable_vitals">Wearable Vitals</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual Entry</option>
              <option value="mock_device">Mock Device</option>
              <option value="bluetooth_ble">Bluetooth (BLE)</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredMeasurements.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <p>No measurement records match the selected filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                    <th className="pb-2.5">Recorded At</th>
                    <th className="pb-2.5">Domain</th>
                    <th className="pb-2.5">Measurement Value</th>
                    <th className="pb-2.5">Data Source</th>
                    <th className="pb-2.5">Quality Status</th>
                    <th className="pb-2.5">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMeasurements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono text-slate-700">
                        {new Date(m.measurement_timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 capitalize font-medium text-slate-900">
                        {m.measurement_type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 font-bold font-mono text-slate-900">
                        {m.value_text || `${m.value_numeric} ${m.unit}`}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 capitalize">
                          {m.source_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            m.quality_status === 'VALID'
                              ? 'success'
                              : m.quality_status === 'ALERT_ELEVATED'
                              ? 'danger'
                              : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {m.quality_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">
                        {((m.confidence || 1.0) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Record Clinical Vital Sign"
        subtitle="Save first-class measurement with immediate Living Twin synchronization"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitManual} className="space-y-4">
          {/* Measurement Type Selector Tabs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'blood_pressure', label: 'Blood Pres.', icon: HeartPulse },
              { id: 'pulse_oximetry', label: 'SpO2', icon: Activity },
              { id: 'blood_glucose', label: 'Glucose', icon: Apple },
              { id: 'temperature', label: 'Temperature', icon: Thermometer },
              { id: 'weight', label: 'Weight', icon: Scale },
              { id: 'wearable_vitals', label: 'Wearable', icon: Moon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = formType === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setFormType(tab.id as MeasurementFormType)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content: Blood Pressure */}
          {formType === 'blood_pressure' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={formSbp}
                    onChange={(e) => setFormSbp(parseInt(e.target.value) || 120)}
                    min="70"
                    max="240"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={formDbp}
                    onChange={(e) => setFormDbp(parseInt(e.target.value) || 80)}
                    min="40"
                    max="160"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    value={formBpPulse}
                    onChange={(e) => setFormBpPulse(parseInt(e.target.value) || 75)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Body Posture</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="sitting">Sitting (Standard)</option>
                    <option value="left_lateral">Left Lateral Recumbent</option>
                    <option value="supine">Supine</option>
                    <option value="standing">Standing</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Form Content: Pulse Oximetry */}
          {formType === 'pulse_oximetry' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">SpO2 Percentage (%)</label>
                  <input
                    type="number"
                    value={formSpo2}
                    onChange={(e) => setFormSpo2(parseInt(e.target.value) || 98)}
                    min="70"
                    max="100"
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Pulse Rate (bpm)</label>
                  <input
                    type="number"
                    value={formPulseOxRate}
                    onChange={(e) => setFormPulseOxRate(parseInt(e.target.value) || 76)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Content: Blood Glucose */}
          {formType === 'blood_glucose' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Glucose Level</label>
                  <input
                    type="number"
                    value={formGlucose}
                    onChange={(e) => setFormGlucose(parseFloat(e.target.value) || 90)}
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Concentration Unit</label>
                  <select
                    value={formGlucoseUnit}
                    onChange={(e) => setFormGlucoseUnit(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="mg/dL">mg/dL (Standard US)</option>
                    <option value="mmol/L">mmol/L (Standard SI)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Meal / Test Context</label>
                <select
                  value={formMealContext}
                  onChange={(e) => setFormMealContext(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="fasting">Fasting Plasma (Overnight)</option>
                  <option value="1hr_postprandial">1-Hour Postprandial</option>
                  <option value="2hr_postprandial">2-Hour Postprandial</option>
                  <option value="random">Random Blood Glucose</option>
                </select>
              </div>
            </div>
          )}

          {/* Form Content: Body Temperature (SEPARATE) */}
          {formType === 'temperature' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Body Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTemp}
                    onChange={(e) => setFormTemp(parseFloat(e.target.value) || 36.8)}
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Scale Unit</label>
                  <select
                    value={formTempUnit}
                    onChange={(e) => setFormTempUnit(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="°C">°C (Celsius)</option>
                    <option value="°F">°F (Fahrenheit)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Independent physiological vital record. Normal range: 36.0°C – 37.5°C (96.8°F – 99.5°F).
              </p>
            </div>
          )}

          {/* Form Content: Weight (SEPARATE) */}
          {formType === 'weight' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Maternal Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWeight}
                    onChange={(e) => setFormWeight(parseFloat(e.target.value) || 68.5)}
                    required
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Mass Unit</label>
                  <select
                    value={formWeightUnit}
                    onChange={(e) => setFormWeightUnit(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="lbs">lbs (Pounds)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Tracked as a first-class measurement queryable in independent gestational weight charts.
              </p>
            </div>
          )}

          {/* Form Content: Wearable Vitals */}
          {formType === 'wearable_vitals' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Resting HR (bpm)</label>
                  <input
                    type="number"
                    value={formWearableHr}
                    onChange={(e) => setFormWearableHr(parseInt(e.target.value) || 68)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">HRV rMSSD (ms)</label>
                  <input
                    type="number"
                    value={formHrv}
                    onChange={(e) => setFormHrv(parseInt(e.target.value) || 42)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Sleep Duration (hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formSleep}
                    onChange={(e) => setFormSleep(parseFloat(e.target.value) || 7.5)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Clinician / Patient Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Context Notes (Optional)</label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Post-exercise, morning measurement"
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowManualModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Save Vital Sign
            </Button>
          </div>
        </form>
      </Modal>

      {/* Integration Specifications Modal */}
      <Modal
        isOpen={showSpecsModal}
        onClose={() => setShowSpecsModal(false)}
        title="Physical Device Integration Specifications"
        subtitle="Clinical deployment schemas for direct Bluetooth GATT, Vendor APIs, and Apple HealthKit"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <Bluetooth className="w-4 h-4 text-sky-600" />
              1. Direct Bluetooth Low Energy (BLE) GATT Architecture
            </h4>
            <p className="text-slate-600 leading-relaxed mb-2">
              Devices connect via standardized Bluetooth SIG profiles directly to the Web Bluetooth API:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 font-mono text-[11px]">
              <li><strong>Blood Pressure Profile:</strong> Service UUID <code>0x1810</code>, Characteristic <code>0x2A35</code></li>
              <li><strong>Pulse Oximeter Profile:</strong> Service UUID <code>0x1822</code>, Characteristic <code>0x2A5E</code></li>
              <li><strong>Continuous Glucose (CGM):</strong> Service UUID <code>0x1808</code>, Characteristic <code>0x2A18</code></li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-teal-600" />
              2. Vendor Cloud OAuth 2.0 Webhook Gateways
            </h4>
            <p className="text-slate-600 leading-relaxed">
              For continuous wearable ecosystems (Dexcom G7, Oura Ring Gen 3, Withings Health), PregTwin integrates via server-to-server OAuth 2.0 webhooks with SHA-256 signature verification.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              3. Apple HealthKit & Android Health Connect
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Mobile sync utilizes native bridges (<code>HKQuantityTypeIdentifierBloodPressureSystolic</code> and <code>androidx.health.connect</code>) ensuring local on-device encryption.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
