import { forwardRef } from 'react';
import type { Experiment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ExperimentsProps {
  experiments: Experiment[];
  onStartOver: () => void;
  className?: string;
}

export const Experiments = forwardRef<HTMLDivElement, ExperimentsProps>(
  ({ experiments, onStartOver, className }, ref) => {
    return (
      <section
        ref={ref}
        className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
        aria-labelledby="experiments-heading"
      >
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-8 reveal-up">
            <h2 id="experiments-heading" className="text-2xl font-semibold text-text-primary mb-2">
              For 2026, consider:
            </h2>
          </div>

          {/* Experiments */}
          <div className="bg-bg-card border border-border-default rounded-xl p-6 reveal-up">
            <div className="space-y-6">
              {experiments.map((experiment, index) => (
                <ExperimentItem
                  key={experiment.title}
                  experiment={experiment}
                  number={index + 1}
                  delay={index * 100}
                />
              ))}
            </div>
          </div>

          {/* Start Over */}
          <div className="mt-8 reveal-up" style={{ animationDelay: '400ms' }}>
            <Button
              size="xl"
              variant="secondary"
              className="w-full"
              onClick={onStartOver}
            >
              Start Over
            </Button>
            <p className="text-center text-sm text-text-muted mt-3">
              This will clear your data and return to the beginning.
            </p>
          </div>
        </div>
      </section>
    );
  }
);

Experiments.displayName = 'Experiments';

function ExperimentItem({
  experiment,
  number,
  delay,
}: {
  experiment: Experiment;
  number: number;
  delay: number;
}) {
  return (
    <div
      className="flex gap-4 reveal-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Number badge */}
      <div className="flex-none w-8 h-8 rounded-lg border border-accent-cyan text-accent-cyan flex items-center justify-center text-sm font-semibold">
        {number}
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-base text-text-primary font-semibold">
          {experiment.title}
        </p>
        <p className="text-[15px] text-text-secondary mt-1">
          {experiment.description}
        </p>
      </div>
    </div>
  );
}
