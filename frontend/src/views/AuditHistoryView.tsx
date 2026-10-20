import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { History, Shield, Calendar, UserCheck, RefreshCw } from 'lucide-react';

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl">
        <div>
          <span className="text-xs font-mono text-[#5BE7E8] uppercase tracking-wider block">
            REGULATORY & SECURITY AUDIT TRAIL
          </span>
          <h2 className="text-2xl font-bold text-[#F4F7FC] mt-1">System & Clinical Decision Audit Log</h2>
          <p className="text-xs text-[#A5B3C8] mt-0.5">
            Cryptographically sealed record of document access, clinical review decisions, and model evaluations.
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#142137] hover:bg-[#192a45] text-xs font-medium text-[#5BE7E8] border border-[rgba(166,190,220,0.18)] transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[rgba(166,190,220,0.14)] text-[10px] font-mono uppercase text-[#A5B3C8]">
                <th className="pb-3">Timestamp (UTC)</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Target Entity</th>
                <th className="pb-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(166,190,220,0.08)]">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-[#101A2B]/40 transition-colors">
                  <td className="py-3 font-mono text-[#A5B3C8]">
                    {new Date(ev.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="py-3 font-medium text-[#F4F7FC]">{ev.user_email || 'system'}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#5BE7E8]/10 text-[#5BE7E8]">
                      {ev.action}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[#A5B3C8]">
                    {ev.target_type ? `${ev.target_type} (${ev.target_id?.substring(0, 8)}...)` : '—'}
                  </td>
                  <td className="py-3 text-[#A5B3C8] font-mono text-[11px] truncate max-w-xs">
                    {JSON.stringify(ev.details || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
