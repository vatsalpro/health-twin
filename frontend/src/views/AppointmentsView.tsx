import React, { useState, useEffect, useMemo } from 'react';
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
  const [statusCategory, setStatusCategory] = useState<'all' | 'scheduled' | 'rescheduled' | 'cancelled'>('all');
  const [clinicianFilterPatientId, setClinicianFilterPatientId] = useState<string>('ALL');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Real-time 1-second ticker for smooth countdown and auto-clearing after 2 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Safe UTC date parser to prevent local timezone offsets distorting cancelled_at
  const getUtcTimestamp = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    const normalized = clean.endsWith('Z') || clean.includes('+') || clean.match(/-\d{2}:\d{2}$/)
      ? clean
      : `${clean}Z`;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  // Filter out cancelled appointments older than 2 minutes (120 seconds)
  const activeAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (a.status !== 'CANCELLED') return true;
      const cancelTs = getUtcTimestamp(a.cancelled_at) ?? getUtcTimestamp(a.updated_at);
      if (cancelTs === null) {
        return true;
      }
      const elapsedMs = currentTime - cancelTs;
      const safeElapsed = Math.max(0, elapsedMs);
      return safeElapsed < 2 * 60 * 1000;
    });
  }, [appointments, currentTime]);

  const scheduledAppts = useMemo(() =>
    activeAppointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED'),
    [activeAppointments]
  );
  const rescheduledAppts = useMemo(() =>
    activeAppointments.filter((a) => a.status === 'RESCHEDULED'),
    [activeAppointments]
  );
  const cancelledAppts = useMemo(() =>
    activeAppointments.filter((a) => a.status === 'CANCELLED'),
    [activeAppointments]
  );
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

  // Correct doctor user ID: For clinician it's user.id; for patient it's Dr. Elena Vance
  const doctorUserId = isClinician && user?.id ? user.id : '4f85f958-d7eb-4a1a-a292-b15760c3a073';

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const patientQueryId = isClinician
        ? (clinicianFilterPatientId !== 'ALL' ? clinicianFilterPatientId : undefined)
        : (effectivePatientId || undefined);
      const doctorQueryId = isClinician ? user?.id : undefined;

      const list = await api.getAppointments(patientQueryId, doctorQueryId);
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
  }, [effectivePatientId, isClinician, clinicianFilterPatientId]);

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
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        appointment_type: appointmentType,
        reason: reason.trim() || 'Routine prenatal consultation',
        booked_via: isClinician ? 'CLINICIAN_FOLLOWUP' : 'UI_WEB',
        booking_channel: isClinician ? 'clinician_followup' : 'ui_web',
      });

      setBookModalOpen(false);
      setReason('');
      setSelectedSlot(null);
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
        rescheduleReason.trim() || 'Patient requested reschedule'
      );

      setRescheduleModalAppt(null);
      setSelectedRescheduleSlot(null);
      setRescheduleReason('');
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
      await api.cancelAppointment(
        cancelModalAppt.id,
        cancelReason.trim() || 'Patient requested cancellation'
      );
      setCancelModalAppt(null);
      setCancelReason('');
      await fetchAppointments();
      // Ensure the user immediately sees the cancelled appointment for the 2-minute window
      if (statusCategory === 'scheduled') {
        setStatusCategory('all');
      }
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

  /**
   * Formats a 24-hour time string ("09:00", "17:00") into a clean 12-hour AM/PM string ("9:00 AM", "5:00 PM").
   */
  const formatTime12h = (timeStr?: string): string => {
    if (!timeStr) return '--:--';
    const clean = timeStr.trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) {
      let hr = parseInt(m[1], 10);
      const min = m[2];
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12;
      if (hr === 0) hr = 12;
      return `${hr}:${min} ${ampm}`;
    }
    const ampmM = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (ampmM) {
      let hr = parseInt(ampmM[1], 10);
      return `${hr}:${ampmM[2]} ${ampmM[3].toUpperCase()}`;
    }
    return clean;
  };

  /**
   * Returns formatted 12-hour AM/PM slot time for UI buttons, preventing timezone offset bugs.
   */
  const getSlotDisplayTime = (slot: DoctorSlot): string => {
    if (slot.formatted_time) {
      return slot.formatted_time.replace(/^0(\d:)/, '$1');
    }
    if (slot.start_time) {
      const d = new Date(slot.start_time);
      if (!isNaN(d.getTime())) {
        const utcHr = d.getUTCHours();
        const utcMin = d.getUTCMinutes().toString().padStart(2, '0');
        const ampm = utcHr >= 12 ? 'PM' : 'AM';
        let hr12 = utcHr % 12;
        if (hr12 === 0) hr12 = 12;
        return `${hr12}:${utcMin} ${ampm}`;
      }
    }
    return '--:--';
  };

  const formatDateTime = (isoStr?: string, formattedTimeFallback?: string, formattedDateFallback?: string) => {
    if (formattedTimeFallback && formattedDateFallback) {
      return { date: formattedDateFallback, time: formattedTimeFallback };
    }
    if (!isoStr) return { date: formattedDateFallback || 'Date not set', time: formattedTimeFallback || '--:--' };
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { date: formattedDateFallback || 'Date not set', time: formattedTimeFallback || '--:--' };

    let timeStr = formattedTimeFallback;
    if (!timeStr) {
      if (isoStr.endsWith('Z') || isoStr.includes('+00:00')) {
        const utcHr = d.getUTCHours();
        const utcMin = d.getUTCMinutes().toString().padStart(2, '0');
        const ampm = utcHr >= 12 ? 'PM' : 'AM';
        let hr12 = utcHr % 12;
        if (hr12 === 0) hr12 = 12;
        timeStr = `${hr12}:${utcMin} ${ampm}`;
      } else {
        timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }

    const dateStr = formattedDateFallback || (
      (isoStr.endsWith('Z') || isoStr.includes('+00:00'))
        ? d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    );

    return {
      date: dateStr,
      time: timeStr,
    };
  };

  const renderAppointmentCard = (appt: Appointment) => {
    const startIso = appt.scheduled_start || (appt as any).start_time;
    const endIso = appt.scheduled_end || (appt as any).end_time || startIso;
    const startDt = formatDateTime(startIso, appt.formatted_time, appt.formatted_date);
    const endDt = formatDateTime(endIso);
    const isPast = endIso ? new Date(endIso).getTime() < Date.now() : false;
    const isCancelled = appt.status === 'CANCELLED';
    const isRescheduled = appt.status === 'RESCHEDULED';
    const isCraneBooked =
      (appt.booked_via || (appt as any).booking_channel)?.toUpperCase() === 'AI_ASSISTANT';

    return (
      <div
        key={appt.id}
        className={`glass-panel p-5 relative overflow-hidden flex flex-col justify-between border transition-all ${
          isCancelled
            ? 'border-red-200/60 bg-red-50/20 opacity-80'
            : isRescheduled
            ? 'border-blue-200/90 bg-blue-50/25 shadow-xs'
            : 'border-purple-200/90 hover:border-purple-300'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 ${
                  appt.status === 'CONFIRMED' || appt.status === 'SCHEDULED'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : isRescheduled
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : isCancelled
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isRescheduled && <RotateCcw className="w-2.5 h-2.5" />}
                {isCancelled && <XCircle className="w-2.5 h-2.5" />}
                {appt.status}
              </span>
              {isCancelled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 animate-pulse">
                  <Clock className="w-2.5 h-2.5" />
                  Auto-clears in {Math.max(0, Math.ceil((120000 - Math.max(0, currentTime - (getUtcTimestamp(appt.cancelled_at) ?? currentTime))) / 1000))}s
                </span>
              )}
              {isPast && !isCancelled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Completed / Past
                </span>
              )}
            </div>

            <span className="text-[10px] font-semibold text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
              <Sparkles className="w-3 h-3 text-purple-600" />
              {isCraneBooked ? 'Booked via Dr. Crane AI' : 'Doctor Schedule Booking'}
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

          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isCancelled
                ? 'bg-red-50/50 border-red-100'
                : isRescheduled
                ? 'bg-blue-50/60 border-blue-100'
                : 'bg-purple-50/50 border-purple-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon
                className={`w-4 h-4 shrink-0 ${
                  isCancelled ? 'text-red-600' : isRescheduled ? 'text-blue-600' : 'text-purple-600'
                }`}
              />
              <div>
                <p className="text-xs font-bold text-slate-800">{startDt.date}</p>
                <p
                  className={`text-[11px] font-mono font-semibold ${
                    isCancelled ? 'text-red-700 line-through' : isRescheduled ? 'text-blue-700' : 'text-purple-700'
                  }`}
                >
                  {startDt.time} &ndash; {endDt.time}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {appt.appointment_type.replace(/_/g, ' ')}
            </span>
          </div>

          {isCancelled && appt.cancellation_reason && (
            <p className="text-xs text-red-800 leading-relaxed bg-red-50/70 p-2 rounded-xl border border-red-200">
              <strong className="text-red-950 font-bold">Cancellation Reason:</strong> {appt.cancellation_reason}
            </p>
          )}

          {appt.reason && (
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">
                {isCancelled ? 'Original Visit Purpose:' : isRescheduled ? 'Reschedule Note / Reason:' : 'Reason:'}
              </strong>{' '}
              {appt.reason}
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
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                          {formatTime12h(day.start_time)} &ndash; {formatTime12h(day.end_time)}
                        </span>
                        {day.end_time && day.start_time && day.end_time <= day.start_time && (
                          <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            End time is AM ({formatTime12h(day.end_time)}). For afternoon PM, use 24h format (e.g. 17:00 for 5:00 PM).
                          </span>
                        )}
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
        <div className="space-y-6">
          {/* Top Status & Category Filter Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-purple-950 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <span>Doctor Consultations & Visits</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isClinician
                  ? 'Track your scheduled, rescheduled, and cancelled patient consultations.'
                  : 'View and manage your scheduled, rescheduled, and cancelled consultations with Dr. Vance.'}
              </p>
            </div>

            {/* Clinician Patient Filter & Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {isClinician && allPatients && allPatients.length > 0 && (
                <div className="flex items-center gap-1.5 p-1 bg-purple-50/80 rounded-xl border border-purple-200 mr-1">
                  <span className="text-[11px] font-bold text-purple-900 pl-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-purple-700" />
                    Patient:
                  </span>
                  <select
                    value={clinicianFilterPatientId}
                    onChange={(e) => setClinicianFilterPatientId(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-purple-200 bg-white text-xs font-bold text-purple-950 focus:ring-purple-500 shadow-2xs"
                  >
                    <option value="ALL">All Patients (Practice Overview)</option>
                    {allPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStatusCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'all'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>All</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusCategory === 'all' ? 'bg-purple-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {activeAppointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusCategory('scheduled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'scheduled'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white border border-purple-200 text-purple-900 hover:bg-purple-50'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scheduled</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusCategory === 'scheduled' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {scheduledAppts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusCategory('rescheduled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'rescheduled'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-blue-200 text-blue-900 hover:bg-blue-50'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                <span>Rescheduled</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusCategory === 'rescheduled' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {rescheduledAppts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusCategory('cancelled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'cancelled'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white border border-red-200 text-red-900 hover:bg-red-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span>Cancelled</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusCategory === 'cancelled' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {cancelledAppts.length}
                </span>
              </button>
            </div>
          </div>

          {/* Prominent Cancelled Consultation Banner (2-Minute Grace Window) */}
          {cancelledAppts.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-purple-500/10 border-2 border-red-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 mt-0.5 shadow-2xs">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-red-950 uppercase tracking-wide">
                      Cancelled Consultation Notice
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                      {cancelledAppts.length} active in 2-minute grace window
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">
                    <strong className="text-slate-900 font-bold">{cancelledAppts[0].doctor_name || 'Dr. Elena Vance'}</strong>
                    {cancelledAppts[0].patient_name && <span> with <strong className="text-slate-900 font-bold">{cancelledAppts[0].patient_name}</strong></span>} on{' '}
                    <strong className="text-purple-950 font-bold">{formatDateTime(cancelledAppts[0].scheduled_start || cancelledAppts[0].start_time, cancelledAppts[0].formatted_time, cancelledAppts[0].formatted_date).date}</strong> at{' '}
                    <strong className="text-purple-950 font-bold">{formatDateTime(cancelledAppts[0].scheduled_start || cancelledAppts[0].start_time, cancelledAppts[0].formatted_time, cancelledAppts[0].formatted_date).time}</strong>
                    {cancelledAppts[0].cancellation_reason && (
                      <span className="text-red-700 font-medium"> &bull; Reason: &ldquo;{cancelledAppts[0].cancellation_reason}&rdquo;</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                    <span>Auto-clearing permanently from schedule in </span>
                    <strong className="text-red-700 font-bold">
                      {Math.max(0, Math.ceil((120000 - Math.max(0, currentTime - (getUtcTimestamp(cancelledAppts[0].cancelled_at) ?? currentTime))) / 1000))}s
                    </strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusCategory('cancelled')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusCategory === 'cancelled'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'bg-white border border-red-200 text-red-800 hover:bg-red-50'
                  }`}
                >
                  Switch to This Filter
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-xs">Loading consultations...</span>
            </div>
          ) : activeAppointments.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 text-purple-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No appointments found</p>
              <p className="text-xs text-slate-400 mt-1">
                Patients can schedule prenatal reviews through Dr. Crane AI or via the Book Consultation button above.
              </p>
            </div>
          ) : statusCategory === 'scheduled' ? (
            /* Single Category: Scheduled */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Scheduled Appointments ({scheduledAppts.length})
                </h3>
              </div>
              {scheduledAppts.length === 0 ? (
                <div className="p-6 rounded-2xl bg-purple-50/40 border border-purple-100 text-center text-slate-500 text-xs">
                  No active scheduled appointments at this time.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scheduledAppts.map(renderAppointmentCard)}
                </div>
              )}
            </div>
          ) : statusCategory === 'rescheduled' ? (
            /* Single Category: Rescheduled */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                  Rescheduled Appointments ({rescheduledAppts.length})
                </h3>
              </div>
              {rescheduledAppts.length === 0 ? (
                <div className="p-6 rounded-2xl bg-blue-50/40 border border-blue-100 text-center text-slate-500 text-xs">
                  No appointments have been rescheduled.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rescheduledAppts.map(renderAppointmentCard)}
                </div>
              )}
            </div>
          ) : statusCategory === 'cancelled' ? (
            /* Single Category: Cancelled */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Cancelled Appointments ({cancelledAppts.length})
                </h3>
              </div>
              {cancelledAppts.length === 0 ? (
                <div className="p-6 rounded-2xl bg-red-50/40 border border-red-100 text-center text-slate-500 text-xs">
                  No cancelled appointments.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cancelledAppts.map(renderAppointmentCard)}
                </div>
              )}
            </div>
          ) : (
            /* "All" View: Divided into 3 Distinct Categories */
            <div className="space-y-8">
              {/* Category 1: Scheduled */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                  <h3 className="text-sm font-extrabold text-purple-950 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Scheduled Consultations</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {scheduledAppts.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Upcoming confirmed visits
                  </span>
                </div>
                {scheduledAppts.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-purple-50/40 border border-purple-100 text-center text-slate-500 text-xs">
                    No active scheduled consultations.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scheduledAppts.map(renderAppointmentCard)}
                  </div>
                )}
              </div>

              {/* Category 2: Rescheduled */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <h3 className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    <span>Rescheduled Consultations</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {rescheduledAppts.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Adjusted consultation dates & times
                  </span>
                </div>
                {rescheduledAppts.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 text-center text-slate-500 text-xs">
                    No rescheduled consultations.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rescheduledAppts.map(renderAppointmentCard)}
                  </div>
                )}
              </div>

              {/* Category 3: Cancelled */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-red-100">
                  <h3 className="text-sm font-extrabold text-red-950 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Cancelled Consultations</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                      {cancelledAppts.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Withdrawn or cancelled appointments
                  </span>
                </div>
                {cancelledAppts.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-red-50/40 border border-red-100 text-center text-slate-500 text-xs">
                    No cancelled consultations.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cancelledAppts.map(renderAppointmentCard)}
                  </div>
                )}
              </div>
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
                      const timeStr = getSlotDisplayTime(s);
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
                      const timeStr = getSlotDisplayTime(s);
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
          <div className="glass-panel-elevated bg-white/95 max-w-md w-full p-6 rounded-3xl border border-red-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-red-950">Cancel Consultation?</h3>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200 space-y-1.5 text-xs">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-700" />
                <span>{cancelModalAppt.doctor_name || 'Dr. Elena Vance, MD'}</span>
                {cancelModalAppt.patient_name && (
                  <span className="text-slate-500 font-normal">&bull; Patient: {cancelModalAppt.patient_name}</span>
                )}
              </p>
              <p className="font-medium text-purple-950 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {formatDateTime(cancelModalAppt.scheduled_start || cancelModalAppt.start_time, cancelModalAppt.formatted_time, cancelModalAppt.formatted_date).date} &bull;{' '}
                  {formatDateTime(cancelModalAppt.scheduled_start || cancelModalAppt.start_time, cancelModalAppt.formatted_time, cancelModalAppt.formatted_date).time}
                </span>
              </p>
              {cancelModalAppt.reason && (
                <p className="text-slate-600">
                  <strong>Visit Reason:</strong> {cancelModalAppt.reason}
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-600 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 flex items-start gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>2-Minute Confirmation Window:</strong> Once cancelled, this appointment will remain displayed in your list for 2 minutes with an animated countdown badge before being automatically cleared from the schedule.
              </span>
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for cancellation (optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule conflict, feeling better, need later date"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelModalAppt(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
