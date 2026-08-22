/**
 * M6 — Commercialisation & recettes · types du domaine (réf Spec M6 §3), pur.
 * Montants via Money.ts. Mapping snake_case (ao_units / ao_sales / ao_receipts)
 * dans la couche données.
 */
import type { Money } from '../money/Money';

/** Unit : disponible → optionné → réservé → vendu | loué (§4). */
export const UNIT_STATUSES = ['disponible', 'optionne', 'reserve', 'vendu', 'loue'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export interface Unit {
  id: string;
  tenantId: string;
  operationId: string;
  lotId: string | null;
  typology: string;
  area: number;
  price: Money;
  status: UnitStatus;
}

/** Sale : draft → active → soldée | résiliée (§4). */
export const SALE_KINDS = ['reservation', 'lease'] as const;
export type SaleKind = (typeof SALE_KINDS)[number];

export const SALE_STATUSES = ['draft', 'active', 'soldee', 'resiliee'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** Un stade de l'échéancier (appel de fonds VEFA ou loyer). */
export interface ScheduleStage {
  key: string;
  /** Pourcentage réglementaire cumulé autorisé (0..1). */
  pct: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  operationId: string;
  kind: SaleKind;
  unitId: string | null;
  counterpart: string;
  amount: Money;
  schedule: ScheduleStage[];
  status: SaleStatus;
}

export const RECEIPT_METHODS = ['mobile_money', 'virement'] as const;
export type ReceiptMethod = (typeof RECEIPT_METHODS)[number];
export type ReceiptStatus = 'pending' | 'settled';

export interface Receipt {
  id: string;
  tenantId: string;
  saleId: string;
  amount: Money;
  method: ReceiptMethod;
  status: ReceiptStatus;
  reference: string | null;
}

export interface UnitInput {
  lotId?: string | null;
  typology: string;
  area: number;
  price: Money;
}

export interface SaleInput {
  kind: SaleKind;
  unitId?: string | null;
  counterpart: string;
  amount: Money;
  schedule?: ScheduleStage[];
}

export interface ReceiptInput {
  amount: Money;
  method: ReceiptMethod;
  reference?: string | null;
}
