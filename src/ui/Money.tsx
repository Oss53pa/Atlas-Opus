import { formatAmount } from '../lib/format';
import { locale, t } from '../i18n';

interface MoneyProps {
  /** Valeur déjà calculée (par Money.ts). Ce composant ne fait qu'afficher. */
  amount: number;
  currency?: string;
  /** Affiche un « + » explicite pour les montants positifs (marges, écarts). */
  sign?: boolean;
  className?: string;
}

/** Affichage d'un montant — JetBrains Mono, chiffres tabulaires (réf CLAUDE.md §4). */
export function Money({ amount, currency, sign = false, className = '' }: MoneyProps) {
  const prefix = sign && amount > 0 ? '+' : '';
  return (
    <span className={['mono', className].filter(Boolean).join(' ')}>
      {prefix}
      {formatAmount(amount, locale)}{' '}
      <span className="text-ink-3" style={{ fontSize: '0.7em' }}>
        {currency ?? t('common.currency')}
      </span>
    </span>
  );
}
