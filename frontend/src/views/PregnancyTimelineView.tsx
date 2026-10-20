import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, TimelineEvent } from '../api/client';
import {
  Clock,
  FileText,
  Activity,
  TrendingUp,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PregnancyTimelineView: React.FC = () => {
  const { selectedPatient, selectedPatientId } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    if (!selectedPatientId) return;
    const loadTimeline = async () => {
      setLoading(true);
      try {
        const data = await api.getPatientTimeline(selectedPatientId);
        setEvents(data.events || []);
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTimeline();
  }, [selectedPatientId]);

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'ALL') return true;
    return ev.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <span className="text-xs font-mono text-[#5BE7E8] uppercase tracking-wider block">
            LONGITUDINAL PREGNANCY RECORD
          </span>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">
            Chronological Maternal Journey & History
          </h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Every clinical event, report upload, laboratory test, and model prediction in exact temporal order.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#101A2B] rounded-xl border border-[rgba(166,190,220,0.18)]">
          {['ALL', 'CLINICAL_OBSERVATION', 'DOCUMENT_UPLOAD', 'RISK_PREDICTION'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                filterType === f
                  ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30 shadow-sm'
                  : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
              }`}
            >
              {f === 'ALL'
                ? 'All Events'
                : f === 'CLINICAL_OBSERVATION'
                ? 'Observations'
                : f === 'DOCUMENT_UPLOAD'
                ? 'Reports'
                : 'Predictions'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="glass-panel p-6 rounded-2xl relative">
        {/* Continuous technical spine */}
        <div className="absolute left-10 top-12 bottom-12 w-0.5 bg-gradient-to-b from-[#5BE7E8]/40 via-[rgba(166,190,220,0.2)] to-transparent" />

        <div className="space-y-6 relative">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A5B3C8]">No events recorded for this filter.</div>
          ) : (
            filteredEvents.map((ev, idx) => (
              <div key={idx} className="flex items-start gap-6 group">
                {/* Node Icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-lg transition-transform group-hover:scale-110 ${
                    ev.type === 'DOCUMENT_UPLOAD'
                      ? 'bg-[#101A2B] border-[#5BE7E8] text-[#5BE7E8]'
                      : ev.type === 'RISK_PREDICTION'
                      ? 'bg-[#142137] border-[#E9B96E] text-[#E9B96E]'
                      : 'bg-[#0B1220] border-[#43D6B0] text-[#43D6B0]'
                  }`}
                >
                  {ev.type === 'DOCUMENT_UPLOAD' ? (
                    <FileText className="w-4 h-4" />
                  ) : ev.type === 'RISK_PREDICTION' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                </div>

                {/* Event Content Card */}
                <div
                  onClick={() => {
                    if (ev.type === 'DOCUMENT_UPLOAD') {
                      navigate(`/medical-records/${ev.id}`);
                    } else if (ev.type === 'RISK_PREDICTION') {
                      navigate('/risk-forecast');
                    } else {
                      navigate('/observations');
                    }
                  }}
                  className="flex-1 glass-panel-elevated p-4 rounded-xl cursor-pointer hover:border-[#5BE7E8]/40 transition-all"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-[#A5B3C8] flex items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-[#5BE7E8]" />
                      {new Date(ev.timestamp).toLocaleDateString()} at{' '}
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        ev.type === 'DOCUMENT_UPLOAD'
                          ? 'bg-[#5BE7E8]/10 text-[#5BE7E8]'
                          : ev.type === 'RISK_PREDICTION'
                          ? 'bg-[#E9B96E]/15 text-[#E9B96E]'
                          : 'bg-[#43D6B0]/10 text-[#43D6B0]'
                      }`}
                    >
                      {ev.type.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#F4F7FC]">{ev.title}</h4>
                  <p className="text-xs text-[#A5B3C8] mt-1 leading-relaxed">{ev.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
