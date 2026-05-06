import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'bg-card border border-border',
    primary: 'bg-card border border-border shadow-sm',
    accent: 'bg-card border border-border',
    success: 'bg-card border border-border',
    warning: 'bg-card border border-border',
  };

  const iconVariants = {
    default: 'bg-muted/30 text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div className={cn(
      "rounded-xl p-5 card-hover min-h-[120px] flex flex-col justify-center",
      variants[variant]
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-semibold uppercase tracking-wider mb-2",
            "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-2xl font-display font-bold leading-tight truncate",
            variant === 'primary' ? 'text-white' : 'text-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              "text-[11px] mt-1",
              variant === 'primary' ? 'text-white/50' : 'text-muted-foreground/70'
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-sm font-medium mt-2",
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs mês anterior
            </p>
          )}
        </div>
        <div className={cn(
          "p-2.5 rounded-lg shrink-0",
          iconVariants[variant]
        )}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
