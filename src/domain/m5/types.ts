/**
 * M5 — Financement & déblocages · types du domaine (réf Spec M5 §3), pur.
 * Montants via Money.ts ; taux/pourcentages en `number`. Le mapping snake_case
 * (ao_financing / ao_drawdowns) se fait dans la couche données.
 */
import type { Money } from '../money/Money';

export const FINANCING_SOURCES = ['credit_promoteur', 'bailleur', 'fonds_propres'] as const;
export type FinancingSource = (typeof FINANCING_SOURCES)[number];

/** Machine financing : négocié → accordé → en_cours → soldé (§4). */
export const FINANCING_STATUSES = ['negocie', 'accorde', 'en_cours', 'solde'] as const;
export type FinancingStatus = (typeof FINANCING_STATUSES)[number];

/** Machine drawdown : planifié → demandé → débloqué | refusé (§4). */
export const DRAWDOWN_STATUSES = ['planifie', 'demande', 'debloque', 'refuse'] as const;
export type DrawdownStatus = (typeof DRAWDOWN_STATUSES)[number];

export interface Financing {
  id: string;
  tenantId: string;
  operationId: string;
  source: FinancingSource;
  amount: Money;
  /** Taux annuel (ex. 0.09 = 9 %). */
  rate: number;
  status: FinancingStatus;
}

export interface Drawdown {
  id: string;
  tenantId: string;
  financingId: string;
  amount: Money;
  /** Avancement validé requis (0..1) — RG-M5-01. */
  condition: number;
  status: DrawdownStatus;
  /** Date de déblocage (ISO) — départ des intérêts intercalaires. */
  date: string | null;
}

export interface FinancingInput {
  source: FinancingSource;
  amount: Money;
  rate: number;
}

export interface DrawdownInput {
  amount: Money;
  condition: number;
}
