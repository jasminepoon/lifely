import { cn } from '@/lib/utils';

interface SparkbarProps {
  percentage: number;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}

export function Sparkbar({ percentage, className, style, delay = 0 }: SparkbarProps) {
  return (
    <div
      className={cn("sparkbar", className)}
      style={{
        height: '0.375rem',
        backgroundColor: '#1f2937',
        borderRadius: '9999px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: '9999px',
          width: `${percentage}%`,
          animationDelay: `${delay}ms`,
          background: 'linear-gradient(90deg, #00D4FF 0%, rgba(0, 212, 255, 0.6) 100%)',
        }}
      />
    </div>
  );
}
