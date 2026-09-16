/**
 * M21 (règles d'alerte) — évaluation pure des seuils contre un instantané de
 * métriques. Une règle se déclenche si son seuil est défini et que la valeur
 * mesurée l'atteint ou le dépasse (valeur ≥ seuil).
 */
import { ALERT_SEVERITIES, type AlertRule, type AlertSeverity } from './types';

/** Rang de sévérité (0 = info … 2 = critical). */
export function severityRank(s: AlertSeverity): number {
  return ALERT_SEVERITIES.indexOf(s);
}

/** La règle est-elle active (seuil défini) ? */
export function isActive(rule: Pick<AlertRule, 'threshold'>): boolean {
  return rule.threshold !== null;
}

export interface RuleEvaluation {
  rule: AlertRule;
  /** Valeur mesurée pour la métrique, ou null si absente de l'instantané. */
  value: number | null;
  fired: boolean;
}

/**
 * Évalue chaque règle contre un instantané `metric → valeur`. Une règle se
 * déclenche si elle est active et que la valeur mesurée ≥ seuil. Ne mute pas.
 */
export function evaluateRules(rules: AlertRule[], snapshot: Record<string, number>): RuleEvaluation[] {
  return rules.map((rule) => {
    const value = rule.metric in snapshot ? snapshot[rule.metric] : null;
    const fired = rule.threshold !== null && value !== null && value >= rule.threshold;
    return { rule, value, fired };
  });
}

/** Règles déclenchées (triées par sévérité décroissante). */
export function firedRules(rules: AlertRule[], snapshot: Record<string, number>): RuleEvaluation[] {
  return evaluateRules(rules, snapshot)
    .filter((e) => e.fired)
    .sort((a, b) => severityRank(b.rule.severity) - severityRank(a.rule.severity));
}

/** Répartition des règles par sévérité. */
export function countBySeverity(rules: Pick<AlertRule, 'severity'>[]): Record<AlertSeverity, number> {
  const acc = { info: 0, warning: 0, critical: 0 } as Record<AlertSeverity, number>;
  for (const r of rules) acc[r.severity] += 1;
  return acc;
}

/** Sévérité la plus élevée parmi les règles déclenchées, ou null si aucune. */
export function highestFiredSeverity(evaluations: RuleEvaluation[]): AlertSeverity | null {
  const fired = evaluations.filter((e) => e.fired);
  if (fired.length === 0) return null;
  return fired.reduce<AlertSeverity>((best, e) => (severityRank(e.rule.severity) > severityRank(best) ? e.rule.severity : best), 'info');
}
