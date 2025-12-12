import { forwardRef } from 'react';
import type { PlacesData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarRow } from '@/components/ui/bar-row';
import { Chip } from '@/components/ui/chip';

interface PlacesProps {
  data: PlacesData;
  className?: string;
}

const CUISINE_EMOJIS: Record<string, string> = {
  japanese: '🍜',
  korean: '🍚',
  chinese: '🥡',
  american: '🍔',
  italian: '🍝',
  mexican: '🌮',
  thai: '🍛',
  indian: '🍛',
  vietnamese: '🍜',
  seafood: '🦐',
  default: '🍴',
};

export const Places = forwardRef<HTMLDivElement, PlacesProps>(({ data, className }, ref) => {
  const hasNeighborhoods = data.neighborhoods.length > 0;
  const maxNeighborhood = data.neighborhoods[0]?.[1] || 1;

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
      aria-labelledby="places-heading"
    >
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="places-heading" className="text-2xl font-semibold text-white mb-2">
            Your footprint
          </h2>
          <p className="text-[15px] text-gray-400">
            Where you spent your year
          </p>
        </div>

        {/* Neighborhoods */}
        <div
          className="reveal-up"
          style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          {hasNeighborhoods ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.neighborhoods.map(([hood, count], index) => (
                <BarRow
                  key={hood}
                  label={hood}
                  value={count}
                  maxValue={maxNeighborhood}
                  delay={index * 50}
                />
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-gray-500">
              No place summary yet. Retry AI to fill this in.
            </p>
          )}

          {/* Cuisines */}
          {data.cuisines.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>Top cuisines</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {data.cuisines.slice(0, 4).map(([cuisine, count], index) => {
                  const emoji = CUISINE_EMOJIS[cuisine.toLowerCase()] || CUISINE_EMOJIS.default;
                  return (
                    <Chip
                      key={cuisine}
                      variant={index < 3 ? 'accent' : 'default'}
                    >
                      {emoji} {cuisine} · {count}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

Places.displayName = 'Places';
