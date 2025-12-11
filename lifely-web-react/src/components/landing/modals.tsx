import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md bg-bg-card border border-border-default rounded-xl p-6 shadow-elevated page-enter">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <h2 id="modal-title" className="text-xl font-semibold text-text-primary mb-4 pr-8">
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
      <ol className="space-y-4">
        {[
          { title: 'You sign in with Google', detail: "We never see your password." },
          { title: 'Your calendar loads in your browser', detail: "The full calendar stays on your device." },
          { title: 'AI finds patterns in your year', detail: "Event titles and locations are sent to OpenAI to generate your story. We don't log or store any of this." },
          { title: "Close the tab and it's gone", detail: null },
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-none size-6 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center text-sm font-medium">
              {i + 1}
            </span>
            <div>
              <p className="text-text-primary font-medium">{step.title}</p>
              {step.detail && <p className="text-text-muted text-sm mt-0.5">{step.detail}</p>}
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
      <ul className="space-y-3">
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
      <p className="text-text-muted text-sm mt-4 pt-4 border-t border-border-default">
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
    <li className="flex gap-3 items-start">
      <span
        className={cn(
          "flex-none size-5 rounded-full flex items-center justify-center text-xs",
          allowed
            ? "bg-accent-cyan/20 text-accent-cyan"
            : "bg-accent-warm/20 text-accent-warm"
        )}
      >
        {allowed ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <div>
        <p className={cn(
          "text-sm font-medium",
          allowed ? "text-text-primary" : "text-text-muted line-through"
        )}>
          {name}
        </p>
        <p className="text-text-muted text-xs">{reason}</p>
      </div>
    </li>
  )
}
