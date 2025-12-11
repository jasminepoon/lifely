import { cn } from '@/lib/utils';

interface BarRowProps {
  label: string;
  value: number;
  maxValue: number;
  delay?: number;
  className?: string;
}

export function BarRow({ label, value, maxValue, delay = 0, className }: BarRowProps) {
  const percentage = Math.round((value / maxValue) * 100);

  return (
    <div className={cn("grid grid-cols-[140px_1fr_44px] gap-3 items-center", className)}>
      <span className="text-[15px] text-text-primary truncate">{label}</span>
      <div className="h-2.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-cyan to-accent-green rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
      <span className="text-[15px] text-text-secondary tabular-nums text-right">{value}</span>
    </div>
  );
}
