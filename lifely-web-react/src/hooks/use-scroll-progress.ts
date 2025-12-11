import { useState, useEffect, useRef, type RefObject } from 'react';

export function useScrollProgress(beatCount: number): [number, RefObject<HTMLDivElement | null>[]] {
  const [currentBeat, setCurrentBeat] = useState(0);
  const beatRefs = useRef<RefObject<HTMLDivElement | null>[]>(
    Array.from({ length: beatCount }, () => ({ current: null }))
  );

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    beatRefs.current.forEach((ref, index) => {
      if (ref.current) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setCurrentBeat(index);
              }
            });
          },
          {
            rootMargin: '-40% 0px -40% 0px',
            threshold: 0,
          }
        );
        observer.observe(ref.current);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [beatCount]);

  return [currentBeat, beatRefs.current];
}
