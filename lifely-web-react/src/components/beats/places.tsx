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
  if (data.neighborhoods.length === 0) return null;

  const maxNeighborhood = data.neighborhoods[0]?.[1] || 1;

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="places-heading"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="places-heading" className="text-2xl font-semibold text-text-primary mb-2">
            Your NYC footprint
          </h2>
          <p className="text-[15px] text-text-secondary">
            Where you spent your year
          </p>
        </div>

        {/* Neighborhoods */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6 reveal-up">
          <div className="space-y-3">
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

          {/* Cuisines */}
          {data.cuisines.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border-default">
              <p className="text-sm text-text-muted mb-3">Top cuisines</p>
              <div className="flex flex-wrap gap-2">
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
