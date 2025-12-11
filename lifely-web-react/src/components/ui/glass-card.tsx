import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'warm' | 'none'
}

export function GlassCard({ className, glow = 'none', children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-6",
        glow === 'cyan' && "glow-cyan",
        glow === 'warm' && "glow-warm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
