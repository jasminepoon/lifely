import { cn } from '@/lib/utils'

interface ProgressDotsProps {
  total?: number
  active?: number
  className?: string
}

export function ProgressDots({ total = 5, active = 0, className }: ProgressDotsProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full transition-all duration-300",
            i < active
              ? "bg-accent-cyan scale-100"
              : "bg-text-muted/40 scale-75"
          )}
        />
      ))}
    </div>
  )
}
