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
    primary: 'gradient-chocolate text-primary-foreground',
    accent: 'bg-accent text-accent-foreground',
    success: 'bg-success/10 border border-success/20',
    warning: 'bg-warning/10 border border-warning/20',
  };

  const iconVariants = {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-white/20 text-white',
    accent: 'bg-white/30 text-accent-foreground',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
  };

  return (
    <div className={cn(
      "rounded-xl p-5 card-hover shadow-sm min-h-[120px] flex flex-col justify-center",
      variants[variant]
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-medium uppercase tracking-wide mb-1.5",
            variant === 'primary' ? 'text-white/70' : 'text-muted-foreground'
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
