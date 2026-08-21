import { t } from '../i18n';

/** Logotype Atlas — « Grand Hotel » réservé au nom d'app (réf CLAUDE.md §4). */
export function Brand({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-baseline gap-2 leading-none">
      <span className="ax-brand text-ink" style={{ fontSize: size }}>
        {t('app.name')}
      </span>
      <span
        className="text-ink-3"
        style={{ fontSize: Math.max(10, Math.round(size * 0.36)), letterSpacing: '0.28em' }}
      >
        OPUS
      </span>
    </span>
  );
}
