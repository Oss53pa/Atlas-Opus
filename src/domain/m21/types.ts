/**
 * M21 — Cockpit & reporting · types du domaine (réf Spec M21 §3), pur.
 * Le cockpit AGRÈGE les indicateurs des modules sans recalculer la donnée
 * financière (RG-M21-01) ; les alertes sont priorisées par sévérité (RG-M21-02).
 */
import type { MessageKey } from '../../i18n';

/** Sévérité d'alerte, par ordre de priorité décroissant (RG-M21-02). */
export const ALERT_SEVERITIES = ['danger', 'echeance', 'info'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** Alerte consolidée produite par un module source et agrégée par le cockpit. */
export interface ConsolidatedAlert {
  /** Module source (m2, m4, m5, m6, m7…) — traçabilité. */
  source: string;
  severity: AlertSeverity;
  /** Clé i18n du libellé (jamais de texte en dur). */
  labelKey: MessageKey;
}
