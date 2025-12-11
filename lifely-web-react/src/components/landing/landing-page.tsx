import { useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressDots } from '@/components/ui/progress-dots'
import { ParticlesBackground } from '@/hooks/use-particles'
import { HeroText } from './hero-text'
import { MessageBox } from './message-box'
import { ProgressBar } from './progress-bar'
import { HowItWorksModal, PermissionsModal } from './modals'

// ═══════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════

type State = 'loading' | 'valid' | 'invalid' | 'oauth' | 'declined' | 'processing' | 'error'

interface ProcessingPhase {
  message: string
  dots: number
  progress: number
}

const PROCESSING_PHASES: ProcessingPhase[] = [
  { message: 'Fetching your calendar...', dots: 1, progress: 10 },
  { message: 'Crunching numbers...', dots: 2, progress: 30 },
  { message: 'Finding your people...', dots: 3, progress: 50 },
  { message: 'Mapping your city...', dots: 4, progress: 70 },
  { message: 'Writing your story...', dots: 5, progress: 90 },
]

const STATE_KEYS: State[] = ['loading', 'valid', 'invalid', 'oauth', 'declined', 'processing', 'error']

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function LandingPage() {
  const [state, setState] = useState<State>('loading')
  const [processingPhase, setProcessingPhase] = useState(0)
  const [showHowModal, setShowHowModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [errorMessage] = useState<string | null>(null)

  // Check for URL param override (for sharing previews)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stateParam = params.get('state') as State | null

    if (stateParam && STATE_KEYS.includes(stateParam)) {
      setState(stateParam)
      return
    }

    // Default: show valid state after short delay
    const timer = setTimeout(() => {
      setState('valid')
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Keyboard shortcuts for dev mode (1-7 to switch states)
  useEffect(() => {
    if (import.meta.env.PROD) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const num = parseInt(e.key)
      if (num >= 1 && num <= 7) {
        setState(STATE_KEYS[num - 1])
        setProcessingPhase(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle connect click
  const handleConnect = useCallback(() => {
    setState('oauth')

    // Simulate OAuth flow for demo
    setTimeout(() => {
      // Randomly succeed or decline for demo purposes
      const success = Math.random() > 0.3
      if (success) {
        setState('processing')
        setProcessingPhase(0)
        // Simulate processing phases
        let phase = 0
        const interval = setInterval(() => {
          phase++
          if (phase < PROCESSING_PHASES.length) {
            setProcessingPhase(phase)
          } else {
            clearInterval(interval)
            // Would redirect to results here
            console.log('Processing complete!')
          }
        }, 1500)
      } else {
        setState('declined')
      }
    }, 2000)
  }, [])

  const currentPhase = PROCESSING_PHASES[processingPhase]

  return (
    <div className="relative min-h-screen bg-animated-gradient">
      {/* Particle background */}
      <ParticlesBackground />

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Loading state */}
        {state === 'loading' && (
          <section aria-label="Loading">
            <div className="size-8 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
          </section>
        )}

        {/* Valid token state (main landing) */}
        {state === 'valid' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Connect your calendar">
            <ProgressDots total={5} active={0} />

            <HeroText tagline="Your year in moments." />

            <Button
              size="xl"
              variant="glow"
              onClick={handleConnect}
              className="mt-4"
            >
              Connect Calendar
            </Button>

            <p className="text-sm text-text-muted">
              Read-only · Stays in your browser
            </p>

            <button
              onClick={() => setShowHowModal(true)}
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-accent-cyan transition-colors"
            >
              How this works <ChevronDown className="size-4" />
            </button>
          </section>
        )}

        {/* Invalid/expired token */}
        {state === 'invalid' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Link expired">
            <HeroText />

            <MessageBox title="This link has expired.">
              <p>
                Each link works up to 3 times.<br />
                Ask for a new one to continue.
              </p>
            </MessageBox>
          </section>
        )}

        {/* OAuth pending */}
        {state === 'oauth' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Signing in">
            <ProgressDots total={5} active={0} />

            <HeroText tagline="Waiting for Google sign-in..." />

            <Button size="xl" variant="secondary" disabled>
              Waiting...
            </Button>

            <p className="text-sm text-text-muted">
              Complete sign-in in the popup.
            </p>
          </section>
        )}

        {/* OAuth declined */}
        {state === 'declined' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Access declined">
            <HeroText />

            <MessageBox title="No worries.">
              <p>
                We need calendar access to show your year in review.
                We only read events — we can't change anything.
              </p>
            </MessageBox>

            <Button size="xl" variant="glow" onClick={handleConnect}>
              Try Again
            </Button>

            <button
              onClick={() => setShowPermissionsModal(true)}
              className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
            >
              What permissions exactly?
            </button>
          </section>
        )}

        {/* Processing */}
        {state === 'processing' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Processing your calendar">
            <ProgressDots total={5} active={currentPhase.dots} />

            <p className="text-xl text-text-primary font-medium">
              {currentPhase.message}
            </p>

            <ProgressBar progress={currentPhase.progress} />

            <p className="text-sm text-text-muted">
              This takes about 30 seconds.
            </p>
          </section>
        )}

        {/* Error */}
        {state === 'error' && (
          <section className="flex flex-col items-center gap-8 page-enter" aria-label="Error">
            <HeroText />

            <MessageBox title="Something went wrong.">
              <p>
                {errorMessage || "We couldn't load your calendar data. This might be a temporary issue."}
              </p>
            </MessageBox>

            <Button size="xl" variant="glow" onClick={handleConnect}>
              Try Again
            </Button>

            <a
              href="mailto:hello@thirdplane.io"
              className="text-sm text-text-secondary hover:text-accent-cyan transition-colors"
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
