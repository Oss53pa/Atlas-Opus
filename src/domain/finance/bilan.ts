/**
 * Contrats de calcul — Bilan, EVM, paiements (réf CLAUDE.md §6).
 * Tout montant via Money.ts ; les ratios (taux, indices) sont des `number`.
 */
import { Money, sumMoney, type Currency } from '../money/Money';

export interface BilanLine {
  kind: 'cost' | 'revenue';
  amount: Money;
}

export function coutTotal(lines: BilanLine[], currency: Currency): Money {
  return sumMoney(
    lines.filter((l) => l.kind === 'cost').map((l) => l.amount),
    currency,
  );
}

export function recettes(lines: BilanLine[], currency: Currency): Money {
  return sumMoney(
    lines.filter((l) => l.kind === 'revenue').map((l) => l.amount),
    currency,
  );
}

/** marge = recettes − coût total */
export function marge(lines: BilanLine[], currency: Currency): Money {
  return recettes(lines, currency).subtract(coutTotal(lines, currency));
}

/** taux_marge = marge / coût total (ratio ; 0 si coût nul) */
export function tauxMarge(lines: BilanLine[], currency: Currency): number {
  const cout = coutTotal(lines, currency);
  if (cout.isZero()) return 0;
  return marge(lines, currency).toMajorNumber() / cout.toMajorNumber();
}

export interface BilanSummary {
  coutTotal: Money;
  recettes: Money;
  /** Recettes réalisées (encaissements settled, M6). */
  recettesRealisees: Money;
  marge: Money;
  tauxMarge: number;
}

/**
 * `recettesRealisees` provient de M6 (encaissements « settled ») — source de
 * vérité des recettes réalisées — et n'est pas dérivée des lignes de bilan.
 */
export function bilanSummary(
  lines: BilanLine[],
  currency: Currency,
  recettesRealisees: Money = Money.zero(currency),
): BilanSummary {
  return {
    coutTotal: coutTotal(lines, currency),
    recettes: recettes(lines, currency),
    recettesRealisees,
    marge: marge(lines, currency),
    tauxMarge: tauxMarge(lines, currency),
  };
}

// ── EVM (Earned Value Management) — CPI=EV/AC, SPI=EV/PV, EAC=BAC/CPI, ETC, VAC ──
export function cpi(ev: Money, ac: Money): number {
  return ac.isZero() ? 0 : ev.toMajorNumber() / ac.toMajorNumber();
}
export function spi(ev: Money, pv: Money): number {
  return pv.isZero() ? 0 : ev.toMajorNumber() / pv.toMajorNumber();
}
export function eac(bac: Money, cpiValue: number): Money {
  if (cpiValue === 0) return bac;
  return bac.mulRate(1 / cpiValue);
}
export function etc(eacValue: Money, ac: Money): Money {
  return eacValue.subtract(ac);
}
export function vac(bac: Money, eacValue: Money): Money {
  return bac.subtract(eacValue);
}

// ── Chaîne de paiement ──────────────────────────────────────────────────────
/** amount_net = amount_gross − retention − avance_remboursee */
export function amountNet(gross: Money, retention: Money, avanceRemboursee: Money): Money {
  return gross.subtract(retention).subtract(avanceRemboursee);
}

/** penalite_retard = montant_marche × taux × jours_retard, plafonnée. */
export function penaliteRetard(montantMarche: Money, taux: number, joursRetard: number, plafond?: Money): Money {
  const brute = montantMarche.mulRate(taux).multiplyInt(Math.max(0, Math.trunc(joursRetard)));
  return plafond ? brute.min(plafond) : brute;
}

// ── Plan de trésorerie (M4) ─────────────────────────────────────────────────
export interface PlanTresorerie {
  /** Trésorerie cumulée par période : cumule[t] = Σ_{k≤t} flux[k]. */
  cumule: number[];
  /** Point bas = min(trésorerie cumulée) ; négatif ⇒ besoin de financement. */
  besoinMax: number;
  /** Index de la période du point bas (−1 si série vide). */
  pointBasIndex: number;
}

/**
 * Plan de trésorerie à partir des flux nets par période (encaissements −
 * décaissements). `besoinMax` = min du cumulé (réf CLAUDE.md §7 / Spec M4 §5).
 */
export function planTresorerie(flowsNets: number[]): PlanTresorerie {
  const cumule: number[] = [];
  let acc = 0;
  for (const f of flowsNets) {
    acc += f;
    cumule.push(acc);
  }
  let besoinMax = 0;
  let pointBasIndex = -1;
  cumule.forEach((v, i) => {
    if (pointBasIndex === -1 || v < besoinMax) {
      besoinMax = v;
      pointBasIndex = i;
    }
  });
  return { cumule, besoinMax, pointBasIndex };
}
