interface BarRowProps {
  label: string;
  value: number;
  maxValue: number;
  delay?: number;
  className?: string;
}

export function BarRow({ label, value, maxValue, delay = 0, className }: BarRowProps) {
  const percentage = Math.round((value / maxValue) * 100);

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr 44px',
        gap: '0.75rem',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: '15px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '0.625rem', backgroundColor: '#1f2937', borderRadius: '9999px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            borderRadius: '9999px',
            width: `${percentage}%`,
            transitionProperty: 'all',
            transitionDuration: '700ms',
            transitionTimingFunction: 'ease-out',
            transitionDelay: `${delay}ms`,
            background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)',
          }}
        />
      </div>
      <span style={{ fontSize: '15px', color: '#9ca3af', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
