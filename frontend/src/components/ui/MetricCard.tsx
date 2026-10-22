import React from 'react';
import { Badge, BadgeVariant } from './Badge';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  secondary?: string;
  statusBadge?: {
    text: string;
    variant: BadgeVariant;
  };
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  secondary,
  statusBadge,
  icon,
  trend,
  className = '',
}) => {
  return (
    <div className={`glass-panel p-5 rounded-2xl shadow-xs hover:shadow-md transition-all ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-mono">{value}</span>
        {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
        {secondary ? (
          <span className="text-xs text-slate-500 truncate">{secondary}</span>
        ) : <span />}

        {statusBadge && (
          <Badge variant={statusBadge.variant} className="text-[11px]">
            {statusBadge.text}
          </Badge>
        )}

        {trend && (
          <span className={`text-xs font-medium flex items-center gap-1 ${
            trend.direction === 'up' ? 'text-amber-600' : trend.direction === 'down' ? 'text-sky-600' : 'text-slate-500'
          }`}>
            {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};
