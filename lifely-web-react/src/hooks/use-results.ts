import { useState, useEffect, useCallback } from 'react';
import type { LifelyResults, RawStats } from '@/lib/types';
import { transformStats } from '@/lib/types';
import { processCalendarEvents, convertToRawStats, type ProcessingProgress } from '@/lib/stats/pipeline';
import type { RawCalendarEvent } from '@/lib/stats';

const STORAGE_KEY = 'lifely_results';
const STORAGE_KEY_LLM_FLAG = 'lifely_llm_enabled';
const STORAGE_KEY_RAW_EVENTS = 'lifely_raw_events';
const STORAGE_KEY_USER_EMAIL = 'lifely_user_email';
const STORAGE_KEY_YEAR = 'lifely_year';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const LLM_PROXY_URL = import.meta.env.VITE_LLM_PROXY_URL || '';
const LLM_PROXY_TOKEN = import.meta.env.VITE_LLM_PROXY_TOKEN || '';

function buildLlmConfig() {
  if (!OPENAI_API_KEY && !LLM_PROXY_URL) return null;
  return {
    apiKey: OPENAI_API_KEY || null,
    proxyUrl: LLM_PROXY_URL || null,
    proxyToken: LLM_PROXY_TOKEN || null,
  };
}

function computeLlmFailed(raw: RawStats, enabled: boolean): boolean {
  if (!enabled) return false;
  const storyMissing = !raw.narrative?.story || raw.narrative.story.trim() === '';
  const experimentsMissing = !raw.experiments || raw.experiments.length === 0;
  const patternsMissing = !raw.patterns || raw.patterns.length === 0;
  const activitiesMissing = !Object.keys(raw.activity_stats || {}).length;
  const warningsPresent = !!raw.llm_warnings?.length;
  return storyMissing || experimentsMissing || patternsMissing || activitiesMissing || warningsPresent;
}

export function useResults() {
  const [results, setResults] = useState<LifelyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [llmEnabled, setLlmEnabled] = useState<boolean>(false);
  const [llmFailed, setLlmFailed] = useState<boolean>(false);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);
  const [retryMessage, setRetryMessage] = useState('');
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Try to load from sessionStorage (set by useLifely after calendar processing)
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const llmFlag = sessionStorage.getItem(STORAGE_KEY_LLM_FLAG);
      // Prefer the stored flag (so "AI disabled" runs don't get treated as enabled just because env vars exist).
      const enabled =
        llmFlag == null ? !!buildLlmConfig() : llmFlag === 'true';
      setLlmEnabled(enabled);

      if (stored) {
        const raw = JSON.parse(stored) as RawStats;
        const transformed = transformStats(raw);
        setLlmWarning(raw.llm_warnings?.[0] || null);
        setLlmFailed(computeLlmFailed(raw, enabled));
        setResults(transformed);
      } else {
        setError('No results found. Please connect your calendar first.');
      }
    } catch (e) {
      setError('Failed to load results.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY_LLM_FLAG);
    sessionStorage.removeItem(STORAGE_KEY_RAW_EVENTS);
    sessionStorage.removeItem(STORAGE_KEY_USER_EMAIL);
    sessionStorage.removeItem(STORAGE_KEY_YEAR);
    window.location.href = '/';
  }, []);

  const retryAiEnrichment = useCallback(async () => {
    if (retrying) return;
    setRetryError(null);

    const llmConfig = buildLlmConfig();
    if (!llmConfig) {
      setRetryError('LLM is not configured. Set VITE_LLM_PROXY_URL or VITE_OPENAI_API_KEY.');
      return;
    }

    const rawEventsStr = sessionStorage.getItem(STORAGE_KEY_RAW_EVENTS);
    const userEmail = sessionStorage.getItem(STORAGE_KEY_USER_EMAIL);
    const yearStr = sessionStorage.getItem(STORAGE_KEY_YEAR);

    if (!rawEventsStr || !userEmail) {
      setRetryError('Missing cached events. Please start over and rerun.');
      return;
    }

    let rawEvents: RawCalendarEvent[];
    try {
      rawEvents = JSON.parse(rawEventsStr) as RawCalendarEvent[];
      if (!Array.isArray(rawEvents)) throw new Error('rawEvents is not an array');
    } catch {
      setRetryError('Cached events are corrupted. Please start over and rerun.');
      return;
    }

    const year = yearStr ? Number(yearStr) : 2025;

    try {
      setRetrying(true);
      setRetryProgress(0);
      setRetryMessage('Retrying AI enrichment...');

      const output = await processCalendarEvents(
        rawEvents,
        userEmail,
        year,
        llmConfig,
        (progress: ProcessingProgress) => {
          setRetryProgress(progress.percent);
          setRetryMessage(progress.message);
        }
      );

      const raw = convertToRawStats(output) as unknown as RawStats;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      sessionStorage.setItem(STORAGE_KEY_LLM_FLAG, 'true');

      const transformed = transformStats(raw);
      setResults(transformed);
      setLlmEnabled(true);
      setLlmWarning(raw.llm_warnings?.[0] || null);
      setLlmFailed(computeLlmFailed(raw, true));
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  return {
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
  };
}
