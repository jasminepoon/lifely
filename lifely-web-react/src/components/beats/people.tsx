import { forwardRef } from 'react';
import type { Person } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Sparkbar } from '@/components/ui/sparkbar';
import { Chip } from '@/components/ui/chip';

interface PeopleProps {
  people: Person[];
  className?: string;
}

export const People = forwardRef<HTMLDivElement, PeopleProps>(({ people, className }, ref) => {
  const hasPeople = people.length > 0;

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
      aria-labelledby="people-heading"
    >
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="people-heading" className="text-2xl font-semibold text-white mb-2">
            The ones who showed up
          </h2>
          <p className="text-[15px] text-gray-400">
            Your top friends with venues & neighborhoods
          </p>
        </div>

        {/* People cards */}
        {hasPeople ? (
          <div className="space-y-4">
            {people.map((person, index) => (
              <PersonCard
                key={person.name}
                person={person}
                index={index}
                delay={index * 80}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 reveal-up">
            <p className="text-[15px] text-gray-500">
              No people data available for this year.
            </p>
          </div>
        )}
      </div>
    </section>
  );
});

People.displayName = 'People';

const GRADIENT_STYLES = [
  'linear-gradient(135deg, #00D4FF 0%, #00FF88 100%)',
  'linear-gradient(135deg, #FF00FF 0%, #FF6B6B 100%)',
  'linear-gradient(135deg, #00FF88 0%, #00D4FF 100%)',
  'linear-gradient(135deg, #FF6B6B 0%, #FF00FF 100%)',
  'linear-gradient(135deg, #00D4FF 0%, #FF00FF 100%)',
];

function PersonCard({ person, index, delay }: { person: Person; index: number; delay: number }) {
  const initial = person.name.charAt(0).toUpperCase();

  return (
    <div
      className="reveal-up"
      style={{
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.75rem',
        padding: '1rem',
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', gap: '1rem' }}>
        {/* Avatar */}
        <div
          style={{
            flexShrink: 0,
            width: '3.25rem',
            height: '3.25rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'white',
            background: GRADIENT_STYLES[index % GRADIENT_STYLES.length],
          }}
        >
          {initial}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name and meta */}
          <p style={{ fontSize: '1.125rem', fontWeight: 500, color: 'white' }}>{person.name}</p>
          <p style={{ fontSize: '15px', color: '#9ca3af' }}>
            {person.count} moments · {Math.round(person.hours)} hours
          </p>

          {/* Venues */}
          {person.venues.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
              {person.venues.map((venue) => (
                <Chip key={venue} variant="accent">{venue}</Chip>
              ))}
            </div>
          )}

          {/* Neighborhoods */}
          {person.neighborhoods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
              {person.neighborhoods.map((hood) => (
                <Chip key={hood}>{hood}</Chip>
              ))}
            </div>
          )}

          {/* Sparkbar */}
          <Sparkbar
            percentage={person.percentage}
            style={{ marginTop: '0.75rem' }}
            delay={delay + 300}
          />
        </div>
      </div>
    </div>
  );
}
