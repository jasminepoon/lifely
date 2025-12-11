/**
 * Google OAuth Integration
 *
 * Uses Google Identity Services (GIS) for client-side OAuth.
 * The access token stays in the browser — never sent to our server
 * except as part of Google Calendar API calls (which go directly to Google).
 */

let tokenClient = null;
let onSuccessCallback = null;
let onErrorCallback = null;

/**
 * Initialize the Google OAuth client
 *
 * @param {string} clientId - Google OAuth client ID
 * @param {function} onSuccess - Called with access token on success
 * @param {function} onError - Called with error object on failure
 */
export function initOAuth(clientId, onSuccess, onError) {
  onSuccessCallback = onSuccess;
  onErrorCallback = onError;

  // Wait for Google Identity Services to load
  if (typeof google === 'undefined' || !google.accounts) {
    console.log('[OAuth] Waiting for Google Identity Services...');
    window.addEventListener('load', () => {
      initTokenClient(clientId);
    });
  } else {
    initTokenClient(clientId);
  }
}

/**
 * Initialize the token client
 */
function initTokenClient(clientId) {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
      callback: handleTokenResponse,
      error_callback: handleTokenError,
    });
    console.log('[OAuth] Token client initialized');
  } catch (error) {
    console.error('[OAuth] Failed to initialize:', error);
    onErrorCallback?.({ type: 'init_failed', error });
  }
}

/**
 * Request access token (triggers OAuth popup)
 */
export function requestAccess() {
  if (!tokenClient) {
    console.error('[OAuth] Token client not initialized');
    onErrorCallback?.({ type: 'not_initialized' });
    return;
  }

  try {
    tokenClient.requestAccessToken();
  } catch (error) {
    console.error('[OAuth] Request failed:', error);
    onErrorCallback?.({ type: 'request_failed', error });
  }
}

/**
 * Handle successful token response
 */
function handleTokenResponse(response) {
  if (response.error) {
    console.error('[OAuth] Token error:', response.error);
    onErrorCallback?.({ type: 'token_error', error: response.error });
    return;
  }

  if (response.access_token) {
    console.log('[OAuth] Access token received');
    onSuccessCallback?.(response.access_token);
  } else {
    console.error('[OAuth] No access token in response');
    onErrorCallback?.({ type: 'no_token' });
  }
}

/**
 * Handle token errors
 */
function handleTokenError(error) {
  console.error('[OAuth] Error:', error);
  onErrorCallback?.(error);
}

/**
 * Revoke access token (optional, for logout)
 */
export function revokeAccess(token) {
  if (token) {
    google.accounts.oauth2.revoke(token, () => {
      console.log('[OAuth] Token revoked');
    });
  }
}
