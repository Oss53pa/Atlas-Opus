import { t } from '../i18n';

/**
 * Logotype Atlas Opus (handoff) — carré plein accent + wordmark « Grand Hotel ».
 * Grand Hotel est réservé au nom d'app (réf CLAUDE.md §4).
 */
export function Brand({ size = 21 }: { size?: number }) {
  const square = Math.round(size * 0.95);
  return (
    <span className="inline-flex items-center gap-2 leading-none">
      <span
        aria-hidden="true"
        style={{ width: square, height: square, background: 'var(--ax-accent)', flex: 'none' }}
      />
      <span className="ax-brand" style={{ fontSize: size, color: 'var(--ax-text)' }}>
        {t('app.name')}
      </span>
    </span>
  );
}
