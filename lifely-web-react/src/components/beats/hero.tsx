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
      className={cn("h-screen px-4 py-16", className)}
      style={{
        minWidth: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        scrollSnapAlign: 'start',
        flexShrink: 0,
      }}
      aria-labelledby="hero-heading"
    >
      <div
        className="rounded-2xl p-6 md:p-8 reveal-up"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(17, 24, 39, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 0 30px rgba(0, 212, 255, 0.15)',
        }}
      >
        {/* Eyebrow */}
        <p className="text-xs uppercase tracking-[0.15em] mb-4 text-gray-400">
          {data.year} Wrapped
        </p>

        {/* Year - using inline gradient style for reliability */}
        <h1 id="hero-heading" className="sr-only">Your {data.year} Wrapped</h1>
        <p
          className="text-6xl md:text-7xl font-bold tracking-tight mb-4"
          style={{
            background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {data.year}
        </p>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-gray-400 mb-6 whitespace-nowrap">
          Your year in <span className="text-white font-semibold">{data.totalEvents}</span> moments
        </p>

        {/* Stats grid - using explicit flex for reliability */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <StatCard value={events.value} label="Events" delay={0} />
          <StatCard value={hours.value.toLocaleString()} label="Hours" delay={100} />
          <StatCard value={people.value} label="People" delay={200} />
        </div>

        {/* Busiest info */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <div>
            <span style={{ color: '#6b7280', display: 'block' }}>Busiest month</span>
            <p style={{ color: 'white', fontWeight: 500 }}>{data.busiestMonth}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#6b7280', display: 'block' }}>Busiest day</span>
            <p style={{ color: 'white', fontWeight: 500 }}>{data.busiestDay}</p>
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
      className="reveal-up"
      style={{
        flex: 1,
        backgroundColor: 'rgba(31, 41, 55, 0.5)',
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        textAlign: 'center',
        animationDelay: `${delay}ms`,
      }}
    >
      <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{label}</p>
    </div>
  );
}
