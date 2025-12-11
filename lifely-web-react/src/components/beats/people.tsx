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
  if (people.length === 0) return null;

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="people-heading"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="people-heading" className="text-2xl font-semibold text-text-primary mb-2">
            The ones who showed up
          </h2>
          <p className="text-[15px] text-text-secondary">
            Your top friends with venues & neighborhoods
          </p>
        </div>

        {/* People cards */}
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
      </div>
    </section>
  );
});

People.displayName = 'People';

function PersonCard({ person, index, delay }: { person: Person; index: number; delay: number }) {
  const initial = person.name.charAt(0).toUpperCase();
  const gradients = [
    'from-accent-cyan to-accent-green',
    'from-accent-magenta to-accent-warm',
    'from-accent-green to-accent-cyan',
    'from-accent-warm to-accent-magenta',
    'from-accent-cyan to-accent-magenta',
  ];

  return (
    <div
      className="bg-bg-card border border-border-default rounded-xl p-4 hover:border-border-accent hover:shadow-glow transition-all duration-300 reveal-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className={cn(
            "flex-none w-13 h-13 rounded-xl flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br",
            gradients[index % gradients.length]
          )}
        >
          {initial}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name and meta */}
          <p className="text-lg font-medium text-text-primary">{person.name}</p>
          <p className="text-[15px] text-text-secondary">
            {person.count} moments · {Math.round(person.hours)} hours
          </p>

          {/* Venues */}
          {person.venues.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {person.venues.map((venue) => (
                <Chip key={venue} variant="accent">{venue}</Chip>
              ))}
            </div>
          )}

          {/* Neighborhoods */}
          {person.neighborhoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {person.neighborhoods.map((hood) => (
                <Chip key={hood}>{hood}</Chip>
              ))}
            </div>
          )}

          {/* Sparkbar */}
          <Sparkbar
            percentage={person.percentage}
            className="mt-3"
            delay={delay + 300}
          />
        </div>
      </div>
    </div>
  );
}
