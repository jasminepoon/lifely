import { useState, useEffect } from 'react';
import { LandingPage } from '@/components/landing/landing-page';
import { ResultsPage } from '@/components/results/results-page';

type Route = 'landing' | 'results';

function App() {
  const [route, setRoute] = useState<Route>('landing');

  useEffect(() => {
    // Simple URL-based routing
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path === '/results' || path === '/results.html' || params.get('page') === 'results') {
      setRoute('results');
    } else {
      setRoute('landing');
    }

    // Listen for popstate (back/forward)
    const handlePopState = () => {
      const newPath = window.location.pathname;
      const newParams = new URLSearchParams(window.location.search);
      if (newPath === '/results' || newPath === '/results.html' || newParams.get('page') === 'results') {
        setRoute('results');
      } else {
        setRoute('landing');
      }
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
