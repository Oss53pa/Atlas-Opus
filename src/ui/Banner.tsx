import type { ReactNode } from 'react';

type Tone = 'neutral' | 'danger' | 'info' | 'success' | 'warning';

export function Banner({
  tone = 'neutral',
  icon,
  action,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const classes = ['ax-banner', tone !== 'neutral' && `ax-banner--${tone}`].filter(Boolean).join(' ');
  return (
    <div className={classes} role={tone === 'danger' ? 'alert' : undefined}>
      {icon && <span style={{ marginTop: 1 }}>{icon}</span>}
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
