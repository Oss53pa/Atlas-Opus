/** Postes de bilan (réf CLAUDE.md §10 bilan_lines.poste). Libellés via i18n. */
import type { MessageKey } from '../../i18n';

export const COST_POSTES = ['foncier', 'etudes', 'travaux', 'honoraires', 'assurances', 'frais_financiers', 'aleas'] as const;
export const REVENUE_POSTES = ['ventes', 'loyers', 'subventions'] as const;

export type CostPoste = (typeof COST_POSTES)[number];
export type RevenuePoste = (typeof REVENUE_POSTES)[number];

export function posteKey(poste: string): MessageKey {
  return `poste.${poste}` as MessageKey;
}
