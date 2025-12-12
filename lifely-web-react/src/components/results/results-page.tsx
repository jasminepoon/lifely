import { useEffect } from 'react';
import { ProgressDots } from '@/components/ui/progress-dots';
import { ParticlesBackground } from '@/hooks/use-particles';
import { useResults } from '@/hooks/use-results';
import { useScrollProgress } from '@/hooks/use-scroll-progress';
import { Hero } from '@/components/beats/hero';
import { People } from '@/components/beats/people';
import { Places } from '@/components/beats/places';
import { Rituals } from '@/components/beats/rituals';
import { Patterns } from '@/components/beats/patterns';
import { Narrative } from '@/components/beats/narrative';
import { Experiments } from '@/components/beats/experiments';
import { Button } from '@/components/ui/button';

const BEAT_COUNT = 7;

function buildFallbackNarrative(stats: {
  year: number;
  totalEvents: number;
  totalHours: number;
  busiestMonth: string;
  busiestDay: string;
}) {
  const hours = Math.round(stats.totalHours);
  return `In ${stats.year}, you logged ${stats.totalEvents} events across ${hours.toLocaleString()} hours. ${stats.busiestMonth} was your busiest month, and ${stats.busiestDay} was your busiest day of the week.`;
}

export function ResultsPage() {
  const {
    results,
    loading,
    error,
    clearResults,
    llmEnabled,
    llmFailed,
    llmWarning,
    retryAiEnrichment,
    retrying,
    retryProgress,
    retryMessage,
    retryError,
  } = useResults();
  const [currentBeat, containerRef] = useScrollProgress(BEAT_COUNT);

  // Redirect to landing if no results
  useEffect(() => {
    if (!loading && error) {
      window.location.href = '/';
    }
  }, [loading, error]);

  if (loading) {
    return (
      <div className="min-h-screen bg-animated-gradient flex items-center justify-center">
        <ParticlesBackground />
        <div className="relative z-10">
          <div className="size-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!results) {
    return null; // Will redirect
  }

  return (
    <div className="relative h-screen overflow-hidden bg-animated-gradient">
      {/* Particle background */}
      <ParticlesBackground />

      {/* LLM warning banner */}
      {llmEnabled && (llmFailed || !!retryError) && (
        <div
          className="fixed top-2 left-1/2 z-50 px-3 py-2 rounded-lg border border-yellow-400/50 bg-black/60 text-sm text-yellow-100"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ lineHeight: 1.2 }}>
              {retrying ? (
                <span>
                  {retryMessage} {retryProgress ? `(${retryProgress}%)` : ''}
                </span>
              ) : retryError ? (
                <span>{retryError}</span>
              ) : (
                <span>
                  {llmWarning ||
                    'AI enrichment is incomplete. Some sections may be missing.'}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={retryAiEnrichment}
              disabled={retrying}
              className="h-7 px-3"
            >
              {retrying ? 'Retrying…' : 'Retry AI'}
            </Button>
          </div>
        </div>
      )}

      {/* Progress dots - fixed at top */}
      <nav
        className="fixed top-4 left-1/2 z-50"
        style={{ transform: 'translateX(-50%)' }}
        aria-label="Progress"
      >
        <ProgressDots total={BEAT_COUNT} active={currentBeat + 1} />
      </nav>

      {/* Main content - horizontal scroll with snap */}
      <main
        ref={containerRef}
        className="relative z-10 h-full"
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Beat 1: Hero */}
        <Hero data={results.stats} />

        {/* Beat 2: People */}
        <People people={results.topPeople} />

        {/* Beat 3: Places */}
        <Places data={results.places} />

        {/* Beat 4: Rituals */}
        <Rituals data={results.rituals} />

        {/* Beat 5: Patterns */}
        <Patterns patterns={results.patterns} />

        {/* Beat 6: Narrative */}
        <Narrative
          narrative={
            results.narrative && results.narrative.trim()
              ? results.narrative
              : buildFallbackNarrative(results.stats)
          }
        />

        {/* Beat 7: Experiments */}
        <Experiments
          experiments={results.experiments}
          year={results.stats.year}
          onStartOver={clearResults}
        />
      </main>
    </div>
  );
}
