import { cn } from '@/lib/utils'

interface HeroTextProps {
  tagline?: string
  className?: string
}

export function HeroText({ tagline, className }: HeroTextProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1
        className="text-8xl md:text-9xl font-bold tracking-tighter float"
        style={{
          background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        2025
      </h1>
      <p className="text-2xl md:text-3xl font-semibold tracking-[0.3em] text-gray-400 mt-2">
        WRAPPED
      </p>
      {tagline && (
        <p className="text-lg text-gray-400 mt-4 reveal-up" style={{ animationDelay: '200ms' }}>
          {tagline}
        </p>
      )}
    </div>
  )
}
