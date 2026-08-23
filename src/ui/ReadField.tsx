import type { ReactNode } from 'react';

/**
 * Champ de formulaire en lecture (handoff) — libellé mono 10px majuscules,
 * puis une boîte 36px (filet fort sur surface input). Nombres en mono.
 */
export function ReadField({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="ax-field">
      <span className="ax-label">{label}</span>
      <div className={['ax-readbox', mono && 'mono'].filter(Boolean).join(' ')}>
        {value == null || value === '' ? <span className="text-ink-3">—</span> : value}
      </div>
    </div>
  );
}
