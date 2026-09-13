/**
 * M4/M5 (bilan & financement) — Lignes budgétaires. Budget autorisé de crédit
 * (BAC) par compte SYSCOHADA, socle de l'enveloppe de l'opération. Domaine pur.
 * Montants en unités majeures (number) ; tout calcul via Money.ts.
 * Table : ao_budget_lines (opération-scopée).
 */

export interface BudgetLine {
  id: string;
  tenantId: string;
  operationId: string;
  /** Compte SYSCOHADA (ex. « 2313 »). Le 1er chiffre donne la classe. */
  syscohadaAccount: string;
  label: string;
  /** Budget autorisé de crédit (unités majeures). */
  amountBac: number;
}

export interface BudgetLineInput {
  syscohadaAccount: string;
  label: string;
  amountBac: number;
}
