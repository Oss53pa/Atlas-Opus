/**
 * Recalcul du bilan (M4) — moteur déterministe unique (réf CLAUDE.md §7).
 * Source de vérité du calcul bilan : coût/recettes/marge/taux + TRI + besoin de
 * trésorerie, à partir des lignes déjà assemblées (postes saisis + dérivés M5/M7)
 * et des flux. TOUT montant via Money.ts (invariant §5) — jamais de flottant,
 * jamais un LLM. Le même moteur alimente l'écran (lecture) et le job asynchrone
 * (pg_cron « recalcul bilan »), qui fige ensuite les indicateurs dans un cliché
 * M21 (RG-M21-01). Pur et injectable (horloge `computedAt`) → rejouable.
 */
import { Money, type Currency } from '../money/Money';
import { bilanSummary, planTresorerie, type BilanLine, type BilanSummary } from './bilan';
import { tri as computeTri } from './tri';
import type { ReportData } from '../m21/reporting';

export interface BilanRecomputeInput {
  currency: Currency;
  /** Lignes déjà assemblées : postes saisis (hors dérivés) + dérivés M5/M7. */
  lines: BilanLine[];
  /** Recettes réalisées = encaissements « settled » (M6, RG-M6-02). */
  recettesRealisees: Money;
  /** Flux nets de trésorerie par période (encaissements − décaissements). */
  cashflow: number[];
  /** Budget à l'achèvement (BAC, EVM). */
  bac: Money;
  /** Horodatage du recalcul (ISO) — injecté pour un résultat rejouable. */
  computedAt: string;
}

export interface BilanRecompute {
  computedAt: string;
  currency: Currency;
  summary: BilanSummary;
  /** TRI (taux annulant la VAN des flux), ou null si indéterminé. */
  tri: number | null;
  bac: Money;
  /** Point bas de trésorerie cumulée (négatif ⇒ besoin de financement). */
  besoinTresorerie: number;
  /** Index de la période du point bas (−1 si série vide). */
  pointBasIndex: number;
  cashflow: number[];
}

/** Recalcule le bilan d'une opération (déterministe, Money.ts). */
export function recomputeBilan(input: BilanRecomputeInput): BilanRecompute {
  const summary = bilanSummary(input.lines, input.currency, input.recettesRealisees);
  const plan = planTresorerie(input.cashflow);
  return {
    computedAt: input.computedAt,
    currency: input.currency,
    summary,
    tri: computeTri(input.cashflow),
    bac: input.bac,
    besoinTresorerie: plan.besoinMax,
    pointBasIndex: plan.pointBasIndex,
    cashflow: input.cashflow,
  };
}

/** Indicateurs non financiers agrégés au cliché (calculés hors bilan). */
export interface RecomputeExtras {
  progress: number;
  alertsDanger: number;
  alertsEcheance: number;
}

/**
 * Pont M21 : fige les indicateurs financiers recalculés en `ReportData`
 * (unités majeures) pour le cliché de reporting. Le reporting ne recalcule
 * rien (RG-M21-01) — il consomme ce résultat.
 */
export function bilanRecomputeToReportData(r: BilanRecompute, extras: RecomputeExtras): ReportData {
  return {
    coutTotal: r.summary.coutTotal.toMajorNumber(),
    recettes: r.summary.recettes.toMajorNumber(),
    recettesRealisees: r.summary.recettesRealisees.toMajorNumber(),
    marge: r.summary.marge.toMajorNumber(),
    tauxMarge: r.summary.tauxMarge,
    tri: r.tri,
    progress: extras.progress,
    alertsDanger: extras.alertsDanger,
    alertsEcheance: extras.alertsEcheance,
  };
}
