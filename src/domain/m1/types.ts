/**
 * M1 — Opération & Programme · types du domaine (réf Spec M1 §3).
 * Domaine pur : aucune dépendance UI/IO. Forme camelCase ; le mapping
 * snake_case (Supabase) se fait dans la couche données.
 */

export const PHASES = [
  'amont',
  'conception',
  'passation',
  'realisation',
  'reception',
  'exploitation',
  'cloture',
] as const;
export type Phase = (typeof PHASES)[number];

export const OP_TYPES = ['residential', 'commercial', 'public', 'mixed'] as const;
export type OpType = (typeof OP_TYPES)[number];

export type ProcurementMode = 'private' | 'public';
export type OperationStatus = 'active' | 'paused' | 'closed';

export const PROGRAM_CATEGORIES = [
  'surface',
  'usage',
  'exigence_fonctionnelle',
  'exigence_technique',
  'exigence_env',
] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];

export type ProgramItemStatus = 'draft' | 'validated';

export const ROLES = [
  'owner',
  'moa_director',
  'finance',
  'amo',
  'procurement',
  'commercial',
  'site',
  'stakeholder',
  'viewer',
] as const;
export type Role = (typeof ROLES)[number];

export interface Operation {
  id: string;
  tenantId: string;
  countryCode: string;
  name: string;
  opType: OpType;
  procurementMode: ProcurementMode;
  phase: Phase;
  currency: string;
  budgetBac: number;
  retentionRate: number;
  startDate: string | null;
  endDate: string | null;
  status: OperationStatus;
  createdAt: string;
  updatedAt: string;
  /** Champs joints pour l'affichage portefeuille (non persistés sur operations). */
  progress?: number;
  lastActivityAt?: string;
}

export interface ProgramItem {
  id: string;
  tenantId: string;
  operationId: string;
  category: ProgramCategory;
  label: string;
  targetValue: string | null;
  unit: string | null;
  version: number;
  status: ProgramItemStatus;
  createdAt: string;
  updatedAt: string;
  /** Couvert par la conception (M10) — sinon badge « non couvert » (écran 6.4). */
  covered?: boolean;
}

export interface ProgramItemDraft {
  category: ProgramCategory;
  label: string;
  targetValue?: string | null;
  unit?: string | null;
}

export interface CreateOperationInput {
  name: string;
  countryCode: string;
  opType: OpType;
  budgetBac?: number;
  retentionRate?: number;
  startDate?: string | null;
  endDate?: string | null;
  program?: ProgramItemDraft[];
}

export type OperationPatch = Partial<
  Pick<
    Operation,
    'name' | 'opType' | 'currency' | 'budgetBac' | 'retentionRate' | 'startDate' | 'endDate' | 'status'
  >
>;
