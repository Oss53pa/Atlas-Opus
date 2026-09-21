/**
 * M5 — Machines à états & règles de gestion (réf Spec M5 §4/§5), pures.
 * RG-M5-01 : déblocage conditionné à l'avancement validé (M13).
 * RG-M5-02 : intérêts intercalaires → poste « frais_financiers » (M4).
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { DrawdownStatus, Financing, FinancingStatus } from './types';

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

/** Garde structurelle d'une transition de tranche (hors condition d'avancement). */
export function canTransitionDrawdown(from: DrawdownStatus, to: DrawdownStatus): boolean {
  return DRAWDOWN_TRANSITIONS[from].includes(to);
}

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

// ── Remboursement & plan de financement (transposé d'Advancity) ─────────────

/**
 * Échéance mensuelle d'un financement. In fine : intérêts seuls, le capital est
 * dû au terme. Amortissable : m = P·i / (1 − (1+i)^−n), i = taux/12 (taux nul →
 * amortissement linéaire). null si la durée n'est pas connue ou pour des fonds propres.
 */
export function echeanceMensuelle(
  f: Pick<Financing, 'amount' | 'rate' | 'durationMonths' | 'repayment' | 'source'>,
): Money | null {
  if (f.source === 'fonds_propres') return null;
  if (f.repayment === 'in_fine') return f.amount.mulRate(f.rate / 12);
  if (!f.durationMonths || f.durationMonths <= 0) return null;
  if (f.rate === 0) return f.amount.divide(f.durationMonths);
  const i = f.rate / 12;
  return f.amount.mulRate(i / (1 - Math.pow(1 + i, -f.durationMonths)));
}

/** Coût total du crédit (intérêts cumulés sur la durée). null si durée inconnue. */
export function coutCredit(
  f: Pick<Financing, 'amount' | 'rate' | 'durationMonths' | 'repayment' | 'source'>,
): Money | null {
  if (f.source === 'fonds_propres' || !f.durationMonths || f.durationMonths <= 0) return null;
  if (f.repayment === 'in_fine') return f.amount.mulRate(f.rate * (f.durationMonths / 12));
  const m = echeanceMensuelle(f);
  return m ? m.multiplyInt(f.durationMonths).subtract(f.amount) : null;
}

/** Financements considérés comme acquis (hors simple négociation). */
export function isMobilise(f: Pick<Financing, 'status'>): boolean {
  return f.status !== 'negocie';
}

export interface PlanFinancement {
  besoin: Money;
  fondsPropres: Money;
  dette: Money;
  /** Ressources acquises (fonds propres + dette hors négociation). */
  ressources: Money;
  /** Montant encore en négociation (non compté dans les ressources). */
  enNegociation: Money;
  /** ressources / besoin (0 si besoin nul). */
  couverture: number;
  /** ressources − besoin : négatif = financement à boucler. */
  ecart: Money;
  /** dette / ressources. */
  levier: number;
}

/** Plan de financement : confronte le besoin (coût total du bilan M4) aux ressources. */
export function planFinancement(besoin: Money, financings: Financing[]): PlanFinancement {
  const c = besoin.currency;
  const acquis = financings.filter(isMobilise);
  const fondsPropres = sumMoney(acquis.filter((f) => f.source === 'fonds_propres').map((f) => f.amount), c);
  const dette = sumMoney(acquis.filter((f) => f.source !== 'fonds_propres').map((f) => f.amount), c);
  const enNegociation = sumMoney(financings.filter((f) => !isMobilise(f)).map((f) => f.amount), c);
  const ressources = fondsPropres.add(dette);
  return {
    besoin, fondsPropres, dette, ressources, enNegociation,
    couverture: besoin.isZero() ? 0 : ressources.toMajorNumber() / besoin.toMajorNumber(),
    ecart: ressources.subtract(besoin),
    levier: ressources.isZero() ? 0 : dette.toMajorNumber() / ressources.toMajorNumber(),
  };
}

/** Service de la dette mensuel (financements acquis dont l'échéance est connue). */
export function serviceDetteMensuel(financings: Financing[], currency: Currency): Money {
  return sumMoney(
    financings.filter(isMobilise).map((f) => echeanceMensuelle(f)).filter((m): m is Money => m !== null),
    currency,
  );
}
