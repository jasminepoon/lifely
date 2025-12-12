/**
 * useLifely hook - orchestrates the full Lifely flow.
 *
 * Handles OAuth, calendar fetching, and stats processing.
 */

import { useState, useCallback } from 'react';
import {
  requestAccessToken,
  fetchUserInfo,
  fetchCalendarEvents,
} from '@/lib/google';
import type { UserInfo, CalendarEvent } from '@/lib/google';
import {
  processCalendarEvents,
  convertToRawStats,
  type ProcessingProgress,
} from '@/lib/stats/pipeline';
import type { RawCalendarEvent } from '@/lib/stats';
import { transformStats, type LifelyResults } from '@/lib/types';

// Config from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const LLM_PROXY_URL = import.meta.env.VITE_LLM_PROXY_URL || '';
const LLM_PROXY_TOKEN = import.meta.env.VITE_LLM_PROXY_TOKEN || '';
const TARGET_YEAR = 2025;

export type LifelyPhase =
  | 'idle'
  | 'oauth_pending'
  | 'oauth_declined'
  | 'fetching_calendar'
  | 'processing'
  | 'complete'
  | 'error';

export interface LifelyState {
  phase: LifelyPhase;
  progress: number;
  message: string;
  user: UserInfo | null;
  results: LifelyResults | null;
  error: string | null;
  eventCount: number;
}

const STORAGE_KEY_RESULTS = 'lifely_results';
const STORAGE_KEY_LLM_FLAG = 'lifely_llm_enabled';
const STORAGE_KEY_RAW_EVENTS = 'lifely_raw_events';
const STORAGE_KEY_USER_EMAIL = 'lifely_user_email';
const STORAGE_KEY_YEAR = 'lifely_year';

export function useLifely() {
  const isLlmConfigured = !!OPENAI_API_KEY || !!LLM_PROXY_URL;
  const [state, setState] = useState<LifelyState>({
    phase: 'idle',
    progress: 0,
    message: '',
    user: null,
    results: null,
    error: null,
    eventCount: 0,
  });

  /**
   * Start the OAuth + processing flow.
   */
  const connect = useCallback(async (options?: { enableAi?: boolean }) => {
    if (!GOOGLE_CLIENT_ID) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: 'Google Client ID not configured',
      }));
      return;
    }

    try {
      const enableAi = options?.enableAi ?? true;

      // Phase 1: OAuth
      setState((s) => ({
        ...s,
        phase: 'oauth_pending',
        progress: 0,
        message: 'Waiting for Google sign-in...',
        error: null,
      }));

      let token;
      try {
        token = await requestAccessToken(GOOGLE_CLIENT_ID);
      } catch {
        // User declined or closed popup
        setState((s) => ({
          ...s,
          phase: 'oauth_declined',
          message: 'OAuth was declined or cancelled',
        }));
        return;
      }

      // Get user info
      const user = await fetchUserInfo(token.access_token);
      setState((s) => ({
        ...s,
        user,
        progress: 5,
        message: `Welcome, ${user.name || user.email}!`,
      }));

      // Phase 2: Fetch calendar events
      setState((s) => ({
        ...s,
        phase: 'fetching_calendar',
        progress: 10,
        message: 'Fetching your calendar...',
      }));

      const events = await fetchCalendarEvents(
        token.access_token,
        TARGET_YEAR,
        (count) => {
          setState((s) => ({
            ...s,
            eventCount: count,
            progress: Math.min(10 + Math.floor(count / 50), 25),
            message: `Fetched ${count} events...`,
          }));
        }
      );

      setState((s) => ({
        ...s,
        eventCount: events.length,
        progress: 30,
        message: `Found ${events.length} events in ${TARGET_YEAR}`,
      }));

      // Phase 3: Process events
      setState((s) => ({
        ...s,
        phase: 'processing',
        message: 'Processing your calendar...',
      }));

      // Convert Google Calendar events to our raw format
      const rawEvents: RawCalendarEvent[] = events.map(
        (e: CalendarEvent) => ({
          id: e.id,
          status: e.status,
          summary: e.summary,
          start: e.start,
          end: e.end,
          attendees: e.attendees,
          organizer: e.organizer,
          location: e.location,
          recurringEventId: e.recurringEventId,
        })
      );

      // Persist minimal inputs so we can "Retry AI enrichment" without re-OAuth/fetch.
      sessionStorage.setItem(STORAGE_KEY_RAW_EVENTS, JSON.stringify(rawEvents));
      sessionStorage.setItem(STORAGE_KEY_USER_EMAIL, user.email);
      sessionStorage.setItem(STORAGE_KEY_YEAR, String(TARGET_YEAR));

      const llmConfig =
        enableAi && (OPENAI_API_KEY || LLM_PROXY_URL)
          ? {
              apiKey: OPENAI_API_KEY || null,
              proxyUrl: LLM_PROXY_URL || null,
              proxyToken: LLM_PROXY_TOKEN || null,
            }
          : null;

      // Remember whether LLM is configured for this run (used for UX messaging on results page)
      sessionStorage.setItem(STORAGE_KEY_LLM_FLAG, llmConfig ? 'true' : 'false');

      const statsOutput = await processCalendarEvents(
        rawEvents,
        user.email,
        TARGET_YEAR,
        llmConfig,
        (progress: ProcessingProgress) => {
          setState((s) => ({
            ...s,
            progress: 30 + Math.floor(progress.percent * 0.7),
            message: progress.message,
          }));
        }
      );

      // Convert to UI format
      const rawStats = convertToRawStats(statsOutput);
      const results = transformStats(rawStats);

      // Save to sessionStorage for results page
      sessionStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(rawStats));

      setState((s) => ({
        ...s,
        phase: 'complete',
        progress: 100,
        message: 'Your year is ready!',
        results,
      }));
    } catch (error) {
      console.error('Lifely error:', error);
      setState((s) => ({
        ...s,
        phase: 'error',
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      }));
    }
  }, []);

  /**
   * Reset state to start over.
   */
  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY_RESULTS);
    sessionStorage.removeItem(STORAGE_KEY_LLM_FLAG);
    sessionStorage.removeItem(STORAGE_KEY_RAW_EVENTS);
    sessionStorage.removeItem(STORAGE_KEY_USER_EMAIL);
    sessionStorage.removeItem(STORAGE_KEY_YEAR);
    setState({
      phase: 'idle',
      progress: 0,
      message: '',
      user: null,
      results: null,
      error: null,
      eventCount: 0,
    });
  }, []);

  return {
    ...state,
    connect,
    reset,
    isConfigured: !!GOOGLE_CLIENT_ID,
    isLlmConfigured,
  };
}
