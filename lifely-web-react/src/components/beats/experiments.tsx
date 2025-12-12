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
    const hasExperiments = experiments.length > 0;

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
        aria-labelledby="experiments-heading"
      >
        <div style={{ width: '100%', maxWidth: '32rem' }}>
          {/* Header */}
          <div className="mb-8 reveal-up">
            <h2 id="experiments-heading" className="text-2xl font-semibold text-white mb-2">
              For 2026, consider:
            </h2>
          </div>

          {/* Experiments */}
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 reveal-up">
            {hasExperiments ? (
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
            ) : (
              <p className="text-[15px] text-gray-500">
                Experiments unavailable right now. Rerun when AI enrichment succeeds.
              </p>
            )}
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
            <p className="text-center text-sm text-gray-500 mt-3">
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
      <div className="flex-none w-8 h-8 rounded-lg border border-cyan-400 text-cyan-400 flex items-center justify-center text-sm font-semibold">
        {number}
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-base text-white font-semibold">
          {experiment.title}
        </p>
        <p className="text-[15px] text-gray-400 mt-1">
          {experiment.description}
        </p>
      </div>
    </div>
  );
}
