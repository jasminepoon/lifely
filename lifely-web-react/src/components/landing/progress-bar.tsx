import { cn } from '@/lib/utils'

interface ProgressBarProps {
  progress: number
  className?: string
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        "relative h-2 w-full max-w-xs rounded-full bg-gray-800 overflow-hidden",
        className
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full sparkbar transition-all duration-500 ease-out"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)',
        }}
      />
    </div>
  )
}
