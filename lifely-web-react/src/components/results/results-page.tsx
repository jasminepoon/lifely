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

const BEAT_COUNT = 7;

export function ResultsPage() {
  const { results, loading, error, clearResults } = useResults();
  const [currentBeat, beatRefs] = useScrollProgress(BEAT_COUNT);

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
          <div className="size-8 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!results) {
    return null; // Will redirect
  }

  return (
    <div className="relative min-h-screen bg-animated-gradient">
      {/* Particle background */}
      <ParticlesBackground />

      {/* Progress dots - fixed at top */}
      <nav
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        aria-label="Progress"
      >
        <ProgressDots total={BEAT_COUNT} active={currentBeat + 1} />
      </nav>

      {/* Main content */}
      <main className="relative z-10">
        {/* Beat 1: Hero */}
        <Hero
          ref={beatRefs[0]}
          data={results.stats}
        />

        {/* Beat 2: People */}
        <People
          ref={beatRefs[1]}
          people={results.topPeople}
        />

        {/* Beat 3: Places */}
        <Places
          ref={beatRefs[2]}
          data={results.places}
        />

        {/* Beat 4: Rituals */}
        <Rituals
          ref={beatRefs[3]}
          data={results.rituals}
        />

        {/* Beat 5: Patterns */}
        <Patterns
          ref={beatRefs[4]}
          patterns={results.patterns}
        />

        {/* Beat 6: Narrative */}
        <Narrative
          ref={beatRefs[5]}
          narrative={results.narrative}
        />

        {/* Beat 7: Experiments */}
        <Experiments
          ref={beatRefs[6]}
          experiments={results.experiments}
          onStartOver={clearResults}
        />
      </main>
    </div>
  );
}
