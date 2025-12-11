import { forwardRef } from 'react';
import { useCountup } from '@/hooks/use-countup';
import type { HeroData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface HeroProps {
  data: HeroData;
  className?: string;
}

export const Hero = forwardRef<HTMLDivElement, HeroProps>(({ data, className }, ref) => {
  const events = useCountup({ end: data.totalEvents, duration: 1000, delay: 200 });
  const hours = useCountup({ end: data.totalHours, duration: 1000, delay: 400 });
  const people = useCountup({ end: data.totalPeople, duration: 1000, delay: 600 });

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="hero-heading"
    >
      <div className="w-full max-w-lg glass rounded-2xl p-8 glow-cyan reveal-up">
        {/* Eyebrow */}
        <p className="text-xs text-text-muted uppercase tracking-[0.15em] mb-6">
          {data.year} Wrapped
        </p>

        {/* Year */}
        <h1 id="hero-heading" className="sr-only">Your {data.year} Wrapped</h1>
        <p className="text-7xl md:text-8xl font-bold text-gradient tracking-tight mb-4 float">
          {data.year}
        </p>

        {/* Subtitle */}
        <p className="text-lg text-text-secondary mb-8">
          Your year in <span className="text-text-primary font-semibold">{data.totalEvents}</span> moments
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard value={events.value} label="Events" delay={0} />
          <StatCard value={hours.value.toLocaleString()} label="Hours" delay={100} />
          <StatCard value={people.value} label="People" delay={200} />
        </div>

        {/* Busiest info */}
        <div className="mt-6 pt-6 border-t border-border-default flex justify-between text-sm">
          <div>
            <span className="text-text-muted">Busiest month</span>
            <p className="text-text-primary font-medium">{data.busiestMonth}</p>
          </div>
          <div className="text-right">
            <span className="text-text-muted">Busiest day</span>
            <p className="text-text-primary font-medium">{data.busiestDay}</p>
          </div>
        </div>
      </div>
    </section>
  );
});

Hero.displayName = 'Hero';

function StatCard({ value, label, delay }: { value: number | string; label: string; delay: number }) {
  return (
    <div
      className="bg-bg-elevated rounded-xl p-4 text-center reveal-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums">
        {value}
      </p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}
