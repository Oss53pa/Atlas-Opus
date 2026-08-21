import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'default' | 'strong' | 'subtle';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padded?: boolean;
  children: ReactNode;
}

const toneClass: Record<Tone, string> = {
  default: '',
  strong: 'ax-card--strong',
  subtle: 'ax-card--subtle',
};

/** Surface verre dépoli (glassmorphism). Brique de base des écrans. */
export function Card({ tone = 'default', padded = true, className = '', children, ...rest }: CardProps) {
  const classes = ['ax-card', toneClass[tone], padded ? 'p-5' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
