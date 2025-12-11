import { cn } from '@/lib/utils';

interface SparkbarProps {
  percentage: number;
  className?: string;
  delay?: number;
}

export function Sparkbar({ percentage, className, delay = 0 }: SparkbarProps) {
  return (
    <div className={cn("h-1.5 bg-bg-elevated rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-gradient-to-r from-accent-cyan to-accent-cyan/60 rounded-full sparkbar"
        style={{
          width: `${percentage}%`,
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}
