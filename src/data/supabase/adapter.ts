/**
 * Adaptateur Supabase — implémente les mêmes interfaces que le mock.
 * Tables ao_operations / ao_program_items, RLS par tenant (user_tenants).
 * L'isolation est garantie côté Postgres ; ici on mappe snake_case ↔ camelCase.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildNewOperation } from '../../domain/m1/rules';
import { Money } from '../../domain/money/Money';
import { bilanSummary, type BilanLine } from '../../domain/finance/bilan';
import type {
  CreateOperationInput,
  Operation,
  OperationPatch,
  OperationStatus,
  Phase,
  ProgramItem,
  ProgramItemDraft,
} from '../../domain/m1/types';
import type { TransitionContext } from '../../domain/m1/stateMachine';
import { permitGate, type Authorization, type AuthorizationInput, type AuthorizationType, type AuthorizationStatus } from '../../domain/m2/authorizations';
import { ddGate, type DueDiligenceItem, type DueDiligenceInput, type DueDiligenceStatus, type DueDiligenceCategory, type DueDiligenceSeverity } from '../../domain/m2/dueDiligence';
import { doGate, honorairesFromStakeholders } from '../../domain/m7/rules';
import type { Insurance, InsuranceInput, InsuranceType } from '../../domain/m7/types';
import { getCountry } from '../../domain/country';
import type { Telemetry } from '../../lib/telemetry';
import type {
  BilanLineInput,
  BilanLinePatch,
  BilanLineRecord,
  BilanRepo,
  BilanView,
  OperationFilter,
  OperationsRepo,
  ProgramItemPatch,
  ProgramRepo,
  Session,
} from '../repo';
import type { Stakeholder, StakeholderInput, StakeholderPatch, StakeholderType } from '../../domain/m2/types';
import type { Contract, ContractInput, Decompte, DecompteInput, DecompteStatus } from '../../domain/payments/types';
import { decompteNet } from '../../domain/payments/decompte';
import type { Task, TaskInput, TaskPatch } from '../../domain/m12/types';
import type { Tender, TenderInput, TenderStatus } from '../../domain/m8/types';
import type { StakeholdersRepo, ComplianceRepo, PaymentsRepo, PlanningRepo, TendersRepo } from '../repo';
import type { BilanLineRow, ContractRow, DecompteRow, OperationRow, ProgramItemRow, StakeholderRow, TaskRow, TenderRow } from './types';

const BL = 'ao_bilan_lines';
const ST = 'ao_stakeholders';
const CT = 'ao_contracts';
const DC = 'ao_decomptes';
const TK = 'ao_tasks';
const TD = 'ao_tenders';

const OPS = 'ao_operations';
const ITEMS = 'ao_program_items';
const AUTH = 'ao_authorizations';
const INS = 'ao_insurances';
const DD = 'ao_due_diligence_items';

/** Date du jour (ISO YYYY-MM-DD) pour l'évaluation des gardes d'échéance. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyCtx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  validatedProgramItems: 0,
  bilanInitialized: false,
  ddCleared: true,
  marketsToLaunch: 0,
  marketsNotified: 0,
  permitGranted: false,
  doInsuranceValid: false,
  globalProgress: 0,
  receptionDeclaredByDirector: false,
  receptionPvIssued: false,
  majorReservesLifted: false,
  finalBilanValidated: false,
  ...over,
});

function toOperation(r: OperationRow): Operation {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    countryCode: r.country_code,
    name: r.name,
    opType: r.op_type,
    procurementMode: r.procurement_mode,
    phase: r.phase,
    currency: r.currency,
    budgetBac: Number(r.budget_bac),
    retentionRate: Number(r.retention_rate),
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastActivityAt: r.updated_at,
  };
}

function toItem(r: ProgramItemRow): ProgramItem {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    operationId: r.operation_id,
    category: r.category,
    label: r.label,
    targetValue: r.target_value,
    unit: r.unit,
    version: r.version,
    status: r.status,
    covered: r.covered ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function createSupabaseOperationsRepo(
  client: SupabaseClient,
  session: Session,
  telemetry: Telemetry,
): OperationsRepo {
  const validatedCount = async (opId: string): Promise<number> => {
    const { data } = await client.from(ITEMS).select('version').eq('operation_id', opId).eq('status', 'validated');
    const versions = (data ?? []).map((r: { version: number }) => r.version);
    if (versions.length === 0) return 0;
    const latest = Math.max(...versions);
    return versions.filter((v) => v === latest).length;
  };

  // RG-M2-07 — garde permis dérivée de ao_authorizations via le domaine M2.
  const permitGrantedFor = async (opId: string): Promise<boolean> => {
    const { data } = await client.from(AUTH).select('type,status,validity').eq('operation_id', opId);
    const rows = (data ?? []) as { type: AuthorizationType; status: AuthorizationStatus; validity: string | null }[];
    return permitGate(rows, todayIso()).ok;
  };

  // RG-M7-04 — garde DO dérivée de ao_insurances via le domaine M7.
  const doInsuranceValidFor = async (opId: string): Promise<boolean> => {
    const { data } = await client.from(INS).select('type,valid_to').eq('operation_id', opId);
    const rows = (data ?? []).map((r: { type: InsuranceType; valid_to: string | null }) => ({
      type: r.type,
      validTo: r.valid_to,
    }));
    return doGate(rows, todayIso()).ok;
  };

  // RG-M2-03 — garde DD dérivée de ao_due_diligence_items via le domaine M2.
  const ddClearedFor = async (opId: string): Promise<boolean> => {
    const { data } = await client.from(DD).select('id,severity,status').eq('operation_id', opId);
    const rows = (data ?? []) as DueDiligenceItem[];
    return ddGate(rows).ok;
  };

  return {
    async list(filter: OperationFilter = {}) {
      let q = client.from(OPS).select('*').order('updated_at', { ascending: false });
      if (filter.phase) q = q.eq('phase', filter.phase);
      if (filter.opType) q = q.eq('op_type', filter.opType);
      if (filter.countryCode) q = q.eq('country_code', filter.countryCode);
      if (filter.status) q = q.eq('status', filter.status);
      if (filter.search) q = q.ilike('name', `%${filter.search}%`);
      const rows = unwrap(await q) as OperationRow[];
      return rows.map(toOperation);
    },

    async get(id) {
      const { data, error } = await client.from(OPS).select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toOperation(data as OperationRow) : null;
    },

    async existingNames(excludeId) {
      let q = client.from(OPS).select('name');
      if (excludeId) q = q.neq('id', excludeId);
      const rows = unwrap(await q) as { name: string }[];
      return rows.map((r) => r.name);
    },

    async create(input: CreateOperationInput) {
      const country = getCountry(input.countryCode);
      if (!country) throw new Error('country_not_found');
      // Réutilise les règles du domaine (phase amont, héritage devise/retenue).
      const draft = buildNewOperation(input, country, { id: '', tenantId: session.tenantId, now: '' });
      const insert = {
        tenant_id: session.tenantId,
        country_code: draft.countryCode,
        name: draft.name,
        op_type: draft.opType,
        procurement_mode: draft.procurementMode,
        phase: draft.phase,
        currency: draft.currency,
        budget_bac: draft.budgetBac,
        retention_rate: draft.retentionRate,
        start_date: draft.startDate,
        end_date: draft.endDate,
        status: draft.status,
      };
      const row = unwrap(await client.from(OPS).insert(insert).select('*').single()) as OperationRow;
      const op = toOperation(row);
      if (input.program?.length) {
        await client.from(ITEMS).insert(
          input.program.map((p) => ({
            tenant_id: session.tenantId,
            operation_id: op.id,
            category: p.category,
            label: p.label,
            target_value: p.targetValue ?? null,
            unit: p.unit ?? null,
            version: 1,
            status: 'draft',
            covered: false,
          })),
        );
      }
      telemetry.emit({ name: 'operation.created', operationId: op.id, opType: op.opType, countryCode: op.countryCode });
      return op;
    },

    async update(id, patch: OperationPatch) {
      const upd: Record<string, unknown> = {};
      if (patch.name !== undefined) upd.name = patch.name;
      if (patch.opType !== undefined) upd.op_type = patch.opType;
      if (patch.currency !== undefined) upd.currency = patch.currency;
      if (patch.budgetBac !== undefined) upd.budget_bac = patch.budgetBac;
      if (patch.retentionRate !== undefined) upd.retention_rate = patch.retentionRate;
      if (patch.startDate !== undefined) upd.start_date = patch.startDate;
      if (patch.endDate !== undefined) upd.end_date = patch.endDate;
      if (patch.status !== undefined) upd.status = patch.status;
      const row = unwrap(await client.from(OPS).update(upd).eq('id', id).select('*').single()) as OperationRow;
      telemetry.emit({ name: 'operation.updated', operationId: id, changedFields: Object.keys(patch) });
      return toOperation(row);
    },

    async setStatus(id, status: OperationStatus) {
      const row = unwrap(await client.from(OPS).update({ status }).eq('id', id).select('*').single()) as OperationRow;
      telemetry.emit({ name: 'operation.updated', operationId: id, changedFields: ['status'] });
      return toOperation(row);
    },

    async getTransitionContext(id) {
      // M4/M8/M11 non branchés en base ; bilanInitialized faux pour l'instant.
      // Gardes M2 (permis, DD) et M7 (DO) dérivées des tables dédiées.
      const [validatedProgramItems, permitGranted, doInsuranceValid, ddCleared] = await Promise.all([
        validatedCount(id),
        permitGrantedFor(id),
        doInsuranceValidFor(id),
        ddClearedFor(id),
      ]);
      return emptyCtx({ validatedProgramItems, permitGranted, doInsuranceValid, ddCleared });
    },

    async setPhase(id, to: Phase) {
      const current = unwrap(await client.from(OPS).select('phase').eq('id', id).single()) as { phase: Phase };
      const row = unwrap(await client.from(OPS).update({ phase: to }).eq('id', id).select('*').single()) as OperationRow;
      telemetry.emit({ name: 'operation.phase_changed', operationId: id, from: current.phase, to, actor: session.userId });
      return toOperation(row);
    },
  };
}

export function createSupabaseProgramRepo(
  client: SupabaseClient,
  session: Session,
  telemetry: Telemetry,
): ProgramRepo {
  const currentVersion = async (opId: string): Promise<number> => {
    const { data } = await client
      .from(ITEMS)
      .select('version')
      .eq('operation_id', opId)
      .order('version', { ascending: false })
      .limit(1);
    return data && data.length ? (data[0] as { version: number }).version : 1;
  };

  return {
    async list(opId, version) {
      const v = version ?? (await currentVersion(opId));
      const rows = unwrap(await client.from(ITEMS).select('*').eq('operation_id', opId).eq('version', v)) as ProgramItemRow[];
      return rows.map(toItem);
    },

    async versions(opId) {
      const rows = unwrap(
        await client.from(ITEMS).select('version').eq('operation_id', opId).eq('status', 'validated'),
      ) as { version: number }[];
      return [...new Set(rows.map((r) => r.version))].sort((a, b) => a - b);
    },

    async currentVersion(opId) {
      return currentVersion(opId);
    },

    async add(opId, draft: ProgramItemDraft) {
      const v = await currentVersion(opId);
      const row = unwrap(
        await client
          .from(ITEMS)
          .insert({
            tenant_id: session.tenantId,
            operation_id: opId,
            category: draft.category,
            label: draft.label,
            target_value: draft.targetValue ?? null,
            unit: draft.unit ?? null,
            version: v,
            status: 'draft',
            covered: false,
          })
          .select('*')
          .single(),
      ) as ProgramItemRow;
      return toItem(row);
    },

    async update(id, patch: ProgramItemPatch) {
      const upd: Record<string, unknown> = {};
      if (patch.label !== undefined) upd.label = patch.label;
      if (patch.targetValue !== undefined) upd.target_value = patch.targetValue;
      if (patch.unit !== undefined) upd.unit = patch.unit;
      if (patch.category !== undefined) upd.category = patch.category;
      const row = unwrap(await client.from(ITEMS).update(upd).eq('id', id).select('*').single()) as ProgramItemRow;
      return toItem(row);
    },

    async remove(id) {
      const { error } = await client.from(ITEMS).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async validateVersion(opId) {
      const v = await currentVersion(opId);
      const items = unwrap(await client.from(ITEMS).select('*').eq('operation_id', opId).eq('version', v)) as ProgramItemRow[];
      await client.from(ITEMS).update({ status: 'validated' }).eq('operation_id', opId).eq('version', v);
      if (items.length) {
        await client.from(ITEMS).insert(
          items.map((it) => ({
            tenant_id: session.tenantId,
            operation_id: opId,
            category: it.category,
            label: it.label,
            target_value: it.target_value,
            unit: it.unit,
            version: v + 1,
            status: 'draft',
            covered: it.covered,
          })),
        );
      }
      telemetry.emit({ name: 'program.version_created', operationId: opId, version: v });
      return v;
    },
  };
}

function toBilanRecord(r: BilanLineRow): BilanLineRecord {
  return {
    id: r.id,
    operationId: r.operation_id,
    kind: r.kind,
    poste: r.poste,
    amountPlanned: Number(r.amount_planned),
    amountActual: Number(r.amount_actual),
  };
}

/** Bilan (M4) depuis ao_bilan_lines. TRI null tant que les cash-flows ne sont pas en base. */
export function createSupabaseBilanRepo(client: SupabaseClient, session: Session): BilanRepo {
  // RG-M7-09 — honoraires dérivés des intervenants (source de vérité M7).
  const honorairesFor = async (opId: string, currency: string): Promise<Money> => {
    const { data } = await client.from(ST).select('type, fee_amount').eq('operation_id', opId);
    const items = (data ?? []).map((r: { type: StakeholderType; fee_amount: number | string }) => ({
      type: r.type,
      feeAmount: Number(r.fee_amount),
    }));
    return honorairesFromStakeholders(items, currency);
  };

  return {
    async summary(opId): Promise<BilanView | null> {
      const { data: op } = await client.from(OPS).select('currency, budget_bac').eq('id', opId).maybeSingle();
      if (!op) return null;
      const currency = (op as { currency: string }).currency;
      const rows = unwrap(await client.from(BL).select('kind, poste, amount_planned').eq('operation_id', opId)) as {
        kind: 'cost' | 'revenue';
        poste: string;
        amount_planned: number | string;
      }[];
      const lines: BilanLine[] = rows
        .filter((r) => !(r.kind === 'cost' && r.poste === 'honoraires'))
        .map((r) => ({ kind: r.kind, amount: Money.of(Number(r.amount_planned), currency) }));
      const hono = await honorairesFor(opId, currency);
      if (!hono.isZero()) lines.push({ kind: 'cost', amount: hono });
      return {
        summary: bilanSummary(lines, currency),
        tri: null,
        bac: Money.of(Number((op as { budget_bac: number | string }).budget_bac), currency),
      };
    },

    async lines(opId) {
      const { data: op } = await client.from(OPS).select('currency').eq('id', opId).maybeSingle();
      const currency = op ? (op as { currency: string }).currency : 'XOF';
      const rows = unwrap(await client.from(BL).select('*').eq('operation_id', opId).order('created_at')) as BilanLineRow[];
      const records = rows.filter((r) => !(r.kind === 'cost' && r.poste === 'honoraires')).map(toBilanRecord);
      const hono = await honorairesFor(opId, currency);
      if (!hono.isZero()) {
        const amount = hono.toMajorNumber();
        records.push({ id: `honoraires-m7-${opId}`, operationId: opId, kind: 'cost', poste: 'honoraires', amountPlanned: amount, amountActual: amount });
      }
      return records;
    },

    async addLine(opId, input: BilanLineInput) {
      const row = unwrap(
        await client
          .from(BL)
          .insert({
            tenant_id: session.tenantId,
            operation_id: opId,
            kind: input.kind,
            poste: input.poste,
            amount_planned: input.amountPlanned,
            amount_actual: input.amountActual ?? 0,
          })
          .select('*')
          .single(),
      ) as BilanLineRow;
      return toBilanRecord(row);
    },

    async updateLine(lineId, patch: BilanLinePatch) {
      const upd: Record<string, unknown> = {};
      if (patch.poste !== undefined) upd.poste = patch.poste;
      if (patch.amountPlanned !== undefined) upd.amount_planned = patch.amountPlanned;
      if (patch.amountActual !== undefined) upd.amount_actual = patch.amountActual;
      const row = unwrap(await client.from(BL).update(upd).eq('id', lineId).select('*').single()) as BilanLineRow;
      return toBilanRecord(row);
    },

    async removeLine(lineId) {
      const { error } = await client.from(BL).delete().eq('id', lineId);
      if (error) throw new Error(error.message);
    },
  };
}

function toStakeholder(r: StakeholderRow): Stakeholder {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    operationId: r.operation_id,
    type: r.type as StakeholderType,
    name: r.name,
    email: r.email,
    phone: r.phone,
    mission: r.mission,
    feeAmount: Number(r.fee_amount),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createSupabaseStakeholdersRepo(client: SupabaseClient, session: Session): StakeholdersRepo {
  return {
    async list(opId) {
      const rows = unwrap(await client.from(ST).select('*').eq('operation_id', opId).order('created_at')) as StakeholderRow[];
      return rows.map(toStakeholder);
    },

    async add(opId, input: StakeholderInput) {
      const row = unwrap(
        await client
          .from(ST)
          .insert({
            tenant_id: session.tenantId,
            operation_id: opId,
            type: input.type,
            name: input.name,
            email: input.email ?? null,
            phone: input.phone ?? null,
            mission: input.mission ?? null,
            fee_amount: input.feeAmount ?? 0,
          })
          .select('*')
          .single(),
      ) as StakeholderRow;
      return toStakeholder(row);
    },

    async update(sid, patch: StakeholderPatch) {
      const upd: Record<string, unknown> = {};
      if (patch.type !== undefined) upd.type = patch.type;
      if (patch.name !== undefined) upd.name = patch.name;
      if (patch.email !== undefined) upd.email = patch.email;
      if (patch.phone !== undefined) upd.phone = patch.phone;
      if (patch.mission !== undefined) upd.mission = patch.mission;
      if (patch.feeAmount !== undefined) upd.fee_amount = patch.feeAmount;
      const row = unwrap(await client.from(ST).update(upd).eq('id', sid).select('*').single()) as StakeholderRow;
      return toStakeholder(row);
    },

    async remove(sid) {
      const { error } = await client.from(ST).delete().eq('id', sid);
      if (error) throw new Error(error.message);
    },
  };
}

function toContract(r: ContractRow): Contract {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id, reference: r.reference,
    contractor: r.contractor, amount: Number(r.amount), status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function toDecompte(r: DecompteRow): Decompte {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id, contractId: r.contract_id, number: r.number,
    amountGross: Number(r.amount_gross), retentionRate: Number(r.retention_rate), amountNet: Number(r.amount_net),
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function createSupabasePaymentsRepo(client: SupabaseClient, session: Session): PaymentsRepo {
  return {
    async contracts(opId) {
      const rows = unwrap(await client.from(CT).select('*').eq('operation_id', opId).order('created_at')) as ContractRow[];
      return rows.map(toContract);
    },
    async addContract(opId, input: ContractInput) {
      const row = unwrap(
        await client.from(CT).insert({
          tenant_id: session.tenantId, operation_id: opId, reference: input.reference, contractor: input.contractor,
          amount: input.amount ?? 0,
        }).select('*').single(),
      ) as ContractRow;
      return toContract(row);
    },
    async removeContract(cid) {
      const { error } = await client.from(CT).delete().eq('id', cid);
      if (error) throw new Error(error.message);
    },

    async decomptes(opId) {
      const rows = unwrap(await client.from(DC).select('*').eq('operation_id', opId).order('number')) as DecompteRow[];
      return rows.map(toDecompte);
    },
    async addDecompte(opId, input: DecompteInput) {
      const { data: op } = await client.from(OPS).select('currency').eq('id', opId).maybeSingle();
      const currency = (op as { currency: string } | null)?.currency ?? 'XOF';
      const rate = input.retentionRate ?? 0.05;
      const { net } = decompteNet(Money.of(input.amountGross, currency), rate);
      const row = unwrap(
        await client.from(DC).insert({
          tenant_id: session.tenantId, operation_id: opId, contract_id: input.contractId, number: input.number,
          amount_gross: input.amountGross, retention_rate: rate, amount_net: net.toMajorNumber(), status: 'draft',
        }).select('*').single(),
      ) as DecompteRow;
      return toDecompte(row);
    },
    async setDecompteStatus(did, status: DecompteStatus) {
      const row = unwrap(await client.from(DC).update({ status }).eq('id', did).select('*').single()) as DecompteRow;
      return toDecompte(row);
    },
    async removeDecompte(did) {
      const { error } = await client.from(DC).delete().eq('id', did);
      if (error) throw new Error(error.message);
    },
  };
}

function toTask(r: TaskRow): Task {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id, name: r.name,
    startDate: r.start_date, endDate: r.end_date, isMilestone: r.is_milestone, isCritical: r.is_critical,
    progress: Number(r.progress), createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function createSupabasePlanningRepo(client: SupabaseClient, session: Session): PlanningRepo {
  return {
    async list(opId) {
      const rows = unwrap(await client.from(TK).select('*').eq('operation_id', opId).order('start_date', { nullsFirst: false })) as TaskRow[];
      return rows.map(toTask);
    },
    async add(opId, input: TaskInput) {
      const row = unwrap(
        await client.from(TK).insert({
          tenant_id: session.tenantId, operation_id: opId, name: input.name,
          start_date: input.startDate ?? null, end_date: input.endDate ?? null,
          is_milestone: input.isMilestone ?? false, is_critical: input.isCritical ?? false, progress: input.progress ?? 0,
        }).select('*').single(),
      ) as TaskRow;
      return toTask(row);
    },
    async update(tid, patch: TaskPatch) {
      const upd: Record<string, unknown> = {};
      if (patch.name !== undefined) upd.name = patch.name;
      if (patch.startDate !== undefined) upd.start_date = patch.startDate;
      if (patch.endDate !== undefined) upd.end_date = patch.endDate;
      if (patch.isMilestone !== undefined) upd.is_milestone = patch.isMilestone;
      if (patch.isCritical !== undefined) upd.is_critical = patch.isCritical;
      if (patch.progress !== undefined) upd.progress = patch.progress;
      const row = unwrap(await client.from(TK).update(upd).eq('id', tid).select('*').single()) as TaskRow;
      return toTask(row);
    },
    async remove(tid) {
      const { error } = await client.from(TK).delete().eq('id', tid);
      if (error) throw new Error(error.message);
    },
  };
}

function toTender(r: TenderRow): Tender {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id, mode: r.mode, procedure: r.procedure,
    object: r.object, thresholdOk: r.threshold_ok, anoRequired: r.ano_required, status: r.status,
    awardedTo: r.awarded_to, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function createSupabaseTendersRepo(client: SupabaseClient, session: Session): TendersRepo {
  return {
    async list(opId) {
      const rows = unwrap(await client.from(TD).select('*').eq('operation_id', opId).order('created_at')) as TenderRow[];
      return rows.map(toTender);
    },
    async add(opId, input: TenderInput) {
      const row = unwrap(
        await client.from(TD).insert({
          tenant_id: session.tenantId, operation_id: opId, mode: input.mode, procedure: input.procedure ?? null,
          object: input.object, ano_required: input.anoRequired ?? false,
        }).select('*').single(),
      ) as TenderRow;
      return toTender(row);
    },
    async setStatus(tid, status: TenderStatus) {
      const row = unwrap(await client.from(TD).update({ status }).eq('id', tid).select('*').single()) as TenderRow;
      return toTender(row);
    },
    async setAwardedTo(tid, stakeholderId) {
      const row = unwrap(await client.from(TD).update({ awarded_to: stakeholderId }).eq('id', tid).select('*').single()) as TenderRow;
      return toTender(row);
    },
    async remove(tid) {
      const { error } = await client.from(TD).delete().eq('id', tid);
      if (error) throw new Error(error.message);
    },
  };
}

// ── Conformité & gardes M1 (M2 autorisations/DD, M7 assurances) ──────────────
interface AuthorizationRow {
  id: string; tenant_id: string; operation_id: string;
  type: string; authority: string; status: string; validity: string | null;
}
interface InsuranceRow {
  id: string; tenant_id: string; operation_id: string; stakeholder_id: string | null;
  type: string; insurer: string; valid_from: string; valid_to: string | null; attestation_ref: string | null;
}
interface DueDiligenceRow {
  id: string; tenant_id: string; operation_id: string;
  category: string; finding: string; severity: string; status: string;
}

function toAuthorization(r: AuthorizationRow): Authorization {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id,
    type: r.type as AuthorizationType, authority: r.authority,
    status: r.status as AuthorizationStatus, validity: r.validity,
  };
}
function toInsurance(r: InsuranceRow): Insurance {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id, stakeholderId: r.stakeholder_id,
    type: r.type as InsuranceType, insurer: r.insurer, validFrom: r.valid_from,
    validTo: r.valid_to, attestationRef: r.attestation_ref,
  };
}
function toDueDiligence(r: DueDiligenceRow): DueDiligenceItem {
  return {
    id: r.id, tenantId: r.tenant_id, operationId: r.operation_id,
    category: r.category as DueDiligenceCategory, finding: r.finding,
    severity: r.severity as DueDiligenceSeverity, status: r.status as DueDiligenceStatus,
  };
}

export function createSupabaseComplianceRepo(client: SupabaseClient, session: Session): ComplianceRepo {
  const AUTHT = 'ao_authorizations';
  const INST = 'ao_insurances';
  const DDT = 'ao_due_diligence_items';
  return {
    async authorizations(opId) {
      const rows = unwrap(await client.from(AUTHT).select('*').eq('operation_id', opId).order('created_at')) as AuthorizationRow[];
      return rows.map(toAuthorization);
    },
    async addAuthorization(opId, input: AuthorizationInput) {
      const row = unwrap(
        await client.from(AUTHT).insert({
          tenant_id: session.tenantId, operation_id: opId,
          type: input.type, authority: input.authority, status: 'draft', validity: input.validity ?? null,
        }).select('*').single(),
      ) as AuthorizationRow;
      return toAuthorization(row);
    },
    async setAuthorizationStatus(id, status: AuthorizationStatus) {
      const row = unwrap(await client.from(AUTHT).update({ status }).eq('id', id).select('*').single()) as AuthorizationRow;
      return toAuthorization(row);
    },
    async removeAuthorization(id) {
      const { error } = await client.from(AUTHT).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async insurances(opId) {
      const rows = unwrap(await client.from(INST).select('*').eq('operation_id', opId).order('created_at')) as InsuranceRow[];
      return rows.map(toInsurance);
    },
    async addInsurance(opId, input: InsuranceInput) {
      const row = unwrap(
        await client.from(INST).insert({
          tenant_id: session.tenantId, operation_id: opId, stakeholder_id: input.stakeholderId ?? null,
          type: input.type, insurer: input.insurer, valid_from: input.validFrom,
          valid_to: input.validTo ?? null, attestation_ref: input.attestationRef ?? null,
        }).select('*').single(),
      ) as InsuranceRow;
      return toInsurance(row);
    },
    async removeInsurance(id) {
      const { error } = await client.from(INST).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async dueDiligence(opId) {
      const rows = unwrap(await client.from(DDT).select('*').eq('operation_id', opId).order('created_at')) as DueDiligenceRow[];
      return rows.map(toDueDiligence);
    },
    async addDueDiligence(opId, input: DueDiligenceInput) {
      const row = unwrap(
        await client.from(DDT).insert({
          tenant_id: session.tenantId, operation_id: opId,
          category: input.category, finding: input.finding, severity: input.severity, status: 'open',
        }).select('*').single(),
      ) as DueDiligenceRow;
      return toDueDiligence(row);
    },
    async setDueDiligenceStatus(id, status: DueDiligenceStatus) {
      const row = unwrap(await client.from(DDT).update({ status }).eq('id', id).select('*').single()) as DueDiligenceRow;
      return toDueDiligence(row);
    },
    async removeDueDiligence(id) {
      const { error } = await client.from(DDT).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
