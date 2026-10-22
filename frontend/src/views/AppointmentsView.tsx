import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Appointment, DoctorSlot, DoctorScheduleDay } from '../api/client';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Video,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  RotateCcw,
  ShieldAlert,
  ChevronRight,
  Filter,
  Settings,
  Save,
  Sparkles,
} from 'lucide-react';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultDays: DoctorScheduleDay[] = [
  { day_of_week: 0, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
  { day_of_week: 1, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
  { day_of_week: 2, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
  { day_of_week: 3, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
  { day_of_week: 4, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30, is_active: true },
  { day_of_week: 5, start_time: '10:00', end_time: '14:00', slot_duration_minutes: 30, is_active: false },
  { day_of_week: 6, start_time: '10:00', end_time: '14:00', slot_duration_minutes: 30, is_active: false },
];

export const AppointmentsView: React.FC = () => {
  const { user, selectedPatient, selectedPatientId, allPatients } = useAuth();
  const isClinician = user?.role === 'clinician' || user?.role === 'admin';
  const effectivePatientId = user?.role === 'patient' ? (user.patient_id || selectedPatientId) : selectedPatientId;

  const [activeTab, setActiveTab] = useState<'appointments' | 'schedule'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [followupPatientId, setFollowupPatientId] = useState<string>(
    selectedPatientId || (allPatients && allPatients.length > 0 ? allPatients[0].id : '')
  );
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<Appointment | null>(null);
  const [cancelModalAppt, setCancelModalAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Doctor Schedule Form State
  const [scheduleDays, setScheduleDays] = useState<DoctorScheduleDay[]>(defaultDays);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  // Booking Form State
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<DoctorSlot | null>(null);
  const [appointmentType, setAppointmentType] = useState('ROUTINE_PRENATAL');
  const [reason, setReason] = useState('Routine prenatal blood pressure review');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Reschedule Form State
  const [rescheduleSlots, setRescheduleSlots] = useState<DoctorSlot[]>([]);
  const [rescheduleDate, setRescheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<DoctorSlot | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState('Patient schedule adjustment');
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  const doctorUserId = user?.id || '4f85f958-d7eb-4a1a-a292-b15760c3a073';

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const list = await api.getAppointments(
        effectivePatientId || undefined,
        isClinician ? user?.id : undefined
      );
      setAppointments(list);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorSchedule = async () => {
    if (!isClinician || !user?.id) return;
    try {
      const existing = await api.getDoctorAvailability(user.id);
      if (existing && existing.length > 0) {
        // Merge with full 7-day template
        const merged = defaultDays.map((d) => {
          const found = existing.find((e) => e.day_of_week === d.day_of_week);
          return found ? { ...d, ...found } : d;
        });
        setScheduleDays(merged);
      }
    } catch (err) {
      console.error('Failed to load doctor schedule:', err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    if (isClinician) {
      fetchDoctorSchedule();
    }
  }, [effectivePatientId, isClinician]);

  // Load slots when book modal or date changes
  useEffect(() => {
    if (!bookModalOpen) return;
    const loadSlots = async () => {
      setLoadingSlots(true);
      try {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const available = await api.getDoctorSlots(doctorUserId, selectedDate, nextDayStr);
        setSlots(available);
        setSelectedSlot(null);
      } catch (err) {
        console.error('Failed to load slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [bookModalOpen, selectedDate]);

  // Load reschedule slots
  useEffect(() => {
    if (!rescheduleModalAppt) return;
    const loadRescheduleSlots = async () => {
      setLoadingSlots(true);
      try {
        const nextDay = new Date(rescheduleDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const available = await api.getDoctorSlots(
          rescheduleModalAppt.doctor_id,
          rescheduleDate,
          nextDayStr
        );
        setRescheduleSlots(available);
        setSelectedRescheduleSlot(null);
      } catch (err) {
        console.error('Failed to load reschedule slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    loadRescheduleSlots();
  }, [rescheduleModalAppt, rescheduleDate]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPatientId = isClinician ? (followupPatientId || selectedPatientId) : effectivePatientId;
    if (!targetPatientId || !selectedSlot) {
      alert('Please select a patient and a consultation slot.');
      return;
    }

    setBookingLoading(true);
    try {
      await api.bookAppointment({
        patient_id: targetPatientId,
        doctor_id: selectedSlot.doctor_id,
        scheduled_start: selectedSlot.start_time,
        scheduled_end: selectedSlot.end_time,
        appointment_type: appointmentType,
        reason,
        booked_via: isClinician ? 'CLINICIAN_FOLLOWUP' : 'UI_WEB',
      });

      setBookModalOpen(false);
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Slot reservation failed. It may have been reserved concurrently.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalAppt || !selectedRescheduleSlot) return;

    setReschedulingLoading(true);
    try {
      await api.rescheduleAppointment(
        rescheduleModalAppt.id,
        selectedRescheduleSlot.start_time,
        selectedRescheduleSlot.end_time,
        rescheduleReason
      );

      setRescheduleModalAppt(null);
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Rescheduling failed.');
    } finally {
      setReschedulingLoading(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalAppt) return;

    try {
      await api.cancelAppointment(cancelModalAppt.id, cancelReason);
      setCancelModalAppt(null);
      setCancelReason('');
      await fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSavingSchedule(true);
    try {
      await api.saveDoctorAvailability(user.id, scheduleDays);
      setScheduleNotice('Working schedule successfully saved! Dr. Crane will generate patient booking slots strictly based on your configured hours.');
      setTimeout(() => setScheduleNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save doctor schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const updateDaySchedule = (dayIdx: number, field: keyof DoctorScheduleDay, value: any) => {
    setScheduleDays((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, [field]: value } : d))
    );
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return {
      date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-purple-950 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-purple-700" />
            <span>Doctor Appointments & Consultations</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Doctor availability scheduling, conflict-free booking, automated doctor notifications, and Dr. Crane AI coordination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Clinician Tab Toggle */}
          {isClinician && (
            <div className="flex items-center p-1 bg-purple-50/80 border border-purple-200/80 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'appointments'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100/70'
                }`}
              >
                Scheduled Visits
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'schedule'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100/70'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>My Working Schedule</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (isClinician && allPatients && allPatients.length > 0) {
                setFollowupPatientId(selectedPatientId || allPatients[0].id);
              }
              setBookModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isClinician ? 'Schedule Patient Follow-up' : 'Book Doctor Consultation'}</span>
          </button>
        </div>
      </div>

      {scheduleNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{scheduleNotice}</span>
        </div>
      )}

      {/* Clinician Schedule Builder Tab */}
      {isClinician && activeTab === 'schedule' ? (
        <div className="glass-panel p-6 rounded-3xl border border-purple-200 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-purple-100 pb-4">
            <div>
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                Clinician Practice Availability
              </span>
              <h2 className="text-lg font-black text-purple-950">
                Doctor Working Hours & Consultation Schedule
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure the days and hours you are available. Dr. Crane AI Assistant generates bookable patient slots strictly according to this schedule.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="divide-y divide-purple-100">
              {scheduleDays.map((day, idx) => (
                <div
                  key={day.day_of_week}
                  className={`py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    day.is_active ? 'bg-transparent' : 'opacity-60'
                  }`}
                >
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 w-40">
                    <input
                      type="checkbox"
                      id={`day-active-${idx}`}
                      checked={day.is_active}
                      onChange={(e) => updateDaySchedule(idx, 'is_active', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded-sm border-purple-300 focus:ring-purple-500"
                    />
                    <label htmlFor={`day-active-${idx}`} className="font-bold text-xs text-slate-800 cursor-pointer">
                      {dayNames[day.day_of_week]}
                    </label>
                  </div>

                  {/* Hours Configuration */}
                  {day.is_active ? (
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-semibold">Hours:</span>
                        <input
                          type="time"
                          value={day.start_time}
                          onChange={(e) => updateDaySchedule(idx, 'start_time', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                        />
                        <span className="text-slate-400">&ndash;</span>
                        <input
                          type="time"
                          value={day.end_time}
                          onChange={(e) => updateDaySchedule(idx, 'end_time', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-semibold">Slot:</span>
                        <select
                          value={day.slot_duration_minutes}
                          onChange={(e) => updateDaySchedule(idx, 'slot_duration_minutes', parseInt(e.target.value))}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="15">15 min</option>
                          <option value="20">20 min</option>
                          <option value="30">30 min (Default)</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Day Off (No consultation slots offered)</span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Changes apply immediately to Dr. Crane natural-language booking & UI slots.
              </span>
              <button
                type="submit"
                disabled={savingSchedule}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSchedule ? 'Saving...' : 'Save Doctor Schedule'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Appointments List Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-purple-950 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <span>Scheduled Consultations</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Appointments synced with Dr. Crane AI coordination
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-xs">Loading appointments...</span>
            </div>
          ) : appointments.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 text-purple-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No scheduled appointments</p>
              <p className="text-xs text-slate-400 mt-1">
                Patients can schedule prenatal reviews through Dr. Crane AI or via the Book button above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((appt) => {
                const startDt = formatDateTime(appt.scheduled_start);
                const endDt = formatDateTime(appt.scheduled_end);
                const isPast = new Date(appt.scheduled_end) < new Date();
                const isCancelled = appt.status === 'CANCELLED';

                return (
                  <div
                    key={appt.id}
                    className={`glass-panel p-5 relative overflow-hidden flex flex-col justify-between border ${
                      isCancelled
                        ? 'border-slate-200 bg-slate-50/50 opacity-70'
                        : 'border-purple-200/90'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                            appt.status === 'CONFIRMED' || appt.status === 'SCHEDULED'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : isCancelled
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {appt.status}
                        </span>

                        <span className="text-[10px] font-semibold text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          {appt.booked_via === 'AI_ASSISTANT' ? 'Booked via Dr. Crane AI' : 'Doctor Schedule Booking'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-purple-950 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-purple-700" />
                          <span>{appt.doctor_name || 'Dr. Elena Vance, MD'}</span>
                        </h3>
                        {appt.patient_name && (
                          <p className="text-xs font-semibold text-slate-600 mt-0.5">
                            Patient: <span className="text-purple-900 font-bold">{appt.patient_name}</span>
                          </p>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-purple-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800">{startDt.date}</p>
                            <p className="text-[11px] text-purple-700 font-mono font-semibold">
                              {startDt.time} &ndash; {endDt.time}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {appt.appointment_type.replace('_', ' ')}
                        </span>
                      </div>

                      {appt.reason && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong className="text-slate-800">Reason:</strong> {appt.reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {!isCancelled && !isPast && (
                      <div className="mt-4 pt-3 border-t border-purple-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setRescheduleModalAppt(appt)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-purple-700 hover:bg-purple-100/70 text-xs font-bold transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reschedule</span>
                        </button>
                        <button
                          onClick={() => setCancelModalAppt(appt)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Book Appointment / Schedule Follow-up Modal */}
      {bookModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-elevated bg-white/95 max-w-lg w-full max-h-[88vh] overflow-y-auto p-6 rounded-3xl border border-purple-200 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                  {isClinician ? 'Doctor Practice Scheduler' : 'Book Doctor Consultation'}
                </span>
                <h3 className="text-lg font-black text-purple-950">
                  {isClinician ? 'Schedule Patient Follow-up Visit' : 'Dr. Elena Vance, MD'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isClinician
                    ? 'Reserve a follow-up review slot for a patient on your active schedule'
                    : 'Maternal-Fetal Medicine Specialist'}
                </p>
              </div>
              <button
                onClick={() => setBookModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-3 text-xs">
              {/* Patient Selection for Clinicians */}
              {isClinician && (
                <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/90 space-y-1">
                  <label className="font-extrabold text-purple-950 block text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-700" />
                    Select Patient for Follow-up Visit
                  </label>
                  <select
                    value={followupPatientId}
                    onChange={(e) => setFollowupPatientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-white font-bold text-slate-900 shadow-2xs"
                  >
                    {allPatients && allPatients.length > 0 ? (
                      allPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name} (MRN: {p.mrn}) &bull; GA: {p.episodes?.[0]?.current_gestational_age_weeks || '30'}w
                        </option>
                      ))
                    ) : (
                      <option value={effectivePatientId || ''}>
                        {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Current Patient'}
                      </option>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Consultation Date</label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Available Slots (Based on Doctor's Active Schedule)
                </label>
                {loadingSlots ? (
                  <div className="py-6 text-center text-slate-400">
                    <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                    <span className="text-[11px]">Generating slots from doctor's schedule...</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 text-center text-slate-500">
                    No open consultation slots on this date according to the doctor's working schedule. Please choose another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                    {slots.map((s, idx) => {
                      const timeStr = new Date(s.start_time).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isSelected = selectedSlot?.start_time === s.start_time;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                              : 'bg-white border-purple-200/80 text-purple-950 hover:bg-purple-50'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Appointment Type</label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                >
                  <option value="ROUTINE_PRENATAL">Routine Prenatal Checkup</option>
                  <option value="URGENT_REVIEW">Urgent Clinical Blood Pressure Review</option>
                  <option value="TELEHEALTH">Telehealth Video Consultation</option>
                  <option value="POSTPARTUM_FOLLOWUP">Postpartum Follow-up</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason / Clinical Notes</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedSlot || bookingLoading}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {bookingLoading ? 'Reserving Slot...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-elevated bg-white/95 max-w-lg w-full p-6 rounded-3xl border border-purple-200 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                  Reschedule Appointment
                </span>
                <h3 className="text-base font-black text-purple-950">
                  Select New Consultation Slot
                </h3>
              </div>
              <button
                onClick={() => setRescheduleModalAppt(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">New Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Available Slots</label>
                {loadingSlots ? (
                  <div className="py-4 text-center text-slate-400">Loading slots...</div>
                ) : rescheduleSlots.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 text-center text-slate-500">
                    No open slots on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                    {rescheduleSlots.map((s, idx) => {
                      const timeStr = new Date(s.start_time).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isSelected = selectedRescheduleSlot?.start_time === s.start_time;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedRescheduleSlot(s)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-white border-purple-200/80 text-purple-950 hover:bg-purple-50'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Rescheduling</label>
                <input
                  type="text"
                  required
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedRescheduleSlot || reschedulingLoading}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {reschedulingLoading ? 'Updating...' : 'Save New Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalAppt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-elevated bg-white/95 max-w-sm w-full p-5 rounded-3xl border border-red-200 shadow-2xl space-y-3">
            <h3 className="text-base font-black text-red-950">Cancel Appointment?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this consultation with Dr. Vance?
            </p>
            <form onSubmit={handleCancelSubmit} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Reason for cancellation (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelModalAppt(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
