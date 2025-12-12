import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Render in portal to escape any stacking context issues
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className="page-enter"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '28rem',
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            padding: '0.375rem',
            borderRadius: '0.375rem',
            color: '#6b7280',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Close"
        >
          <X style={{ width: '1.25rem', height: '1.25rem' }} />
        </button>

        <h2
          id="modal-title"
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'white',
            marginBottom: '1rem',
            paddingRight: '2rem',
          }}
        >
          {title}
        </h2>

        {children}
      </div>
    </div>,
    document.body
  )
}

export function HowItWorksModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How this works">
      <ol style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          { title: 'You sign in with Google', detail: "We never see your password." },
          { title: 'Your calendar loads in your browser', detail: "The full calendar stays on your device." },
          { title: 'AI insights (optional)', detail: "If enabled, event titles and locations are sent to OpenAI to generate your story. We don't log or store any of this." },
          { title: "Close the tab and it's gone", detail: null },
        ].map((step, i) => (
          <li key={i} style={{ display: 'flex', gap: '0.75rem' }}>
            <span
              style={{
                flexShrink: 0,
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(34, 211, 238, 0.2)',
                color: '#22d3ee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 500, margin: 0 }}>{step.title}</p>
              {step.detail && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.125rem', margin: 0 }}>
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

export function PermissionsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permissions we request">
      <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none', margin: 0, padding: 0 }}>
        <PermissionItem
          allowed
          name="View events on your calendars"
          reason="So we can analyze your year."
        />
        <PermissionItem
          allowed={false}
          name="Create, edit, or delete events"
          reason="We can't change anything."
        />
        <PermissionItem
          allowed={false}
          name="Access your contacts"
          reason="We don't need them."
        />
        <PermissionItem
          allowed={false}
          name="Access your email"
          reason="Not requested."
        />
      </ul>
      <p
        style={{
          color: '#6b7280',
          fontSize: '0.875rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        We use the minimum permissions needed.
      </p>
    </Modal>
  )
}

function PermissionItem({
  allowed,
  name,
  reason,
}: {
  allowed: boolean
  name: string
  reason: string
}) {
  return (
    <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <span
        style={{
          flexShrink: 0,
          width: '1.25rem',
          height: '1.25rem',
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          backgroundColor: allowed ? 'rgba(34, 211, 238, 0.2)' : 'rgba(248, 113, 113, 0.2)',
          color: allowed ? '#22d3ee' : '#f87171',
        }}
      >
        {allowed ? <Check style={{ width: '0.75rem', height: '0.75rem' }} /> : <X style={{ width: '0.75rem', height: '0.75rem' }} />}
      </span>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: allowed ? 'white' : '#6b7280',
            textDecoration: allowed ? 'none' : 'line-through',
            margin: 0,
          }}
        >
          {name}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>{reason}</p>
      </div>
    </li>
  )
}
