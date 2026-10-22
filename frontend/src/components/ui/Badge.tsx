import React from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md' | 'lg' | string;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-sky-50 text-sky-700 border-sky-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const sizeStyles: Record<string, string> = {
    sm: 'text-[10px] px-2 py-0.2',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${currentSize} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
