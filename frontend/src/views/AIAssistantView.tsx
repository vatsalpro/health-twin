import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, AIChatResponse, AIChatMessageItem, DoctorSlot } from '../api/client';
import { CraneDoctorMascot, MascotExpression } from '../components/CraneDoctorMascot';
import {
  Send,
  Sparkles,
  ShieldAlert,
  PhoneCall,
  Calendar,
  Pill,
  Clock,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  User as UserIcon,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  intentCategory?: string;
  isEmergency?: boolean;
  emergencyInstructions?: string;
  mascotExpression?: MascotExpression;
  groundingSources?: string[];
  doctorSlots?: DoctorSlot[];
  actionTaken?: any;
  createdAt: string;
}

export const AIAssistantView: React.FC = () => {
  const { user, selectedPatient, selectedPatientId } = useAuth();
  const navigate = useNavigate();
  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [mascotExpression, setMascotExpression] = useState<MascotExpression>('friendly');
  const [mascotState, setMascotState] = useState<'idle' | 'speaking' | 'thinking' | 'alert'>('idle');
  const [bookingSlotLoading, setBookingSlotLoading] = useState<string | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  // Clinician Transcript Oversight State
  const [clinicianSelectedPatientId, setClinicianSelectedPatientId] = useState<string>(
    selectedPatientId || ''
  );
  const [clinicianHistory, setClinicianHistory] = useState<AIChatMessageItem[]>([]);
  const [clinicianLoadingHistory, setClinicianLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (!clinicianSelectedPatientId && selectedPatientId) {
      setClinicianSelectedPatientId(selectedPatientId);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    if (!isClinician || !clinicianSelectedPatientId) return;
    const fetchClinicianHistory = async () => {
      setClinicianLoadingHistory(true);
      try {
        const hist = await api.getAIAssistantHistory(clinicianSelectedPatientId, 50);
        setClinicianHistory(hist || []);
      } catch (err) {
        console.error('Failed to load clinician transcript:', err);
      } finally {
        setClinicianLoadingHistory(false);
      }
    };
    fetchClinicianHistory();
  }, [isClinician, clinicianSelectedPatientId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectivePatientId = user?.role === 'patient' ? (user.patient_id || selectedPatientId) : selectedPatientId;

  // Load chat history on mount or patient switch
  useEffect(() => {
    if (!effectivePatientId || isClinician) return;

    const loadHistory = async () => {
      try {
        const history: AIChatMessageItem[] = await api.getAIAssistantHistory(effectivePatientId, 40);
        if (history && history.length > 0) {
          const mapped: ChatMessage[] = history.map((item) => ({
            id: item.id,
            role: item.role,
            message: item.message,
            intentCategory: item.intent_category,
            isEmergency: item.is_emergency,
            mascotExpression: (item.mascot_expression as MascotExpression) || 'friendly',
            groundingSources: item.grounding_sources,
            createdAt: item.created_at,
          }));
          setMessages(mapped);
          const lastMsg = mapped[mapped.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.mascotExpression) {
            setMascotExpression(lastMsg.mascotExpression);
          }
        } else {
          // Default greeting
          const patientName = selectedPatient ? selectedPatient.first_name : 'there';
          const defaultGreeting: ChatMessage = {
            id: 'init-greeting',
            role: 'assistant',
            message: `Hello ${patientName}! I'm Dr. Crane, your AI medical assistant. I'm here to help you understand your doctor-approved care plan, prescriptions, upcoming appointments, and pregnancy measurements. How can I assist you today?`,
            intentCategory: 'greeting',
            isEmergency: false,
            mascotExpression: 'friendly',
            groundingSources: ['PregTwin Clinician Care Coordination'],
            createdAt: new Date().toISOString(),
          };
          setMessages([defaultGreeting]);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadHistory();
  }, [effectivePatientId, isClinician]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || !effectivePatientId || loading) return;

    setInputValue('');
    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      message: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setMascotState('thinking');

    try {
      const resp: AIChatResponse = await api.chatWithAIAssistant({
        patient_id: effectivePatientId,
        message: text,
      });

      const isBooked = Boolean(resp.action_taken?.appointment_booked);
      const expression = isBooked
        ? 'encouraging'
        : ((resp.mascot_expression as MascotExpression) || 'friendly');
      setMascotExpression(expression);
      setMascotState(resp.is_emergency ? 'alert' : 'speaking');

      if (isBooked && resp.action_taken) {
        setBookingSuccessMsg(
          `Confirmed: Consultation scheduled with ${resp.action_taken.doctor_name || 'Dr. Elena Vance'} for ${resp.action_taken.formatted_date} at ${resp.action_taken.formatted_time}.`
        );
      }

      const assistantMsg: ChatMessage = {
        id: resp.id || resp.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        message: resp.assistant_reply,
        intentCategory: resp.intent_category,
        isEmergency: resp.is_emergency,
        emergencyInstructions: resp.emergency_instructions,
        mascotExpression: expression,
        groundingSources: resp.grounding_sources,
        doctorSlots: resp.doctor_slots || resp.suggested_slots,
        actionTaken: resp.action_taken,
        createdAt: resp.created_at || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Reset speaking animation after 3.5 seconds
      setTimeout(() => {
        setMascotState(resp.is_emergency ? 'alert' : 'idle');
      }, 3500);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        message:
          'I apologize, but I encountered an issue connecting to the clinical assistant service. Please check your connection or contact your care team directly.',
        mascotExpression: 'alert',
        isEmergency: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setMascotState('idle');
      setMascotExpression('caring');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleBookSlot = async (slot: DoctorSlot) => {
    if (!effectivePatientId) return;
    setBookingSlotLoading(slot.start_time);
    setBookingSuccessMsg(null);

    try {
      const appt = await api.bookAppointment({
        patient_id: effectivePatientId,
        doctor_id: slot.doctor_id,
        scheduled_start: slot.start_time,
        scheduled_end: slot.end_time,
        appointment_type: 'ROUTINE_PRENATAL',
        reason: 'Booked via Dr. Crane AI Assistant consultation',
        booked_via: 'AI_ASSISTANT',
      });

      const startIso = appt.scheduled_start || (appt as any).start_time || slot.start_time;
      const dateStr = slot.formatted_date || (appt as any).formatted_date || new Date(startIso).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = slot.formatted_time?.replace(/^0(\d:)/, '$1') || (appt as any).formatted_time || new Date(startIso).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      setBookingSuccessMsg(`Confirmed: Appointment scheduled with ${slot.doctor_name} on ${dateStr} at ${timeStr}.`);

      // Add system message into chat
      const confirmMsg: ChatMessage = {
        id: `conf-${Date.now()}`,
        role: 'system',
        message: `Appointment successfully booked with ${slot.doctor_name} for ${dateStr} at ${timeStr}. Your doctor has been notified.`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
      setMascotExpression('encouraging');
    } catch (err: any) {
      console.error('Booking failed:', err);
      alert(err.message || 'Failed to book slot. It may have been reserved. Please try another slot.');
    } finally {
      setBookingSlotLoading(null);
    }
  };

  const samplePrompts = [
    { label: 'Explain my prescribed medicine', prompt: 'What does my doctor mean by taking Labetalol twice daily?' },
    { label: 'Can I double missed dose?', prompt: 'Can I double my dose because I missed yesterday?' },
    { label: 'Book Dr. Vance appointment', prompt: 'Can I book an appointment with Dr. Vance next week?' },
    { label: 'Book appointment tomorrow 10am', prompt: 'Please book an appointment with Dr. Vance for tomorrow at 10 AM' },
    { label: 'Severe headache warning', prompt: 'I have a sudden severe pounding headache and blurry vision' },
    { label: 'Ask coding question (off-topic)', prompt: 'Write me a Python program to calculate fibonacci' },
  ];

  // Clinician Oversight View - Explaining that Dr. Crane is patient-facing
  if (isClinician) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        <div className="glass-panel p-8 text-center space-y-5 border border-purple-200 shadow-md">
          <div className="w-24 h-24 mx-auto p-2 rounded-2xl bg-gradient-to-b from-purple-100/60 to-white/80 border border-purple-200 shadow-xs flex items-center justify-center">
            <CraneDoctorMascot expression="friendly" size="lg" showBadge={false} />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
              Patient Guidance Agent
            </span>
            <h1 className="text-2xl font-black text-purple-950">
              Dr. Crane is Exclusively for Patients
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dr. Crane is designed for authenticated patients to explain their prescriptions, monitor adherence, and book appointments strictly based on your configured working schedule. Whenever a patient books a slot or reports a warning sign, Dr. Crane automatically notifies you.
            </p>
          </div>

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
            <div
              onClick={() => navigate('/appointments')}
              className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-purple-100 hover:border-purple-300 shadow-2xs cursor-pointer transition-all hover:scale-102"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-2">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">Manage Your Schedule</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Configure your weekly working hours and available appointment slots.
              </p>
            </div>

            <div
              onClick={() => navigate('/medications')}
              className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-purple-100 hover:border-purple-300 shadow-2xs cursor-pointer transition-all hover:scale-102"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
                <Pill className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">Prescribe Medications</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Select patient name and create approved medication orders with timing schedules.
              </p>
            </div>

            <div
              onClick={() => navigate('/clinician/review-queue')}
              className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-purple-100 hover:border-purple-300 shadow-2xs cursor-pointer transition-all hover:scale-102"
            >
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center mb-2">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">Review & Emergency Queue</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                View instant emergency alerts dispatched by Dr. Crane with a 15-min SLA.
              </p>
            </div>
          </div>
        </div>

        {/* Clinician Patient AI Chat Audit & Transcript Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-purple-200/90 shadow-sm space-y-4 text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-700" />
                <span>Patient Interaction Audit &amp; Clinical Transcript</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review recent patient questions, symptom reports, and grounded advice delivered by Dr. Crane.
              </p>
            </div>

            {/* Patient Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Subject:</span>
              <select
                value={clinicianSelectedPatientId}
                onChange={(e) => setClinicianSelectedPatientId(e.target.value)}
                className="text-xs font-semibold bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="23c60346-9c67-4ac8-910c-881a4a505df6">Maya Lin (MRN-PT-2026-001)</option>
                <option value="3efd45db-2ed0-4eac-b0d7-64e4e544116c">Sophia Reyes (MRN-PT-2026-002)</option>
                <option value="18113544-4d30-460a-b6aa-64e73a08a3f3">Clara Novak (MRN-PT-2026-003)</option>
              </select>
              <button
                type="button"
                onClick={async () => {
                  if (!clinicianSelectedPatientId) return;
                  setClinicianLoadingHistory(true);
                  try {
                    const hist = await api.getAIAssistantHistory(clinicianSelectedPatientId, 50);
                    setClinicianHistory(hist || []);
                  } finally {
                    setClinicianLoadingHistory(false);
                  }
                }}
                className="p-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs cursor-pointer"
                title="Refresh transcript"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transcript Messages List */}
          {clinicianLoadingHistory ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading patient AI dialogue history...
            </div>
          ) : clinicianHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              No recent Dr. Crane conversations recorded for this patient yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {clinicianHistory.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`p-3.5 rounded-xl text-xs space-y-1.5 border transition-all ${
                    item.role === 'user'
                      ? 'bg-purple-50/70 border-purple-200 text-slate-900 ml-6'
                      : item.is_emergency
                      ? 'bg-rose-50 border-rose-300 text-rose-950 mr-6 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-800 mr-6 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold flex items-center gap-1.5">
                      {item.role === 'user' ? (
                        <>
                          <UserIcon className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-purple-900">Patient Inquiry</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-indigo-900">Dr. Crane AI Guidance</span>
                        </>
                      )}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap text-[10px]">
                    {item.intent_category && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-100/80 text-purple-800 font-medium font-mono">
                        Intent: {item.intent_category}
                      </span>
                    )}
                    {item.is_emergency && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        EMERGENCY PROTOCOL ESCALATED
                      </span>
                    )}
                    {item.grounding_sources && item.grounding_sources.length > 0 && (
                      <span className="text-slate-500">
                        Sources: {item.grounding_sources.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Patient Interactive Chat View
  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Top Banner: Mascot & Identity */}
      <div className="glass-panel p-5 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5 border border-purple-200/90 shadow-[0_8px_30px_rgba(124,58,237,0.06)]">
        <div className="flex items-center gap-5 z-10">
          {/* 2D Crane Doctor Mascot */}
          <div className="shrink-0 p-2 rounded-2xl bg-gradient-to-b from-purple-100/50 to-white/70 border border-purple-200/80 shadow-xs">
            <CraneDoctorMascot
              expression={mascotExpression}
              state={mascotState}
              size="lg"
              showBadge={true}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-purple-950 tracking-tight">
                Dr. Crane AI Assistant
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                Clinician-Grounded
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              Dr. Crane is trained strictly on your verified antenatal records, clinician-approved medication schedules,
              and ACOG/ISSHP maternal health guidelines. He cannot prescribe or change doses independently.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-purple-700 font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Zero Hallucinated Prescriptions
              </span>
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                Instant 911 Escalation
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                Direct Doctor Booking
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Hotline Quick Access */}
        <div className="w-full md:w-auto shrink-0 flex flex-col items-center md:items-end gap-1.5 p-3 rounded-xl bg-red-50/70 border border-red-200/80 text-center md:text-right">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Maternal Emergency Hotline
          </span>
          <a
            href="tel:911"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-xs hover:scale-105 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call 911 / ER</span>
          </a>
          <span className="text-[9px] text-red-600">Immediate hospital triage for severe symptoms</span>
        </div>
      </div>

      {/* Booking feedback banner */}
      {bookingSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bookingSuccessMsg}</span>
          </div>
          <button
            onClick={() => setBookingSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="glass-panel p-4 sm:p-6 min-h-[440px] max-h-[580px] overflow-y-auto flex flex-col space-y-4 rounded-2xl border border-purple-200/80">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="w-full flex justify-center my-2">
                <div className="px-3.5 py-1.5 rounded-full bg-purple-50/90 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle className="w-3.5 h-3.5 text-purple-700" />
                  <span>{msg.message}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse self-end max-w-[85%]' : 'self-start max-w-[92%]'}`}
            >
              {/* Avatar */}
              {!isUser ? (
                <div className="shrink-0 mt-1">
                  <CraneDoctorMascot
                    expression={msg.mascotExpression || 'friendly'}
                    size="sm"
                    showBadge={false}
                  />
                </div>
              ) : (
                <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs mt-1">
                  {user?.full_name ? user.full_name[0] : 'U'}
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-purple-700 text-white shadow-xs'
                    : msg.isEmergency
                    ? 'bg-red-50 text-red-950 border-2 border-red-500 shadow-md animate-emergency-pulse'
                    : 'bg-white/85 backdrop-blur-md text-slate-800 border border-purple-100 shadow-2xs'
                }`}
              >
                {/* Emergency Header if triggered */}
                {msg.isEmergency && (
                  <div className="mb-3 p-2.5 rounded-xl bg-red-600 text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-white animate-bounce shrink-0" />
                      <div>
                        <p className="font-black text-xs tracking-wide uppercase">Critical Maternal Warning Sign</p>
                        <p className="text-[11px] text-red-100 font-medium">Doctor and triage team notified immediately</p>
                      </div>
                    </div>
                    <a
                      href="tel:911"
                      className="px-3 py-1 rounded-lg bg-white text-red-700 font-extrabold text-xs shadow-xs hover:bg-red-50"
                    >
                      Call 911
                    </a>
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap">{msg.message}</div>

                {/* Confirmed Appointment Card if AI booked a slot */}
                {msg.actionTaken?.appointment_booked && (
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        ✓ Consultation Confirmed
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Scheduled by Dr. Crane AI
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                      <div>
                        <p className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{msg.actionTaken.doctor_name || 'Dr. Elena Vance, MD'}</span>
                        </p>
                        <p className="text-[11px] text-emerald-800 font-medium mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {msg.actionTaken.formatted_date} at {msg.actionTaken.formatted_time}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/appointments')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all shrink-0"
                      >
                        View in Appointments &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* Interactive Doctor Slot Cards in Assistant Reply */}
                {msg.doctorSlots && msg.doctorSlots.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-purple-100 space-y-2">
                    <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      Available Doctor Consultation Slots (Based on Doctor's Schedule):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.doctorSlots.map((slot, idx) => {
                        const dateFormatted = slot.formatted_date || new Date(slot.start_time).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        });
                        const timeFormatted = slot.formatted_time?.replace(/^0(\d:)/, '$1') || new Date(slot.start_time).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        });
                        const isBookingThis = bookingSlotLoading === slot.start_time;

                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between gap-2 hover:bg-purple-100/70 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800">{slot.doctor_name}</p>
                              <p className="text-[11px] text-purple-700 font-medium">
                                {dateFormatted} &bull; {timeFormatted}
                              </p>
                            </div>
                            <button
                              disabled={isBookingThis}
                              onClick={() => handleBookSlot(slot)}
                              className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-bold shadow-xs hover:scale-105 transition-transform disabled:opacity-50"
                            >
                              {isBookingThis ? 'Booking...' : 'Book Slot'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grounding Citations Badge */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-purple-100/70 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-purple-900 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-purple-600" />
                      Sources:
                    </span>
                    {msg.groundingSources.map((source, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/80 font-medium"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[9px] mt-1.5 text-right ${
                    isUser ? 'text-purple-200' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-3 self-start">
            <CraneDoctorMascot expression="attentive" state="thinking" size="sm" showBadge={false} />
            <div className="p-3 rounded-2xl bg-white/80 border border-purple-100 shadow-2xs flex items-center gap-2 text-xs text-purple-800 font-semibold">
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1">Dr. Crane is verifying clinical records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          Suggested Clinical Inquiries
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {samplePrompts.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(item.prompt)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/70 hover:bg-purple-100/80 border border-purple-200/80 text-xs font-semibold text-purple-900 transition-all hover:scale-[1.02] active:scale-95 shadow-2xs disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field Bar */}
      <div className="glass-panel p-2 flex items-center gap-2 border border-purple-200/90 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
          disabled={loading}
          placeholder="Ask Dr. Crane about your medications, symptoms, measurements, or appointment booking..."
          className="flex-1 px-4 py-3 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim() || loading}
          className="px-5 py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
