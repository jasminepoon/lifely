import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParticlesBackground } from '@/hooks/use-particles'
import { useLifely } from '@/hooks/use-lifely'
import { HeroText } from './hero-text'
import { MessageBox } from './message-box'
import { ProcessingView } from './processing-view'
import { HowItWorksModal, PermissionsModal } from './modals'

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function LandingPage() {
  const lifely = useLifely()
  const [showHowModal, setShowHowModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [enableAi, setEnableAi] = useState(lifely.isLlmConfigured)

  // Navigate to results when processing completes
  useEffect(() => {
    if (lifely.phase === 'complete') {
      // Short delay to show "Your year is ready!" message
      const timer = setTimeout(() => {
        window.location.href = '/results'
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [lifely.phase])

  // Determine if we're in a processing state (fetching or processing)
  const isProcessing = lifely.phase === 'fetching_calendar' || lifely.phase === 'processing'

  return (
    <div className="relative min-h-screen bg-animated-gradient">
      {/* Particle background */}
      <ParticlesBackground />

      {/* Main content */}
      <main
        className="relative z-10 min-h-screen px-4"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Idle state (ready to connect) */}
        {lifely.phase === 'idle' && (
          <section
            className="page-enter"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
            aria-label="Connect your calendar"
          >
            <HeroText tagline="Your year in moments." />

            {!lifely.isConfigured ? (
              <>
                <MessageBox title="Setup Required">
                  <p>
                    Google OAuth is not configured.<br />
                    Add VITE_GOOGLE_CLIENT_ID to your .env file.
                  </p>
                </MessageBox>
              </>
            ) : (
              <>
                <Button
                  size="xl"
                  variant="glow"
                  onClick={() => lifely.connect({ enableAi })}
                  style={{ marginTop: '1rem' }}
                >
                  Connect Calendar
                </Button>

                <p className="text-sm text-gray-500">
                  Read-only · Runs in your browser
                </p>

                {/* AI toggle */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '22rem',
                    borderRadius: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                  aria-label="AI insights"
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, color: 'white', fontSize: '0.875rem', fontWeight: 500 }}>
                      AI insights
                    </p>
                    <p style={{ margin: 0, marginTop: '0.125rem', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.75rem' }}>
                      Places, patterns, story (slower)
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableAi}
                    disabled={!lifely.isLlmConfigured}
                    onClick={() => setEnableAi((v) => !v)}
                    style={{
                      position: 'relative',
                      width: '44px',
                      height: '24px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      background: enableAi ? 'rgba(34, 211, 238, 0.28)' : 'rgba(255, 255, 255, 0.12)',
                      cursor: lifely.isLlmConfigured ? 'pointer' : 'not-allowed',
                      opacity: lifely.isLlmConfigured ? 1 : 0.5,
                      transition: 'background 200ms ease',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.92)',
                        transform: enableAi ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 200ms ease',
                        boxShadow: enableAi ? '0 0 16px rgba(34, 211, 238, 0.35)' : 'none',
                      }}
                    />
                  </button>
                </div>

                {!lifely.isLlmConfigured && (
                  <p className="text-xs text-gray-500" style={{ marginTop: '-0.75rem' }}>
                    AI is not configured (set <code>VITE_LLM_PROXY_URL</code> or <code>VITE_OPENAI_API_KEY</code>).
                  </p>
                )}

                <button
                  onClick={() => setShowHowModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  How this works <ChevronDown style={{ width: '1rem', height: '1rem' }} />
                </button>
              </>
            )}
          </section>
        )}

        {/* OAuth pending */}
        {lifely.phase === 'oauth_pending' && (
          <section
            className="page-enter"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
            aria-label="Signing in"
          >
            <HeroText tagline="Waiting for Google sign-in" />

            <Button size="xl" variant="secondary" disabled>
              Waiting...
            </Button>

            <p className="text-sm text-gray-500">
              Complete sign-in in the popup.
            </p>
          </section>
        )}

        {/* OAuth declined */}
        {lifely.phase === 'oauth_declined' && (
          <section
            className="page-enter"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
            aria-label="Access declined"
          >
            <HeroText />

            <MessageBox title="No worries.">
              <p>
                We need calendar access to show your year in review.
                We only read events — we can't change anything.
              </p>
            </MessageBox>

            <Button size="xl" variant="glow" onClick={() => lifely.connect({ enableAi })}>
              Try Again
            </Button>

            <button
              onClick={() => setShowPermissionsModal(true)}
              style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              What permissions exactly?
            </button>
          </section>
        )}

        {/* Processing (fetching calendar + processing) */}
        {isProcessing && (
          <ProcessingView
            progress={lifely.progress}
            message={lifely.message}
            eventCount={lifely.eventCount}
          />
        )}

        {/* Complete */}
        {lifely.phase === 'complete' && (
          <section
            className="page-enter"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
            }}
            aria-label="Processing complete"
          >
            {/* Success checkmark with glow */}
            <div
              style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(0, 255, 136, 0.3) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(0, 212, 255, 0.4)',
              }}
            >
              <span style={{ fontSize: '2rem', color: 'white' }}>✓</span>
            </div>

            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 500,
                color: 'white',
              }}
            >
              Your year is ready
            </h2>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              Redirecting...
            </p>
          </section>
        )}

        {/* Error */}
        {lifely.phase === 'error' && (
          <section
            className="page-enter"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
            aria-label="Error"
          >
            <HeroText />

            <MessageBox title="Something went wrong.">
              <p>
                {lifely.error || "We couldn't load your calendar data. This might be a temporary issue."}
              </p>
            </MessageBox>

            <Button size="xl" variant="glow" onClick={() => lifely.connect({ enableAi })}>
              Try Again
            </Button>

            <a
              href="mailto:hello@thirdplane.io"
              style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                textDecoration: 'none',
              }}
            >
              Still not working? Let us know.
            </a>
          </section>
        )}
      </main>

      {/* Modals */}
      <HowItWorksModal
        isOpen={showHowModal}
        onClose={() => setShowHowModal(false)}
      />
      <PermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />
    </div>
  )
}
