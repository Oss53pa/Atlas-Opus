/** M2 — Intervenants (réf schema.sql §6). Domaine pur. */

export const STAKEHOLDER_TYPES = [
  'moe',
  'amo',
  'bet',
  'ct',
  'csps',
  'notaire',
  'banque',
  'assureur',
  'entreprise',
  'concessionnaire',
  'exploitant',
  'admin',
] as const;
export type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];

export interface Stakeholder {
  id: string;
  tenantId: string;
  operationId: string;
  type: StakeholderType;
  name: string;
  email: string | null;
  phone: string | null;
  mission: string | null;
  feeAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StakeholderInput {
  type: StakeholderType;
  name: string;
  email?: string | null;
  phone?: string | null;
  mission?: string | null;
  feeAmount?: number;
}

export type StakeholderPatch = Partial<
  Pick<Stakeholder, 'type' | 'name' | 'email' | 'phone' | 'mission' | 'feeAmount'>
>;
