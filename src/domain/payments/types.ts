/** M13–M15 — chaîne de paiement (marchés, décomptes). Domaine pur. */

export type ContractStatus = 'active' | 'closed';

export interface Contract {
  id: string;
  tenantId: string;
  operationId: string;
  reference: string;
  contractor: string;
  amount: number;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContractInput {
  reference: string;
  contractor: string;
  amount?: number;
}

export const DECOMPTE_STATUSES = ['draft', 'validated', 'mandated', 'paid'] as const;
export type DecompteStatus = (typeof DECOMPTE_STATUSES)[number];

export interface Decompte {
  id: string;
  tenantId: string;
  operationId: string;
  contractId: string;
  number: number;
  amountGross: number;
  retentionRate: number;
  amountNet: number;
  status: DecompteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DecompteInput {
  contractId: string;
  number: number;
  amountGross: number;
  retentionRate?: number;
}
