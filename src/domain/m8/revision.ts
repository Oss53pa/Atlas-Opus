/**
 * M8 — Révision de prix d'un marché (v4.1, réf CLAUDE.md §7).
 * montant_revise = montant_base × (a0 + Σ aᵢ·Iᵢ/Iᵢ₀). Le coefficient et le montant
 * révisé sont calculés via F6 (Money.ts) côté appelant ; l'enregistrement fige le
 * résultat. Montants en unités majeures (JSON-safe pour la file offline).
 */
import type { RevisionTerm } from '../f6/types';

export interface PriceRevision {
  id: string;
  tenantId: string;
  operationId: string;
  /** Marché (ao_contracts) concerné. */
  contractId: string;
  /** Montant de base avant révision. */
  baseAmount: number;
  /** Part fixe a0 de la formule. */
  a0: number;
  /** Termes indiciels (poids · I/I0). */
  terms: RevisionTerm[];
  /** Coefficient de révision calculé (a0 + Σ aᵢ·Iᵢ/Iᵢ₀). */
  coefficient: number;
  /** Montant révisé figé (Money.ts). */
  revisedAmount: number;
  /** Date d'enregistrement (ISO). */
  at: string;
}

export interface PriceRevisionInput {
  contractId: string;
  baseAmount: number;
  a0: number;
  terms: RevisionTerm[];
  /** Coefficient + montant révisé calculés côté appelant via F6 (Money.ts). */
  coefficient: number;
  revisedAmount: number;
}
