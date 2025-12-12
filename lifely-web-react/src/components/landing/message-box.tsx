import { cn } from '@/lib/utils'

interface MessageBoxProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function MessageBox({ title, children, className }: MessageBoxProps) {
  return (
    <div className={cn(
      "w-full max-w-sm bg-gray-900 border border-white/10 rounded-xl p-6 text-center reveal-up",
      className
    )}>
      <p className="text-xl font-semibold text-white mb-2">{title}</p>
      <div className="text-gray-400 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}
