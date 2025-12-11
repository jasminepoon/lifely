import { forwardRef, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface NarrativeProps {
  narrative: string;
  className?: string;
}

export const Narrative = forwardRef<HTMLDivElement, NarrativeProps>(({ narrative, className }, ref) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Start typing when section comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasStarted]);

  // Typewriter effect
  useEffect(() => {
    if (!hasStarted) return;

    if (prefersReducedMotion) {
      setDisplayedText(narrative);
      return;
    }

    setIsTyping(true);
    let index = 0;
    const speed = 8; // ms per character

    const interval = setInterval(() => {
      if (index < narrative.length) {
        setDisplayedText(narrative.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [hasStarted, narrative, prefersReducedMotion]);

  // Split into paragraphs for display
  const paragraphs = displayedText.split('\n\n').filter(Boolean);

  return (
    <section
      ref={ref}
      className={cn("min-h-screen flex items-center justify-center px-4 py-16", className)}
      aria-labelledby="narrative-heading"
    >
      <div ref={containerRef} className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 reveal-up">
          <h2 id="narrative-heading" className="text-2xl font-semibold text-text-primary mb-2">
            Your story
          </h2>
        </div>

        {/* Narrative */}
        <div className="bg-bg-card border border-border-default rounded-xl p-6 reveal-up">
          <div className="space-y-4">
            {paragraphs.map((para, index) => (
              <p
                key={index}
                className="text-[17px] text-text-secondary leading-relaxed"
              >
                "{para}
                {index === paragraphs.length - 1 && !isTyping && '"'}
                {index === paragraphs.length - 1 && isTyping && (
                  <span className="animate-pulse">|</span>
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

Narrative.displayName = 'Narrative';
