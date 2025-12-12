import { useState, useEffect } from 'react';
import { LandingPage } from '@/components/landing/landing-page';
import { ResultsPage } from '@/components/results/results-page';

type Route = 'landing' | 'results';

function getRouteFromLocation(): Route {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  if (path === '/results' || path === '/results.html' || params.get('page') === 'results') {
    return 'results';
  }
  return 'landing';
}

function App() {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === 'undefined') return 'landing';
    return getRouteFromLocation();
  });

  useEffect(() => {
    // Listen for popstate (back/forward)
    const handlePopState = () => {
      setRoute(getRouteFromLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard shortcut for dev: press 'r' to toggle results
  useEffect(() => {
    if (import.meta.env.PROD) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        setRoute(prev => prev === 'landing' ? 'results' : 'landing');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return route === 'results' ? <ResultsPage /> : <LandingPage />;
}

export default App;
