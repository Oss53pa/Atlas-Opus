import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'warning';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}

/** Pastille d'état / chip. Tones sémantiques alignés sur les tokens. */
export function Badge({ tone = 'neutral', dot = false, children }: BadgeProps) {
  const classes = ['ax-badge', tone !== 'neutral' && `ax-badge--${tone}`].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {dot && <span className="ax-dot" />}
      {children}
    </span>
  );
}
