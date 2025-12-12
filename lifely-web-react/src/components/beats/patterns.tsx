import { forwardRef } from 'react';
import type { Pattern } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PatternsProps {
  patterns: Pattern[];
  className?: string;
}

export const Patterns = forwardRef<HTMLDivElement, PatternsProps>(({ patterns, className }, ref) => {
  const hasPatterns = patterns.length > 0;

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
      aria-labelledby="patterns-heading"
    >
      <div style={{ width: '100%', maxWidth: '32rem' }}>
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="patterns-heading" className="text-2xl font-semibold text-white mb-2">
            Things you might not have noticed
          </h2>
          <p className="text-[15px] text-gray-400">
            Small signals across your calendar
          </p>
        </div>

        {/* Patterns */}
        <div className="bg-gray-900 border border-white/10 rounded-xl p-6 reveal-up">
          {hasPatterns ? (
            <div className="space-y-6">
              {patterns.map((pattern, index) => (
                <PatternItem
                  key={pattern.title}
                  pattern={pattern}
                  delay={index * 100}
                />
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-gray-500">
              No patterns yet. Retry AI to fill this in.
            </p>
          )}
        </div>
      </div>
    </section>
  );
});

Patterns.displayName = 'Patterns';

function PatternItem({ pattern, delay }: { pattern: Pattern; delay: number }) {
  return (
    <div
      className="flex gap-4 reveal-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon */}
      <div className="flex-none w-8 h-8 rounded-lg bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-base">
        {pattern.icon}
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-base text-white font-medium">
          {pattern.title}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {pattern.detail}
        </p>
      </div>
    </div>
  );
}
