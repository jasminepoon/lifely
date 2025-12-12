interface ProgressDotsProps {
  total?: number
  active?: number
}

export function ProgressDots({ total = 7, active = 0 }: ProgressDotsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) => {
        const isActive = i < active
        return (
          <span
            key={i}
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '9999px',
              backgroundColor: isActive ? '#22D3EE' : 'rgba(255, 255, 255, 0.2)',
              transform: isActive ? 'scale(1)' : 'scale(0.75)',
              transition: 'all 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}
