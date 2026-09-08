/**
 * F6 — Fiscalité (TVA + retenues OHADA) · types du domaine, purs (CLAUDE.md §7).
 * Tout montant est un `Money` (centimes exacts) ; les taux sont des ratios 0..1
 * hérités de country_config (jamais codés en dur côté écran).
 */
import type { Money } from '../money/Money';

/** Contexte fiscal résolu pour une prestation (dérivé du pays + de l'opération). */
export interface FiscalContext {
  /** Taux de TVA du régime. */
  vatRate: number;
  /** Taux de retenue à la source (précompte/IRVM) selon la nature. */
  whtRate: number;
  /** Taux de retenue de garantie (porté par l'opération). */
  retentionRate: number;
}

/** Entrée de calcul d'un net à payer (décompte / situation, M15). */
export interface PaymentInput {
  /** Brut des travaux (base HT). */
  brut: Money;
  vatRate: number;
  whtRate: number;
  retentionRate: number;
  /** Avance forfaitaire remboursée sur ce décompte (0 par défaut). */
  avanceRemboursee?: Money;
  /** Pénalités de retard déjà calculées (0 par défaut). */
  penalites?: Money;
}

/** Décomposition complète du net à payer (RG-M15, §7). */
export interface PaymentBreakdown {
  baseHT: Money;
  tva: Money;
  retenueSource: Money;
  retenueGarantie: Money;
  avanceRemboursee: Money;
  penalites: Money;
  /** base_ht + tva − retenue_source − retenue_garantie − avance − pénalités. */
  netAPayer: Money;
}

/** Terme d'une formule de révision de prix (marchés, v4.1) : poids · I/I0. */
export interface RevisionTerm {
  /** Coefficient de pondération (a_i). */
  weight: number;
  /** Indice courant (I_i). */
  index: number;
  /** Indice de référence (I_i,0) — non nul. */
  index0: number;
}
