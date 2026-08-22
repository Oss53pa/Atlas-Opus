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

/**
 * Faits d'alerte d'une opération, déjà évalués par la couche appelante à partir
 * des indicateurs des modules (RG-M21-01 : aucun recalcul financier dans M21).
 */
export interface OperationAlertFacts {
  phase: string;
  status: string;
  endDate: string | null;
  today: string;
  margeNegative: boolean; // M4 (RG-M4-08)
  budgetOverrun: boolean; // M4 (coût > BAC)
  recettesRealiseesZero: boolean; // M6
}

/** Phases où des recettes sont attendues (déclenche l'alerte « aucune recette »). */
const REVENUE_PHASES = ['realisation', 'reception', 'exploitation'];

/**
 * Dérive les alertes consolidées & priorisées d'une opération à partir de ses
 * faits. Partagé par le cockpit opération et le cockpit portefeuille.
 */
export function deriveOperationAlerts(f: OperationAlertFacts): ConsolidatedAlert[] {
  const alerts: ConsolidatedAlert[] = [];
  if (f.margeNegative) alerts.push({ source: 'm4', severity: 'danger', labelKey: 'alerts.marginNegative' });
  if (f.budgetOverrun) alerts.push({ source: 'm4', severity: 'danger', labelKey: 'alerts.budgetOverrun' });
  if (REVENUE_PHASES.includes(f.phase) && f.recettesRealiseesZero)
    alerts.push({ source: 'm6', severity: 'echeance', labelKey: 'alerts.noRevenue' });
  if (f.endDate && f.endDate < f.today && f.status === 'active')
    alerts.push({ source: 'm12', severity: 'echeance', labelKey: 'alerts.deadlinePassed' });
  return consolidateAlerts(alerts);
}

/** Poids de sévérité pour le classement par risque du portefeuille. */
const RISK_WEIGHT: Record<AlertSeverity, number> = { danger: 100, echeance: 10, info: 1 };

/** Score de risque d'une opération = Σ poids des alertes (tri portefeuille). */
export function riskScore(alerts: ConsolidatedAlert[]): number {
  return alerts.reduce((s, a) => s + RISK_WEIGHT[a.severity], 0);
}
