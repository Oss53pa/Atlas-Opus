/**
 * F6 — Fiscalité, logique pure et testable (réf CLAUDE.md §7).
 * TVA, retenues (source + garantie), net à payer et révision de prix. TOUT
 * calcul via Money.ts — jamais de flottant, jamais un LLM (invariant §5).
 */
import { Money } from '../money/Money';
import { getCountry, type WhtNature } from '../country';
import type { FiscalContext, PaymentBreakdown, PaymentInput, RevisionTerm } from './types';

/** TVA = base_ht × vat_rate(pays). */
export function vat(baseHT: Money, vatRate: number): Money {
  return baseHT.mulRate(vatRate);
}

/** Retenue à la source = base × wht_rules(pays) (précompte / IRVM selon nature). */
export function retenueSource(base: Money, whtRate: number): Money {
  return base.mulRate(whtRate);
}

/** Retenue de garantie = brut × operation.retention_rate. */
export function retenueGarantie(brut: Money, retentionRate: number): Money {
  return brut.mulRate(retentionRate);
}

/**
 * Contexte fiscal d'une prestation : TVA + retenue à la source dérivées du pays
 * (country_config) selon la nature, retenue de garantie portée par l'opération.
 * Pays inconnu → taux nuls (dégradé sûr : aucune retenue fantôme).
 */
export function fiscalContext(countryCode: string, nature: WhtNature, retentionRate: number): FiscalContext {
  const c = getCountry(countryCode);
  return {
    vatRate: c?.vatRate ?? 0,
    whtRate: c?.whtRates[nature] ?? 0,
    retentionRate,
  };
}

/**
 * Net à payer d'un décompte (§7) :
 *   net = base_ht + tva − retenue_source − retenue_garantie − avance − pénalités.
 * `retenue_source` est calculée sur la base HT (convention OHADA retenue ici).
 */
export function computePayment(input: PaymentInput): PaymentBreakdown {
  const baseHT = input.brut;
  const currency = baseHT.currency;
  const avanceRemboursee = input.avanceRemboursee ?? Money.zero(currency);
  const penalites = input.penalites ?? Money.zero(currency);

  const tva = vat(baseHT, input.vatRate);
  const rSource = retenueSource(baseHT, input.whtRate);
  const rGarantie = retenueGarantie(baseHT, input.retentionRate);

  const netAPayer = baseHT
    .add(tva)
    .subtract(rSource)
    .subtract(rGarantie)
    .subtract(avanceRemboursee)
    .subtract(penalites);

  return { baseHT, tva, retenueSource: rSource, retenueGarantie: rGarantie, avanceRemboursee, penalites, netAPayer };
}

// ── Révision de prix (marchés, v4.1) ─────────────────────────────────────────

/** Coefficient de révision = a0 + Σ a_i · I_i / I_i,0. */
export function revisionCoefficient(a0: number, terms: RevisionTerm[]): number {
  return terms.reduce((acc, t) => acc + (t.index0 === 0 ? 0 : (t.weight * t.index) / t.index0), a0);
}

/** montant_revise = montant_base × coefficient(a0, indices). */
export function reviseAmount(base: Money, a0: number, terms: RevisionTerm[]): Money {
  return base.mulRate(revisionCoefficient(a0, terms));
}
