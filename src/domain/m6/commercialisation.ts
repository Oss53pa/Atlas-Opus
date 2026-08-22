/**
 * M6 — Machines à états & règles (réf Spec M6 §4/§5), pures.
 * RG-M6-01 : échéancier VEFA ≤ plafonds réglementaires par stade.
 * RG-M6-03 : « vendu » exige une réservation active préalable.
 * RG-M6-04 : appel de fonds conditionné à l'avancement validé (M13).
 * RG-M6-02 : encaissements « settled » → recettes du bilan (M4).
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import { echeancierVefa, type AppelDeFonds, type StadeVefa } from '../finance/vefa';
import type { Receipt, ScheduleStage, UnitStatus } from './types';

// ── Machine unit (§4) ───────────────────────────────────────────────────────
const UNIT_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  disponible: ['optionne'],
  optionne: ['reserve', 'disponible'],
  reserve: ['vendu', 'loue', 'disponible'],
  vendu: [],
  loue: [],
};
export function canTransitionUnit(from: UnitStatus, to: UnitStatus): boolean {
  return UNIT_TRANSITIONS[from].includes(to);
}

export type UnitDecision =
  | { ok: true; to: UnitStatus }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'reservation_required' };

/**
 * RG-M6-03 — Une unité ne peut passer « vendu » sans réservation active
 * préalable (préreq porté par le contexte). « loué » suit la même exigence.
 */
export function evaluateUnitTransition(
  from: UnitStatus,
  to: UnitStatus,
  ctx: { hasActiveReservation: boolean },
): UnitDecision {
  if (!canTransitionUnit(from, to)) return { ok: false, code: 'invalid_transition' };
  if ((to === 'vendu' || to === 'loue') && !ctx.hasActiveReservation) {
    return { ok: false, code: 'reservation_required' };
  }
  return { ok: true, to };
}

// ── Échéancier VEFA (§5) ────────────────────────────────────────────────────
/**
 * RG-M6-01 — Vérifie que chaque stade de l'échéancier respecte le plafond
 * réglementaire cumulé du stade correspondant. Retourne les clés en dépassement.
 */
export function vefaStagesInBreach(schedule: ScheduleStage[], plafonds: Record<string, number>): string[] {
  return schedule.filter((s) => plafonds[s.key] !== undefined && s.pct > plafonds[s.key]).map((s) => s.key);
}

export function vefaScheduleValid(schedule: ScheduleStage[], plafonds: Record<string, number>): boolean {
  return vefaStagesInBreach(schedule, plafonds).length === 0;
}

/** Construit l'échéancier VEFA (montants cumulés + incréments) — réutilise finance/vefa. */
export function buildVefaSchedule(prixVente: Money, schedule: ScheduleStage[]): AppelDeFonds[] {
  return echeancierVefa(prixVente, schedule as StadeVefa[]);
}

// ── Appels de fonds conditionnés à l'avancement (§5) ────────────────────────
/**
 * RG-M6-04 — Un appel de fonds à un stade n'est déclenchable que si l'avancement
 * validé (M13) atteint le pourcentage réglementaire du stade.
 */
export function appelDeFondsAutorise(avancementValide: number, stagePct: number): boolean {
  return avancementValide >= stagePct;
}

// ── Recettes → M4 (§5) ──────────────────────────────────────────────────────
/**
 * RG-M6-02 — Recettes encaissées = Σ des receipts « settled ». Alimente le
 * poste de recettes du bilan (ventes/loyers selon la nature).
 */
export function recettesEncaissees(receipts: Pick<Receipt, 'amount' | 'status'>[], currency: Currency): Money {
  return sumMoney(
    receipts.filter((r) => r.status === 'settled').map((r) => r.amount),
    currency,
  );
}
