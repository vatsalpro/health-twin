import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { History, Shield, Calendar, UserCheck, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export const AuditHistoryView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditHistory(50, 0);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="REGULATORY & SECURITY AUDIT TRAIL"
        title="System & Clinical Decision Audit Log"
        description="Cryptographically sealed record of document access, clinical review decisions, and model evaluations."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadAudit}
            isLoading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Audit Trail
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Immutable Activity Records ({events.length})</CardTitle>
          <CardDescription>
            Chronological audit of sensitive clinical access and decision provenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-3">Timestamp (UTC)</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Target Entity</th>
                  <th className="py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Loading audit events...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {new Date(ev.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">{ev.user_email || 'system'}</td>
                      <td className="py-3 px-3">
                        <Badge variant="primary">{ev.action}</Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {ev.target_type ? `${ev.target_type} (${ev.target_id?.substring(0, 8)}...)` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-xs truncate max-w-xs">
                        {JSON.stringify(ev.details || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
