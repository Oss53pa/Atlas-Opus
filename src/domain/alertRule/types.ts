/**
 * M21 (cockpit & reporting) — Règles d'alerte. Seuils configurables par tenant
 * que le cockpit évalue contre les indicateurs d'une opération. Domaine pur.
 * Convention : une règle se déclenche quand la valeur de la métrique **atteint
 * ou dépasse** le seuil (métriques « plus c'est haut, pire c'est »).
 * Table : ao_alert_rules (tenant-scopée — pas de périmètre opération).
 */

/** Sévérité d'une alerte. */
export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** Métriques cockpit usuelles (clé technique ; le seuil est un plafond). */
export const ALERT_METRICS = [
  'depassement_budget_pct',
  'retard_jours',
  'reserves_ouvertes',
  'cautions_expirant_30j',
  'sinistres_ouverts',
  'tresorerie_negative',
] as const;
export type AlertMetric = (typeof ALERT_METRICS)[number];

export interface AlertRule {
  id: string;
  tenantId: string;
  /** Clé de métrique (une des ALERT_METRICS, ou libre). */
  metric: string;
  /** Seuil de déclenchement ; null = règle inactive (jamais déclenchée). */
  threshold: number | null;
  severity: AlertSeverity;
}

export interface AlertRuleInput {
  metric: string;
  threshold: number | null;
  severity: AlertSeverity;
}
