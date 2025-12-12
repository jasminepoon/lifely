import { useState, useEffect, useCallback } from 'react';

export function useScrollProgress(
  beatCount: number
): [number, (node: HTMLDivElement | null) => void] {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // Callback ref to capture the container element
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;

      // Calculate which beat we're on based on scroll position
      const beatIndex = Math.round(scrollLeft / containerWidth);
      const clampedIndex = Math.max(0, Math.min(beatIndex, beatCount - 1));

      setCurrentBeat(clampedIndex);
    };

    // Add scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [container, beatCount]);

  return [currentBeat, containerRef];
}
