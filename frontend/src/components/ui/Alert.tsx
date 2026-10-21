import React from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

export type AlertType = 'info' | 'warning' | 'danger' | 'success';

export interface AlertProps {
  type?: AlertType;
  variant?: AlertType | string;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  variant,
  title,
  description,
  children,
  icon,
  action,
  className = '',
}) => {
  const resolvedType = (type || variant || 'info') as AlertType;

  const typeConfig: Record<AlertType, { container: string; text: string; defaultIcon: React.ReactNode }> = {
    info: {
      container: 'bg-sky-50 border-sky-200 text-sky-900',
      text: 'text-sky-800',
      defaultIcon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      text: 'text-amber-800',
      defaultIcon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    danger: {
      container: 'bg-rose-50 border-rose-200 text-rose-900',
      text: 'text-rose-800',
      defaultIcon: <XCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      text: 'text-emerald-800',
      defaultIcon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    },
  };

  const config = typeConfig[resolvedType] || typeConfig.info;

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${config.container} ${className}`}>
      <div className="mt-0.5">{icon || config.defaultIcon}</div>
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-1">{title}</h5>}
        {description && <div className={config.text}>{description}</div>}
        {children && <div className={config.text}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
