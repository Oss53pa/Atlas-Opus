/** Formes des lignes Supabase (snake_case) pour les tables ao_*. */
import type {
  OpType,
  OperationStatus,
  Phase,
  ProcurementMode,
  ProgramCategory,
  ProgramItemStatus,
} from '../../domain/m1/types';

export interface OperationRow {
  id: string;
  tenant_id: string;
  country_code: string;
  name: string;
  op_type: OpType;
  procurement_mode: ProcurementMode;
  phase: Phase;
  currency: string;
  budget_bac: number | string;
  retention_rate: number | string;
  start_date: string | null;
  end_date: string | null;
  status: OperationStatus;
  created_at: string;
  updated_at: string;
}

export interface BilanLineRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  kind: 'cost' | 'revenue';
  poste: string;
  amount_planned: number | string;
  amount_actual: number | string;
  created_at: string;
  updated_at: string;
}

export interface StakeholderRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
  mission: string | null;
  fee_amount: number | string;
  created_at: string;
  updated_at: string;
}

export interface ContractRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  reference: string;
  contractor: string;
  amount: number | string;
  status: 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface DecompteRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  contract_id: string;
  number: number;
  amount_gross: number | string;
  retention_rate: number | string;
  amount_net: number | string;
  status: 'draft' | 'validated' | 'mandated' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_milestone: boolean;
  is_critical: boolean;
  progress: number | string;
  created_at: string;
  updated_at: string;
}

export interface TenderRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  mode: 'private' | 'public';
  procedure: 'AOO' | 'AOR' | 'consultation' | 'gre_a_gre' | null;
  object: string;
  threshold_ok: boolean | null;
  ano_required: boolean;
  status: 'planned' | 'published' | 'opened' | 'evaluated' | 'awarded' | 'notified';
  awarded_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramItemRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  category: ProgramCategory;
  label: string;
  target_value: string | null;
  unit: string | null;
  version: number;
  status: ProgramItemStatus;
  covered: boolean | null;
  created_at: string;
  updated_at: string;
}
