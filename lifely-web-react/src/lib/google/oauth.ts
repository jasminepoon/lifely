/**
 * Google OAuth integration using Google Identity Services (GIS).
 *
 * Uses the new GIS library for client-side OAuth.
 * https://developers.google.com/identity/oauth2/web/guides/overview
 */

import type { TokenResponse } from './types';

// Scopes needed for calendar read-only access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// GIS TypeScript types
interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
  callback: (response: TokenResponse) => void;
}

interface GoogleOAuth {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message: string }) => void;
  }) => TokenClient;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOAuth;
      };
    };
  }
}

// Track if GIS library is loaded
let isGisLoaded = false;

/**
 * Load the Google Identity Services library.
 */
export function loadGoogleIdentityServices(): Promise<void> {
  if (isGisLoaded) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.accounts?.oauth2) {
      isGisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isGisLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Request an access token via OAuth popup.
 *
 * @param clientId - Google OAuth client ID
 * @returns Promise resolving to token response
 */
export async function requestAccessToken(
  clientId: string
): Promise<TokenResponse> {
  await loadGoogleIdentityServices();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          resolve(response);
        } else {
          reject(new Error('No access token received'));
        }
      },
      error_callback: (error: { type: string; message: string }) => {
        reject(new Error(`OAuth error: ${error.type} - ${error.message}`));
      },
    });

    // Request the token (opens popup)
    client.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Revoke an access token.
 */
export function revokeToken(accessToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oauth2.googleapis.com/revoke?token=${accessToken}`;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to revoke token'));
    document.head.appendChild(script);
  });
}

/**
 * Check if a token is still valid by making a test request.
 */
export async function isTokenValid(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/tokeninfo',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `access_token=${accessToken}`,
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
