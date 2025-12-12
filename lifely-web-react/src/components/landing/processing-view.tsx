/**
 * ProcessingView - Premium loading experience during LLM enrichment.
 *
 * Features:
 * - Horizontal step timeline with icons
 * - Glassmorphism card for current step
 * - Animated gradient progress bar with shimmer
 * - Pulsing icon for active step
 */

import { useMemo } from 'react'

interface ProcessingViewProps {
  progress: number
  message: string
  eventCount: number
}

interface StepInfo {
  currentStep: number
  label: string
  detail: string
  progress: number // 0-100 within this step
}

const STEPS = [
  { icon: '🗺️', label: 'Places', activeLabel: 'Finding your places' },
  { icon: '🔮', label: 'Patterns', activeLabel: 'Discovering patterns' },
  { icon: '✨', label: 'Story', activeLabel: 'Writing your story' },
]

function getStepInfo(progress: number, message: string): StepInfo {
  // Map overall progress to step info
  // 0-30: preparing, 30-50: places, 50-75: patterns, 75-95: story

  if (progress < 30) {
    return { currentStep: 0, label: 'Preparing', detail: '', progress: 0 }
  }

  if (progress < 50) {
    const match = message.match(/\((\d+)\/(\d+)\)/)
    const stepProgress = ((progress - 30) / 20) * 100
    return {
      currentStep: 1,
      label: STEPS[0].activeLabel,
      detail: match ? `${match[1]} of ${match[2]}` : '',
      progress: stepProgress,
    }
  }

  if (progress < 75) {
    const match = message.match(/\((\d+)\/(\d+)\)/)
    const stepProgress = ((progress - 50) / 25) * 100
    return {
      currentStep: 2,
      label: STEPS[1].activeLabel,
      detail: match ? `${match[1]} of ${match[2]}` : '',
      progress: stepProgress,
    }
  }

  if (progress < 95) {
    const stepProgress = ((progress - 75) / 20) * 100
    return {
      currentStep: 3,
      label: STEPS[2].activeLabel,
      detail: '',
      progress: stepProgress,
    }
  }

  return { currentStep: 3, label: 'Almost done', detail: '', progress: 100 }
}

export function ProcessingView({ progress, message, eventCount }: ProcessingViewProps) {
  const stepInfo = useMemo(() => getStepInfo(progress, message), [progress, message])
  const activeStepIndex = Math.max(0, stepInfo.currentStep - 1)

  return (
    <section
      className="page-enter"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        width: '100%',
        maxWidth: '28rem',
        padding: '0 1rem',
      }}
      aria-label="Processing your calendar"
    >
      {/* Main heading */}
      <h2
        style={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: 'white',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}
      >
        Discovering your year
      </h2>

      {/* Current step card */}
      <div
        style={{
          width: '100%',
          padding: '1.5rem',
          borderRadius: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Icon + Label row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Pulsing icon */}
            <span
              style={{
                fontSize: '1.5rem',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              {STEPS[activeStepIndex]?.icon || '⏳'}
            </span>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 500,
                color: 'white',
              }}
            >
              {stepInfo.label}
            </span>
          </div>

          {/* Detail (count) */}
          {stepInfo.detail && (
            <span
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {stepInfo.detail}
            </span>
          )}
        </div>

        {/* Progress bar inside card */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '6px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${progress}%`,
              borderRadius: '9999px',
              background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 50%, #00D4FF 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s linear infinite',
              transition: 'width 0.4s ease-out',
            }}
          />
        </div>
      </div>

      {/* Step timeline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: '100%',
        }}
      >
        {STEPS.map((step, idx) => {
          const isComplete = idx < activeStepIndex
          const isActive = idx === activeStepIndex
          const isPending = idx > activeStepIndex

          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {/* Step dot */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <div
                  style={{
                    width: isActive ? '2.5rem' : '2rem',
                    height: isActive ? '2.5rem' : '2rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isActive ? '1.25rem' : '1rem',
                    transition: 'all 0.3s ease',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(0, 255, 136, 0.3) 100%)'
                      : isComplete
                        ? 'rgba(0, 212, 255, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: isActive
                      ? '2px solid rgba(0, 212, 255, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: isActive ? '0 0 20px rgba(0, 212, 255, 0.3)' : 'none',
                  }}
                >
                  {isComplete ? (
                    <span style={{ color: '#00D4FF' }}>✓</span>
                  ) : (
                    <span style={{ opacity: isPending ? 0.4 : 1 }}>{step.icon}</span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isActive
                      ? 'rgba(255, 255, 255, 0.9)'
                      : isPending
                        ? 'rgba(255, 255, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.6)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last) */}
              {idx < STEPS.length - 1 && (
                <div
                  style={{
                    width: '2rem',
                    height: '2px',
                    background: isComplete
                      ? 'linear-gradient(90deg, #00D4FF, rgba(0, 212, 255, 0.3))'
                      : 'rgba(255, 255, 255, 0.1)',
                    marginBottom: '1.5rem', // align with dots, not labels
                    transition: 'background 0.3s ease',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Event count - subtle context */}
      {eventCount > 0 && (
        <span
          style={{
            fontSize: '0.8125rem',
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 400,
          }}
        >
          {eventCount.toLocaleString()} events from 2025
        </span>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </section>
  )
}
