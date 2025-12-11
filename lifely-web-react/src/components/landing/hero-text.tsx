import { cn } from '@/lib/utils'

interface HeroTextProps {
  tagline?: string
  className?: string
}

export function HeroText({ tagline, className }: HeroTextProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-8xl md:text-9xl font-bold tracking-tighter text-gradient float">
        2025
      </h1>
      <p className="text-2xl md:text-3xl font-semibold tracking-[0.3em] text-text-secondary mt-2">
        WRAPPED
      </p>
      {tagline && (
        <p className="text-lg text-text-secondary mt-4 reveal-up" style={{ animationDelay: '200ms' }}>
          {tagline}
        </p>
      )}
    </div>
  )
}
