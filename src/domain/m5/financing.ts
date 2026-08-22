/**
 * M5 — Machines à états & règles de gestion (réf Spec M5 §4/§5), pures.
 * RG-M5-01 : déblocage conditionné à l'avancement validé (M13).
 * RG-M5-02 : intérêts intercalaires → poste « frais_financiers » (M4).
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { DrawdownStatus, FinancingStatus } from './types';

// ── Machine financing ───────────────────────────────────────────────────────
const FINANCING_TRANSITIONS: Record<FinancingStatus, FinancingStatus[]> = {
  negocie: ['accorde'],
  accorde: ['en_cours'],
  en_cours: ['solde'],
  solde: [],
};
export function canTransitionFinancing(from: FinancingStatus, to: FinancingStatus): boolean {
  return FINANCING_TRANSITIONS[from].includes(to);
}

// ── Machine drawdown ────────────────────────────────────────────────────────
const DRAWDOWN_TRANSITIONS: Record<DrawdownStatus, DrawdownStatus[]> = {
  planifie: ['demande'],
  demande: ['debloque', 'refuse'],
  debloque: [],
  refuse: [],
};

export type DrawdownDecision =
  | { ok: true; to: DrawdownStatus }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'progress_insufficient' };

/** RG-M5-01 — Un déblocage exige l'avancement validé ≥ condition de la tranche. */
export function deblocageAutorise(avancementValide: number, condition: number): boolean {
  return avancementValide >= condition;
}

/**
 * Évalue une transition de drawdown. Le passage à « débloqué » exige que
 * l'avancement validé (M13) atteigne la condition de la tranche (RG-M5-01).
 */
export function evaluateDrawdown(
  from: DrawdownStatus,
  to: DrawdownStatus,
  ctx: { validatedProgress: number; condition: number },
): DrawdownDecision {
  if (!DRAWDOWN_TRANSITIONS[from].includes(to)) return { ok: false, code: 'invalid_transition' };
  if (to === 'debloque' && !deblocageAutorise(ctx.validatedProgress, ctx.condition)) {
    return { ok: false, code: 'progress_insufficient' };
  }
  return { ok: true, to };
}

// ── Intérêts intercalaires (§5) ─────────────────────────────────────────────
/** intérêts = capital décaissé × taux annuel × durée(jours)/360. */
export function interetsIntercalairesJours(capitalDecaisse: Money, tauxAnnuel: number, jours: number): Money {
  return capitalDecaisse.mulRate((tauxAnnuel * jours) / 360);
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.max(0, Math.floor((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000));
}

/**
 * RG-M5-02 — Frais financiers = Σ des intérêts intercalaires des tranches
 * débloquées, courus de leur date de déblocage à `asOf`. Alimente le poste
 * « frais_financiers » du bilan (M4).
 */
export function fraisFinanciersFromDrawdowns(
  items: { amount: Money; rate: number; date: string | null; status: DrawdownStatus }[],
  asOf: string,
  currency: Currency,
): Money {
  const interests = items
    .filter((d) => d.status === 'debloque' && d.date)
    .map((d) => interetsIntercalairesJours(d.amount, d.rate, daysBetween(d.date as string, asOf)));
  return sumMoney(interests, currency);
}

/**
 * RG §8 — La somme des tranches ne peut dépasser le montant accordé.
 */
export function sommeTranchesValide(tranches: Money[], montantAccorde: Money, currency: Currency): boolean {
  return sumMoney(tranches, currency).lte(montantAccorde);
}
