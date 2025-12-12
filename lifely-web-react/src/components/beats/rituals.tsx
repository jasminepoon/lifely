import { forwardRef } from 'react';
import type { RitualsData, CategoryData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarRow } from '@/components/ui/bar-row';
import { Chip } from '@/components/ui/chip';

interface RitualsProps {
  data: RitualsData;
  className?: string;
}

// Icons for common categories
const CATEGORY_ICONS: Record<string, string> = {
  social: '👥',
  fitness: '💪',
  wellness: '🧘',
  health: '🏥',
  personal_care: '💇',
  entertainment: '🎬',
  learning: '📚',
  creative: '🎨',
  travel: '✈️',
  dining: '🍽️',
};

// Colors for time breakdown visualization
const CATEGORY_COLORS: string[] = [
  '#22d3ee', // cyan
  '#a78bfa', // purple
  '#f472b6', // pink
  '#fb923c', // orange
  '#4ade80', // green
  '#facc15', // yellow
  '#60a5fa', // blue
  '#f87171', // red
];

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  return CATEGORY_ICONS[lower] || '✨';
}

export const Rituals = forwardRef<HTMLDivElement, RitualsProps>(({ data, className }, ref) => {
  const hasCategories = data.categories.length > 0;
  const coverage = data.coverage;

  const maxCategory = data.categories[0]?.count || 1;

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
      aria-labelledby="rituals-heading"
    >
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="rituals-heading" className="text-2xl font-semibold text-white mb-2">
            Your year in activities
          </h2>
          <p className="text-[15px] text-gray-400">
            What you spent your time on
          </p>
        </div>

        {/* Categories */}
        <div
          className="reveal-up"
          style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          {hasCategories ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {data.categories.map((category, index) => (
                  <CategoryRow
                    key={category.name}
                    category={category}
                    maxValue={maxCategory}
                    delay={index * 50}
                  />
                ))}
              </div>

              {/* Time Breakdown */}
              <TimeBreakdown categories={data.categories} />
            </>
          ) : (
            <p className="text-[15px] text-gray-500">
              Activities are unavailable. Try rerunning when AI enrichment succeeds.
            </p>
          )}

          {/* Summary with coverage */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <p style={{ fontSize: '15px', color: '#9ca3af' }}>
              <span style={{ color: '#22d3ee', fontWeight: 600 }}>{data.totalInteresting}</span> moments
              that made your year interesting.
            </p>
            {coverage && (
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '0.5rem' }}>
                {coverage.classified} of {coverage.total} events analyzed
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

Rituals.displayName = 'Rituals';

function CategoryRow({
  category,
  maxValue,
  delay,
}: {
  category: CategoryData;
  maxValue: number;
  delay: number;
}) {
  const icon = getCategoryIcon(category.name);
  const topActivities = category.topActivities.slice(0, 3);

  return (
    <div style={{ animationDelay: `${delay}ms` }} className="reveal-up">
      {/* Category bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <BarRow
          label={category.name}
          value={category.count}
          maxValue={maxValue}
          delay={0}
        />
      </div>

      {/* Top activities as chips */}
      {topActivities.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
          marginLeft: '1.75rem',
        }}>
          {topActivities.map(([activity, count]) => (
            <Chip key={activity}>
              {activity} ({count})
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeBreakdown({ categories }: { categories: CategoryData[] }) {
  const totalHours = categories.reduce((sum, cat) => sum + cat.hours, 0);
  if (totalHours === 0) return null;

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '0.75rem' }}>
        Time breakdown ({Math.round(totalHours)} hours)
      </p>

      {/* Stacked bar */}
      <div style={{
        height: '1.5rem',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        display: 'flex',
        backgroundColor: '#1f2937',
      }}>
        {categories.map((cat, index) => {
          const percentage = (cat.hours / totalHours) * 100;
          if (percentage < 1) return null; // Skip tiny segments
          return (
            <div
              key={cat.name}
              style={{
                width: `${percentage}%`,
                height: '100%',
                backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                transition: 'width 700ms ease-out',
              }}
              title={`${cat.name}: ${Math.round(cat.hours)}h`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginTop: '0.75rem',
      }}>
        {categories.slice(0, 6).map((cat, index) => (
          <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{
              width: '0.625rem',
              height: '0.625rem',
              borderRadius: '0.125rem',
              backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
            }} />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {cat.name} ({Math.round(cat.hours)}h)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
