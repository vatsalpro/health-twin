import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, TimelineEvent } from '../api/client';
import {
  FileText,
  Activity,
  TrendingUp,
  Calendar,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';

export const PregnancyTimelineView: React.FC = () => {
  const { selectedPatientId } = useAuth();
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

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'DOCUMENT_UPLOAD':
        return <Badge variant="primary">REPORT UPLOAD</Badge>;
      case 'RISK_PREDICTION':
        return <Badge variant="warning">RISK FORECAST</Badge>;
      case 'CLINICAL_OBSERVATION':
        return <Badge variant="success">OBSERVATION</Badge>;
      default:
        return <Badge variant="neutral">{type.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="LONGITUDINAL PREGNANCY RECORD"
        title="Chronological Maternal Journey & History"
        description="Every clinical event, report upload, laboratory test, and model prediction in exact temporal order."
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {['ALL', 'CLINICAL_OBSERVATION', 'DOCUMENT_UPLOAD', 'RISK_PREDICTION'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  filterType === f
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
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
        }
      />

      {/* Timeline Stream */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          {/* Continuous spine line */}
          <div className="absolute left-10 top-10 bottom-10 w-0.5 bg-slate-200" />

          <div className="space-y-6 relative">
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-500">Loading timeline events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No events recorded for the selected filter.
              </div>
            ) : (
              filteredEvents.map((ev, idx) => (
                <div key={idx} className="flex items-start gap-5 group">
                  {/* Node Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-sm transition-transform group-hover:scale-105 ${
                      ev.type === 'DOCUMENT_UPLOAD'
                        ? 'bg-sky-50 border-sky-300 text-sky-700'
                        : ev.type === 'RISK_PREDICTION'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700'
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
                    className="flex-1 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono text-slate-500 flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(ev.timestamp).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {getEventBadge(ev.type)}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                          {ev.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ev.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
