import { cn } from '@/lib/utils';

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent';
  className?: string;
}

export function Chip({ children, variant = 'default', className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        variant === 'default' && "bg-bg-elevated text-text-secondary",
        variant === 'accent' && "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30",
        className
      )}
    >
      {children}
    </span>
  );
}
