import { forwardRef } from 'react';
import type { RitualsData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarRow } from '@/components/ui/bar-row';

interface RitualsProps {
  data: RitualsData;
  className?: string;
}

export const Rituals = forwardRef<HTMLDivElement, RitualsProps>(({ data, className }, ref) => {
  if (data.activities.length === 0 || data.totalSelfCare === 0) return null;

  const maxActivity = data.activities[0]?.count || 1;

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="rituals-heading"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="rituals-heading" className="text-2xl font-semibold text-text-primary mb-2">
            Your rituals
          </h2>
          <p className="text-[15px] text-text-secondary">
            How you showed up for yourself
          </p>
        </div>

        {/* Activities */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6 reveal-up">
          <div className="space-y-3">
            {data.activities.map((activity, index) => (
              <div key={activity.name}>
                <BarRow
                  label={activity.name}
                  value={activity.count}
                  maxValue={maxActivity}
                  delay={index * 50}
                />
                {activity.venue && (
                  <p className="text-xs text-text-muted ml-[152px] mt-1">
                    @ {activity.venue}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-border-default">
            <p className="text-[15px] text-text-secondary">
              You showed up for yourself{' '}
              <span className="text-accent-cyan font-semibold">{data.totalSelfCare} times</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

Rituals.displayName = 'Rituals';
