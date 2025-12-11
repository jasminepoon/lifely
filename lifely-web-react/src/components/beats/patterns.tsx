import { forwardRef } from 'react';
import type { Pattern } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PatternsProps {
  patterns: Pattern[];
  className?: string;
}

export const Patterns = forwardRef<HTMLDivElement, PatternsProps>(({ patterns, className }, ref) => {
  if (patterns.length === 0) return null;

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="patterns-heading"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="patterns-heading" className="text-2xl font-semibold text-text-primary mb-2">
            Things you might not have noticed
          </h2>
        </div>

        {/* Patterns */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6 reveal-up">
          <div className="space-y-6">
            {patterns.map((pattern, index) => (
              <PatternItem
                key={pattern.title}
                pattern={pattern}
                delay={index * 100}
              />
            ))}
          </div>
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
      <div className="flex-none w-8 h-8 rounded-lg bg-accent-cyan/15 border border-accent-cyan/30 flex items-center justify-center text-base">
        {pattern.icon}
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-base text-text-primary font-medium">
          {pattern.title}
        </p>
        <p className="text-sm text-text-secondary mt-1">
          {pattern.detail}
        </p>
      </div>
    </div>
  );
}
