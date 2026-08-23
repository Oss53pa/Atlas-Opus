import type { ReactNode } from 'react';

interface PanelProps {
  /** Titre de carte (15px / 600). */
  title?: ReactNode;
  /** Métadonnée mono à droite (souvent la règle de gestion : « RG-M14-03 »). */
  meta?: ReactNode;
  /** Action(s) à droite de l'en-tête (boutons). Priment sur `meta` si présentes. */
  actions?: ReactNode;
  /** Padding du corps (désactiver pour un tableau plein cadre). */
  bodyPadded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Carte (handoff) — cadre 1px sur crème, en-tête à filet inférieur
 * (titre à gauche, métadonnée mono ou actions à droite), corps.
 */
export function Panel({ title, meta, actions, bodyPadded = true, className = '', children }: PanelProps) {
  const hasHead = title != null || meta != null || actions != null;
  return (
    <div className={['ax-panel', className].filter(Boolean).join(' ')}>
      {hasHead && (
        <div className="ax-panel__head">
          {title != null && <h2 className="ax-panel__title">{title}</h2>}
          {actions != null ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : (
            meta != null && <span className="ax-panel__meta mono">{meta}</span>
          )}
        </div>
      )}
      <div className={bodyPadded ? 'ax-panel__body' : undefined}>{children}</div>
    </div>
  );
}
