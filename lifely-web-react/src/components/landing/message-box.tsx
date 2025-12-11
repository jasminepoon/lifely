import { cn } from '@/lib/utils'

interface MessageBoxProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function MessageBox({ title, children, className }: MessageBoxProps) {
  return (
    <div className={cn(
      "w-full max-w-sm bg-bg-card border border-border-default rounded-xl p-6 text-center reveal-up",
      className
    )}>
      <p className="text-xl font-semibold text-text-primary mb-2">{title}</p>
      <div className="text-text-secondary text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}
