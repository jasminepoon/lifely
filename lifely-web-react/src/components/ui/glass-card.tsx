import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'warm' | 'none'
}

export function GlassCard({ className, glow = 'none', children, style, ...props }: GlassCardProps) {
  return (
    <div
      className={cn("rounded-xl p-6", className)}
      style={{
        background: 'rgba(17, 24, 39, 0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        ...(glow === 'cyan' && { boxShadow: '0 0 30px rgba(0, 212, 255, 0.15)' }),
        ...(glow === 'warm' && { boxShadow: '0 0 30px rgba(255, 107, 107, 0.15)' }),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
