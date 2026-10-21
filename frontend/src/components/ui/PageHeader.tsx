import React from 'react';
import { Badge } from './Badge';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  badge,
  actions,
  className = '',
}) => {
  const displaySubtitle = subtitle || description;

  const renderBadge = () => {
    if (!badge) return null;
    if (typeof badge === 'string') {
      return <Badge variant="primary">{badge}</Badge>;
    }
    return badge;
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 mb-6 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {renderBadge()}
        </div>
        {displaySubtitle && <p className="text-sm text-slate-500 mt-1">{displaySubtitle}</p>}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
