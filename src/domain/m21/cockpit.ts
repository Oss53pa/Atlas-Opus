/**
 * M21 — Consolidation & priorisation des alertes (réf Spec M21 §5), pur.
 * RG-M21-02 : tri par sévérité danger > échéance > info, stable à sévérité égale.
 * RG-M21-01 : le cockpit lit les indicateurs déjà calculés par les modules ;
 * il n'y a AUCUN recalcul financier ici.
 */
import { ALERT_SEVERITIES, type AlertSeverity, type ConsolidatedAlert } from './types';

/** Rang de priorité (0 = plus prioritaire) — danger > échéance > info. */
export function severityRank(severity: AlertSeverity): number {
  return ALERT_SEVERITIES.indexOf(severity);
}

/**
 * RG-M21-02 — Consolide et priorise les alertes par sévérité. Le tri est
 * stable : à sévérité égale, l'ordre d'agrégation (par module) est conservé.
 */
export function consolidateAlerts(alerts: ConsolidatedAlert[]): ConsolidatedAlert[] {
  return alerts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => severityRank(x.a.severity) - severityRank(y.a.severity) || x.i - y.i)
    .map((x) => x.a);
}

/** Nombre d'alertes d'une sévérité donnée (badges du cockpit). */
export function countBySeverity(alerts: ConsolidatedAlert[], severity: AlertSeverity): number {
  return alerts.filter((a) => a.severity === severity).length;
}
