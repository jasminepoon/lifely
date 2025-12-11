/**
 * Lifely Landing Page — Main Entry Point
 *
 * State machine controlling the landing page flow:
 * LOADING → VALID | INVALID
 * VALID → OAUTH → PROCESSING | DECLINED | ERROR
 * DECLINED → OAUTH
 * ERROR → OAUTH
 * PROCESSING → RESULTS (redirect to results page)
 */

import { initOAuth, requestAccess } from './utils/oauth.js';
import { validateToken, processCalendar } from './utils/api.js';

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Will be replaced with actual values
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  PROXY_URL: 'https://api.lifely.thirdplane.io',
};

// ═══════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════

const STATES = {
  LOADING: 'loading',
  VALID: 'valid',
  INVALID: 'invalid',
  OAUTH: 'oauth',
  DECLINED: 'declined',
  PROCESSING: 'processing',
  ERROR: 'error',
};

let currentState = STATES.LOADING;
let accessToken = null;
let lifelyToken = null;

/**
 * Show a specific state, hide all others
 */
function showState(state) {
  currentState = state;

  // Hide all states
  document.querySelectorAll('.state').forEach((el) => {
    el.classList.add('hidden');
  });

  // Show the requested state
  const stateEl = document.getElementById(`state-${state}`);
  if (stateEl) {
    stateEl.classList.remove('hidden');
  }

  console.log(`[Lifely] State: ${state}`);
}

// ═══════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════

const PROCESSING_PHASES = [
  { message: 'Fetching your calendar...', dots: 1, progress: 10 },
  { message: 'Crunching numbers...', dots: 2, progress: 30 },
  { message: 'Finding your people...', dots: 3, progress: 50 },
  { message: 'Mapping your city...', dots: 4, progress: 70 },
  { message: 'Writing your story...', dots: 5, progress: 90 },
];

/**
 * Update progress UI
 */
function updateProgress(phaseIndex, customProgress = null) {
  const phase = PROCESSING_PHASES[phaseIndex] || PROCESSING_PHASES[0];

  // Update message
  const messageEl = document.getElementById('processing-message');
  if (messageEl) {
    messageEl.textContent = phase.message;
  }

  // Update progress bar
  const barEl = document.getElementById('progress-bar');
  const containerEl = barEl?.parentElement;
  const progress = customProgress ?? phase.progress;
  if (barEl) {
    barEl.style.width = `${progress}%`;
  }
  if (containerEl) {
    containerEl.setAttribute('aria-valuenow', progress);
  }

  // Update dots
  const dots = document.querySelectorAll('#state-processing .dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i < phase.dots);
  });
}

// ═══════════════════════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.querySelector('.modal-close')?.focus();

  // Close on backdrop click
  const backdrop = modal.querySelector('.modal-backdrop');
  backdrop?.addEventListener('click', () => closeModal(modalId), { once: true });

  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal(modalId);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

/**
 * Handle OAuth success
 */
async function handleOAuthSuccess(token) {
  accessToken = token;
  sessionStorage.setItem('oauth_token', token);

  showState(STATES.PROCESSING);
  updateProgress(0);

  try {
    const results = await processCalendar(token, lifelyToken, CONFIG.PROXY_URL, (phase, progress) => {
      updateProgress(phase, progress);
    });

    // Store results and redirect to results page
    sessionStorage.setItem('lifely_results', JSON.stringify(results));
    window.location.href = '/results.html';
  } catch (error) {
    console.error('[Lifely] Processing error:', error);
    showState(STATES.ERROR);

    const errorMsg = document.getElementById('error-message');
    if (errorMsg && error.message) {
      errorMsg.textContent = error.message;
    }
  }
}

/**
 * Handle OAuth error/decline
 */
function handleOAuthError(error) {
  console.error('[Lifely] OAuth error:', error);

  if (error?.type === 'popup_closed' || error?.error === 'access_denied') {
    showState(STATES.DECLINED);
  } else {
    showState(STATES.ERROR);
  }
}

/**
 * Handle connect button click
 */
function handleConnectClick() {
  showState(STATES.OAUTH);
  requestAccess();
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function init() {
  // Get token from URL
  const params = new URLSearchParams(window.location.search);
  lifelyToken = params.get('token');

  // No token = invalid
  if (!lifelyToken) {
    showState(STATES.INVALID);
    return;
  }

  // Check for saved OAuth token (resume after refresh)
  const savedToken = sessionStorage.getItem('oauth_token');
  if (savedToken) {
    handleOAuthSuccess(savedToken);
    return;
  }

  // Validate token with API
  try {
    const isValid = await validateToken(lifelyToken, CONFIG.PROXY_URL);
    if (!isValid) {
      showState(STATES.INVALID);
      return;
    }
  } catch (error) {
    console.error('[Lifely] Token validation error:', error);
    showState(STATES.INVALID);
    return;
  }

  // Token is valid — initialize OAuth and show landing
  initOAuth(CONFIG.GOOGLE_CLIENT_ID, handleOAuthSuccess, handleOAuthError);

  // Preview helpers — uncomment ONE to force a view
  // showState(STATES.VALID);       // Main landing (with token assumed valid)
  // showState(STATES.PROCESSING);  // Loading/progress state
  // showState(STATES.DECLINED);    // OAuth declined flow

  showState(STATES.VALID);

  // Set up event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Connect button
  document.getElementById('btn-connect')?.addEventListener('click', handleConnectClick);

  // Retry buttons
  document.getElementById('btn-retry')?.addEventListener('click', handleConnectClick);
  document.getElementById('btn-error-retry')?.addEventListener('click', handleConnectClick);
  document.getElementById('btn-popup-blocked')?.addEventListener('click', handleConnectClick);

  // Modal triggers
  document.getElementById('btn-how')?.addEventListener('click', () => openModal('modal-how'));
  document.getElementById('btn-permissions')?.addEventListener('click', () => openModal('modal-permissions'));

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) {
        closeModal(modal.id);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════

// Wait for DOM and Google Identity Services to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
