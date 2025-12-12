interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent';
  className?: string;
}

export function Chip({ children, variant = 'default', className }: ChipProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 500,
  };

  const variantStyles: React.CSSProperties = variant === 'accent'
    ? {
        backgroundColor: 'rgba(34, 211, 238, 0.15)',
        color: '#22d3ee',
        border: '1px solid rgba(34, 211, 238, 0.3)',
      }
    : {
        backgroundColor: '#1f2937',
        color: '#9ca3af',
      };

  return (
    <span className={className} style={{ ...baseStyles, ...variantStyles }}>
      {children}
    </span>
  );
}
