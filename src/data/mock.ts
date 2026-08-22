/**
 * Adaptateur mock en mémoire (dev/test). Simule l'isolation RLS (filtrage
 * tenant + périmètre), le versionnage du programme (RG-M1-11) et émet la
 * télémétrie. Remplaçable par l'adaptateur Supabase sans changer l'UI.
 */
import { buildNewOperation } from '../domain/m1/rules';
import type {
  CreateOperationInput,
  Operation,
  OperationPatch,
  OperationStatus,
  Phase,
  ProgramItem,
  ProgramItemDraft,
} from '../domain/m1/types';
import type { TransitionContext } from '../domain/m1/stateMachine';
import { getCountry } from '../domain/country';
import type { Stakeholder, StakeholderInput, StakeholderPatch, StakeholderType } from '../domain/m2/types';
import { permitGate, type Authorization } from '../domain/m2/authorizations';
import { doGate } from '../domain/m7/rules';
import type { InsuranceType } from '../domain/m7/types';
import type { Contract, ContractInput, Decompte, DecompteInput, DecompteStatus } from '../domain/payments/types';
import type { Task, TaskInput } from '../domain/m12/types';
import type { Tender, TenderInput, TenderStatus } from '../domain/m8/types';
import { decompteNet } from '../domain/payments/decompte';
import { Money } from '../domain/money/Money';
import { bilanSummary, type BilanLine } from '../domain/finance/bilan';
import { tri } from '../domain/finance/tri';
import type { Telemetry } from '../lib/telemetry';
import type {
  BilanLineInput,
  BilanLinePatch,
  BilanLineRecord,
  BilanRepo,
  BilanView,
  OperationFilter,
  OperationsRepo,
  ProgramRepo,
  ProgramItemPatch,
  Session,
  StakeholdersRepo,
  PaymentsRepo,
  PlanningRepo,
  TendersRepo,
} from './repo';

interface BilanSeed {
  id: string;
  operationId: string;
  tenantId: string;
  kind: 'cost' | 'revenue';
  poste: string;
  amountPlanned: number;
  amountActual: number;
}

export interface MockDb {
  operations: Operation[];
  program: ProgramItem[];
  ctx: Record<string, TransitionContext>;
  bilan: BilanSeed[];
  cashflows: Record<string, number[]>;
  stakeholders: Stakeholder[];
  contracts: Contract[];
  decomptes: Decompte[];
  tasks: Task[];
  tenders: Tender[];
  authorizations: Authorization[];
  insurances: MockInsurance[];
}

/** Assurance simplifiée pour la garde DO (M7) : le statut est dérivé de valid_to. */
export interface MockInsurance {
  id: string;
  tenantId: string;
  operationId: string;
  type: InsuranceType;
  validTo: string | null;
}

interface Deps {
  telemetry: Telemetry;
  id?: () => string;
  now?: () => string;
}

const defaultCtx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  validatedProgramItems: 0,
  bilanInitialized: false,
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

function seedOp(o: Partial<Operation> & Pick<Operation, 'id' | 'tenantId' | 'countryCode' | 'name' | 'opType' | 'phase'>): Operation {
  const country = getCountry(o.countryCode);
  return {
    procurementMode: 'private',
    currency: country?.currency ?? 'XOF',
    budgetBac: 0,
    retentionRate: country?.retentionDefault ?? 0.05,
    startDate: null,
    endDate: null,
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-05-20T08:00:00.000Z',
    progress: 0,
    lastActivityAt: '2026-05-20T08:00:00.000Z',
    ...o,
  };
}

function seedItem(
  i: Pick<ProgramItem, 'id' | 'tenantId' | 'operationId' | 'category' | 'label' | 'version' | 'status'> &
    Partial<ProgramItem>,
): ProgramItem {
  return {
    targetValue: null,
    unit: null,
    covered: true,
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-01-12T08:00:00.000Z',
    ...i,
  };
}

export function createMockDb(): MockDb {
  const T = 'tenant-demo';
  const OTHER = 'tenant-other';
  const operations: Operation[] = [
    seedOp({
      id: 'op-palmiers', tenantId: T, countryCode: 'CI', name: 'Résidence Les Palmiers',
      opType: 'residential', phase: 'realisation', budgetBac: 2_450_000_000, progress: 0.62,
      startDate: '2026-02-01', endDate: '2027-09-30', lastActivityAt: '2026-06-08T10:00:00.000Z',
    }),
    seedOp({
      id: 'op-cosmos', tenantId: T, countryCode: 'CI', name: 'Centre Commercial Cosmos X',
      opType: 'commercial', phase: 'conception', budgetBac: 5_100_000_000, progress: 0.15,
      startDate: '2026-04-01', lastActivityAt: '2026-06-02T14:00:00.000Z',
    }),
    seedOp({
      id: 'op-riviera', tenantId: T, countryCode: 'SN', name: 'Programme Social Riviera',
      opType: 'public', procurementMode: 'public', phase: 'amont', budgetBac: 0, progress: 0,
      lastActivityAt: '2026-05-28T09:00:00.000Z',
    }),
    seedOp({
      id: 'op-atlantique', tenantId: OTHER, countryCode: 'CM', name: 'Tour Atlantique',
      opType: 'mixed', phase: 'passation', budgetBac: 8_900_000_000, progress: 0.3,
    }),
  ];

  const program: ProgramItem[] = [
    // Palmiers — v1 validée + v2 de travail (draft)
    seedItem({ id: 'pi-1', tenantId: T, operationId: 'op-palmiers', category: 'surface', label: 'Surface habitable', targetValue: '8 400', unit: 'm²', version: 1, status: 'validated' }),
    seedItem({ id: 'pi-2', tenantId: T, operationId: 'op-palmiers', category: 'usage', label: 'Logements', targetValue: '96', unit: 'lots', version: 1, status: 'validated' }),
    seedItem({ id: 'pi-3', tenantId: T, operationId: 'op-palmiers', category: 'exigence_env', label: 'Performance énergétique', targetValue: 'RT2020', version: 1, status: 'validated', covered: false }),
    seedItem({ id: 'pi-1b', tenantId: T, operationId: 'op-palmiers', category: 'surface', label: 'Surface habitable', targetValue: '8 600', unit: 'm²', version: 2, status: 'draft' }),
    seedItem({ id: 'pi-2b', tenantId: T, operationId: 'op-palmiers', category: 'usage', label: 'Logements', targetValue: '98', unit: 'lots', version: 2, status: 'draft' }),
    seedItem({ id: 'pi-3b', tenantId: T, operationId: 'op-palmiers', category: 'exigence_env', label: 'Performance énergétique', targetValue: 'RT2020', version: 2, status: 'draft', covered: false }),
    // Cosmos — v1 validée
    seedItem({ id: 'pi-c1', tenantId: T, operationId: 'op-cosmos', category: 'surface', label: 'Surface GLA', targetValue: '12 000', unit: 'm²', version: 1, status: 'validated' }),
    seedItem({ id: 'pi-c2', tenantId: T, operationId: 'op-cosmos', category: 'usage', label: 'Cellules commerciales', targetValue: '45', unit: 'cellules', version: 1, status: 'validated', covered: false }),
  ];

  const ctx: Record<string, TransitionContext> = {
    // permitGranted / doInsuranceValid sont dérivés des collections authorizations/insurances.
    'op-palmiers': defaultCtx({ marketsToLaunch: 4, marketsNotified: 4, globalProgress: 0.62 }),
    'op-cosmos': defaultCtx({ marketsToLaunch: 0 }),
    'op-riviera': defaultCtx({}),
    'op-atlantique': defaultCtx({ marketsToLaunch: 2, marketsNotified: 1 }),
  };

  // Bilan (M4) — Palmiers & Cosmos initialisés ; Riviera non (garde bloquante).
  const bl = (
    id: string, operationId: string, kind: 'cost' | 'revenue', poste: string, planned: number, actual: number,
  ): BilanSeed => ({ id, operationId, tenantId: T, kind, poste, amountPlanned: planned, amountActual: actual });
  const bilan: BilanSeed[] = [
    bl('bl-p1', 'op-palmiers', 'cost', 'foncier', 520_000_000, 520_000_000),
    bl('bl-p2', 'op-palmiers', 'cost', 'travaux', 1_450_000_000, 900_000_000),
    bl('bl-p3', 'op-palmiers', 'cost', 'honoraires', 210_000_000, 130_000_000),
    bl('bl-p4', 'op-palmiers', 'cost', 'etudes', 180_000_000, 180_000_000),
    bl('bl-p5', 'op-palmiers', 'cost', 'frais_financiers', 90_000_000, 40_000_000),
    bl('bl-p6', 'op-palmiers', 'revenue', 'ventes', 3_120_000_000, 1_950_000_000),
    bl('bl-c1', 'op-cosmos', 'cost', 'travaux', 3_900_000_000, 600_000_000),
    bl('bl-c2', 'op-cosmos', 'cost', 'foncier', 1_200_000_000, 1_200_000_000),
    bl('bl-c3', 'op-cosmos', 'revenue', 'loyers', 6_400_000_000, 0),
  ];

  const cashflows: Record<string, number[]> = {
    'op-palmiers': [-1_200_000_000, -1_300_000_000, 1_600_000_000, 1_600_000_000, 720_000_000],
    'op-cosmos': [-2_600_000_000, -2_700_000_000, 2_800_000_000, 2_900_000_000, 3_000_000_000],
  };

  const sh = (
    id: string, operationId: string, type: StakeholderType, name: string,
    email: string | null, phone: string | null, mission: string | null, fee: number,
  ): Stakeholder => ({
    id, tenantId: T, operationId, type, name, email, phone, mission, feeAmount: fee,
    createdAt: '2026-02-01T08:00:00.000Z', updatedAt: '2026-02-01T08:00:00.000Z',
  });
  const stakeholders: Stakeholder[] = [
    sh('st-p1', 'op-palmiers', 'moe', 'Atelier Koffi Architecture', 'contact@koffi-archi.ci', '+225 27 22 49 10 10', 'Maîtrise d’œuvre conception + exécution', 180_000_000),
    sh('st-p2', 'op-palmiers', 'bet', 'BET Structures Abidjan', 'info@bet-structures.ci', null, 'Études structure & fluides', 60_000_000),
    sh('st-p3', 'op-palmiers', 'entreprise', 'BTP Ivoire SA', 'devis@btp-ivoire.ci', '+225 07 07 07 07 07', 'Gros œuvre — lot 1', 1_450_000_000),
    sh('st-p4', 'op-palmiers', 'assureur', 'NSIA Assurances', null, null, 'Dommage-ouvrage + décennale', 0),
    sh('st-c1', 'op-cosmos', 'moe', 'Studio Cosmos', 'hello@studio-cosmos.ci', null, 'Maîtrise d’œuvre', 220_000_000),
    sh('st-c2', 'op-cosmos', 'banque', 'Ecobank CI', null, null, 'Crédit promoteur', 0),
  ];

  const contracts: Contract[] = [
    { id: 'ct-p1', tenantId: T, operationId: 'op-palmiers', reference: 'M-2026-001', contractor: 'BTP Ivoire SA', amount: 1_450_000_000, status: 'active', createdAt: '2026-03-01T08:00:00.000Z', updatedAt: '2026-03-01T08:00:00.000Z' },
  ];
  const decomptes: Decompte[] = [
    { id: 'dc-p1', tenantId: T, operationId: 'op-palmiers', contractId: 'ct-p1', number: 1, amountGross: 600_000_000, retentionRate: 0.05, amountNet: 570_000_000, status: 'paid', createdAt: '2026-04-01T08:00:00.000Z', updatedAt: '2026-04-15T08:00:00.000Z' },
    { id: 'dc-p2', tenantId: T, operationId: 'op-palmiers', contractId: 'ct-p1', number: 2, amountGross: 300_000_000, retentionRate: 0.05, amountNet: 285_000_000, status: 'validated', createdAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-05-01T08:00:00.000Z' },
  ];

  const tk = (
    id: string, operationId: string, name: string, start: string | null, end: string | null,
    milestone: boolean, critical: boolean, progress: number,
  ): Task => ({
    id, tenantId: T, operationId, name, startDate: start, endDate: end,
    isMilestone: milestone, isCritical: critical, progress,
    createdAt: '2026-02-01T08:00:00.000Z', updatedAt: '2026-02-01T08:00:00.000Z',
  });
  const tasks: Task[] = [
    tk('tk-p1', 'op-palmiers', 'Études & conception', '2026-02-01', '2026-04-30', false, true, 1),
    tk('tk-p2', 'op-palmiers', 'Obtention permis de construire', '2026-05-01', '2026-05-01', true, true, 1),
    tk('tk-p3', 'op-palmiers', 'Gros œuvre', '2026-05-15', '2026-11-30', false, true, 0.55),
    tk('tk-p4', 'op-palmiers', 'Second œuvre', '2026-10-01', '2027-05-31', false, false, 0.1),
    tk('tk-p5', 'op-palmiers', 'Livraison', '2027-09-30', '2027-09-30', true, true, 0),
    tk('tk-c1', 'op-cosmos', 'Conception', '2026-04-01', '2026-08-31', false, true, 0.3),
    tk('tk-c2', 'op-cosmos', 'Appel d’offres travaux', '2026-09-01', '2026-10-15', true, false, 0),
  ];

  const tenders: Tender[] = [
    { id: 'td-p1', tenantId: T, operationId: 'op-palmiers', mode: 'private', procedure: 'AOO', object: 'Marché gros œuvre — lot 1', thresholdOk: true, anoRequired: false, status: 'notified', awardedTo: 'st-p3', createdAt: '2026-03-01T08:00:00.000Z', updatedAt: '2026-03-20T08:00:00.000Z' },
    { id: 'td-p2', tenantId: T, operationId: 'op-palmiers', mode: 'private', procedure: 'consultation', object: 'Second œuvre — lots séparés', thresholdOk: true, anoRequired: false, status: 'published', awardedTo: null, createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-01T08:00:00.000Z' },
    { id: 'td-c1', tenantId: T, operationId: 'op-cosmos', mode: 'private', procedure: 'AOR', object: 'Conception-réalisation centre commercial', thresholdOk: true, anoRequired: false, status: 'planned', awardedTo: null, createdAt: '2026-05-10T08:00:00.000Z', updatedAt: '2026-05-10T08:00:00.000Z' },
  ];

  // Autorisations (M2) — Palmiers : permis accordé (garde levée) ; Cosmos : déposé (bloquant).
  const authorizations: Authorization[] = [
    { id: 'au-p1', tenantId: T, operationId: 'op-palmiers', type: 'permis_construire', authority: 'Mairie du Plateau', status: 'granted', validity: '2030-12-31' },
    { id: 'au-c1', tenantId: T, operationId: 'op-cosmos', type: 'permis_construire', authority: 'Mairie de Cocody', status: 'submitted', validity: null },
  ];
  // Assurances (M7) — Palmiers : DO couvrante (garde levée). Cosmos : aucune DO.
  const insurances: MockInsurance[] = [
    { id: 'in-p1', tenantId: T, operationId: 'op-palmiers', type: 'DO', validTo: '2030-12-31' },
    { id: 'in-p2', tenantId: T, operationId: 'op-palmiers', type: 'decennale', validTo: '2030-12-31' },
  ];

  return { operations, program, ctx, bilan, cashflows, stakeholders, contracts, decomptes, tasks, tenders, authorizations, insurances };
}

// ── Helpers d'isolation (équivalent RLS en mémoire) ──────────────────────────
function visibleToSession(op: Operation, s: Session): boolean {
  if (op.tenantId !== s.tenantId) return false;
  if (s.operationScope && !s.operationScope.includes(op.id)) return false;
  return true;
}

export function createOperationsRepo(db: MockDb, session: Session, deps: Deps): OperationsRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());

  const findVisible = (opId: string) =>
    db.operations.find((o) => o.id === opId && visibleToSession(o, session)) ?? null;

  const validatedCount = (opId: string): number => {
    const versions = db.program
      .filter((p) => p.operationId === opId && p.status === 'validated')
      .map((p) => p.version);
    if (versions.length === 0) return 0;
    const latest = Math.max(...versions);
    return db.program.filter((p) => p.operationId === opId && p.version === latest && p.status === 'validated').length;
  };

  return {
    async list(filter: OperationFilter = {}) {
      return db.operations
        .filter((o) => visibleToSession(o, session))
        .filter((o) => (filter.phase ? o.phase === filter.phase : true))
        .filter((o) => (filter.opType ? o.opType === filter.opType : true))
        .filter((o) => (filter.countryCode ? o.countryCode === filter.countryCode : true))
        .filter((o) => (filter.status ? o.status === filter.status : true))
        .filter((o) => (filter.search ? o.name.toLowerCase().includes(filter.search.toLowerCase()) : true))
        .map((o) => ({ ...o }));
    },

    async get(opId) {
      const o = findVisible(opId);
      return o ? { ...o } : null;
    },

    async existingNames(excludeId) {
      return db.operations
        .filter((o) => o.tenantId === session.tenantId && o.id !== excludeId)
        .map((o) => o.name);
    },

    async create(input: CreateOperationInput) {
      const country = getCountry(input.countryCode);
      if (!country) throw new Error('country_not_found');
      const op = buildNewOperation(input, country, { id: id(), tenantId: session.tenantId, now: now() });
      op.progress = 0;
      op.lastActivityAt = op.createdAt;
      db.operations.push(op);
      db.ctx[op.id] = defaultCtx({});
      for (const draft of input.program ?? []) {
        db.program.push(
          seedItem({
            id: id(), tenantId: session.tenantId, operationId: op.id, category: draft.category,
            label: draft.label, targetValue: draft.targetValue ?? null, unit: draft.unit ?? null,
            version: 1, status: 'draft', covered: false, createdAt: op.createdAt, updatedAt: op.createdAt,
          }),
        );
      }
      deps.telemetry.emit({ name: 'operation.created', operationId: op.id, opType: op.opType, countryCode: op.countryCode });
      return { ...op };
    },

    async update(opId, patch: OperationPatch) {
      const op = findVisible(opId);
      if (!op) throw new Error('not_found');
      const changed = Object.keys(patch);
      Object.assign(op, patch, { updatedAt: now(), lastActivityAt: now() });
      deps.telemetry.emit({ name: 'operation.updated', operationId: op.id, changedFields: changed });
      return { ...op };
    },

    async setStatus(opId, status: OperationStatus) {
      const op = findVisible(opId);
      if (!op) throw new Error('not_found');
      op.status = status;
      op.updatedAt = now();
      op.lastActivityAt = now();
      deps.telemetry.emit({ name: 'operation.updated', operationId: op.id, changedFields: ['status'] });
      return { ...op };
    },

    async getTransitionContext(opId) {
      const base = db.ctx[opId] ?? defaultCtx({});
      const hasBilan = db.bilan.some((b) => b.operationId === opId && b.tenantId === session.tenantId);
      // Gardes M2 (permis) et M7 (DO) dérivées des collections, comme en base (adapter Supabase).
      const today = (deps.now?.() ?? new Date().toISOString()).slice(0, 10);
      const auths = db.authorizations.filter((a) => a.operationId === opId && a.tenantId === session.tenantId);
      const inss = db.insurances.filter((i) => i.operationId === opId && i.tenantId === session.tenantId);
      return {
        ...base,
        validatedProgramItems: validatedCount(opId),
        bilanInitialized: hasBilan,
        permitGranted: permitGate(auths, today).ok,
        doInsuranceValid: doGate(inss, today).ok,
      };
    },

    async setPhase(opId, to: Phase) {
      const op = findVisible(opId);
      if (!op) throw new Error('not_found');
      const from = op.phase;
      op.phase = to;
      op.updatedAt = now();
      op.lastActivityAt = now();
      deps.telemetry.emit({ name: 'operation.phase_changed', operationId: op.id, from, to, actor: session.userId });
      return { ...op };
    },
  };
}

export function createProgramRepo(db: MockDb, session: Session, deps: Deps): ProgramRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());

  const itemsOf = (opId: string) =>
    db.program.filter((p) => p.operationId === opId && p.tenantId === session.tenantId);

  const currentVersion = (opId: string): number => {
    const versions = itemsOf(opId).map((p) => p.version);
    return versions.length ? Math.max(...versions) : 1;
  };

  const find = (itemId: string) =>
    db.program.find((p) => p.id === itemId && p.tenantId === session.tenantId) ?? null;

  return {
    async list(opId, version) {
      const v = version ?? currentVersion(opId);
      return itemsOf(opId).filter((p) => p.version === v).map((p) => ({ ...p }));
    },

    async versions(opId) {
      const set = new Set(itemsOf(opId).filter((p) => p.status === 'validated').map((p) => p.version));
      return [...set].sort((a, b) => a - b);
    },

    async currentVersion(opId) {
      return currentVersion(opId);
    },

    async add(opId, draft: ProgramItemDraft) {
      const item = seedItem({
        id: id(), tenantId: session.tenantId, operationId: opId, category: draft.category,
        label: draft.label, targetValue: draft.targetValue ?? null, unit: draft.unit ?? null,
        version: currentVersion(opId), status: 'draft', covered: false, createdAt: now(), updatedAt: now(),
      });
      db.program.push(item);
      return { ...item };
    },

    async update(itemId, patch: ProgramItemPatch) {
      const item = find(itemId);
      if (!item) throw new Error('not_found');
      Object.assign(item, patch, { updatedAt: now() });
      return { ...item };
    },

    async remove(itemId) {
      const idx = db.program.findIndex((p) => p.id === itemId && p.tenantId === session.tenantId);
      if (idx >= 0) db.program.splice(idx, 1);
    },

    async validateVersion(opId) {
      const v = currentVersion(opId);
      const items = itemsOf(opId).filter((p) => p.version === v);
      for (const it of items) {
        it.status = 'validated'; // RG-M1-11 : fige la version courante
        it.updatedAt = now();
      }
      // Ouvre la version suivante (copie de travail) pour l'édition continue.
      for (const it of items) {
        db.program.push(
          seedItem({
            id: id(), tenantId: session.tenantId, operationId: opId, category: it.category, label: it.label,
            targetValue: it.targetValue, unit: it.unit, version: v + 1, status: 'draft', covered: it.covered,
            createdAt: now(), updatedAt: now(),
          }),
        );
      }
      deps.telemetry.emit({ name: 'program.version_created', operationId: opId, version: v });
      return v;
    },
  };
}

export function createBilanRepo(db: MockDb, session: Session, deps: Deps): BilanRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const seeds = (opId: string) => db.bilan.filter((b) => b.operationId === opId && b.tenantId === session.tenantId);
  const toRecord = (b: BilanSeed): BilanLineRecord => ({
    id: b.id, operationId: b.operationId, kind: b.kind, poste: b.poste,
    amountPlanned: b.amountPlanned, amountActual: b.amountActual,
  });

  return {
    async summary(opId): Promise<BilanView | null> {
      const op = db.operations.find((o) => o.id === opId && o.tenantId === session.tenantId);
      if (!op) return null;
      const lines: BilanLine[] = seeds(opId).map((b) => ({ kind: b.kind, amount: Money.of(b.amountPlanned, op.currency) }));
      return {
        summary: bilanSummary(lines, op.currency),
        tri: tri(db.cashflows[opId] ?? []),
        bac: Money.of(op.budgetBac, op.currency),
      };
    },

    async lines(opId) {
      return seeds(opId).map(toRecord);
    },

    async addLine(opId, input: BilanLineInput) {
      const seed: BilanSeed = {
        id: id(), operationId: opId, tenantId: session.tenantId, kind: input.kind, poste: input.poste,
        amountPlanned: input.amountPlanned, amountActual: input.amountActual ?? 0,
      };
      db.bilan.push(seed);
      return toRecord(seed);
    },

    async updateLine(lineId, patch: BilanLinePatch) {
      const seed = db.bilan.find((b) => b.id === lineId && b.tenantId === session.tenantId);
      if (!seed) throw new Error('not_found');
      if (patch.poste !== undefined) seed.poste = patch.poste;
      if (patch.amountPlanned !== undefined) seed.amountPlanned = patch.amountPlanned;
      if (patch.amountActual !== undefined) seed.amountActual = patch.amountActual;
      return toRecord(seed);
    },

    async removeLine(lineId) {
      const idx = db.bilan.findIndex((b) => b.id === lineId && b.tenantId === session.tenantId);
      if (idx >= 0) db.bilan.splice(idx, 1);
    },
  };
}

export function createStakeholdersRepo(db: MockDb, session: Session, deps: Deps): StakeholdersRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const owned = (sid: string) => db.stakeholders.find((s) => s.id === sid && s.tenantId === session.tenantId) ?? null;

  return {
    async list(opId) {
      return db.stakeholders
        .filter((s) => s.operationId === opId && s.tenantId === session.tenantId)
        .map((s) => ({ ...s }));
    },

    async add(opId, input: StakeholderInput) {
      const s: Stakeholder = {
        id: id(), tenantId: session.tenantId, operationId: opId, type: input.type, name: input.name.trim(),
        email: input.email ?? null, phone: input.phone ?? null, mission: input.mission ?? null,
        feeAmount: input.feeAmount ?? 0, createdAt: now(), updatedAt: now(),
      };
      db.stakeholders.push(s);
      return { ...s };
    },

    async update(sid, patch: StakeholderPatch) {
      const s = owned(sid);
      if (!s) throw new Error('not_found');
      Object.assign(s, patch, { updatedAt: now() });
      return { ...s };
    },

    async remove(sid) {
      const idx = db.stakeholders.findIndex((s) => s.id === sid && s.tenantId === session.tenantId);
      if (idx >= 0) db.stakeholders.splice(idx, 1);
    },
  };
}

export function createPaymentsRepo(db: MockDb, session: Session, deps: Deps): PaymentsRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const currencyOf = (opId: string) =>
    db.operations.find((o) => o.id === opId && o.tenantId === session.tenantId)?.currency ?? 'XOF';

  return {
    async contracts(opId) {
      return db.contracts.filter((c) => c.operationId === opId && c.tenantId === session.tenantId).map((c) => ({ ...c }));
    },
    async addContract(opId, input: ContractInput) {
      const c: Contract = {
        id: id(), tenantId: session.tenantId, operationId: opId, reference: input.reference.trim(),
        contractor: input.contractor.trim(), amount: input.amount ?? 0, status: 'active',
        createdAt: now(), updatedAt: now(),
      };
      db.contracts.push(c);
      return { ...c };
    },
    async removeContract(cid) {
      db.contracts = db.contracts.filter((c) => !(c.id === cid && c.tenantId === session.tenantId));
      db.decomptes = db.decomptes.filter((d) => !(d.contractId === cid && d.tenantId === session.tenantId));
    },

    async decomptes(opId) {
      return db.decomptes.filter((d) => d.operationId === opId && d.tenantId === session.tenantId).map((d) => ({ ...d }));
    },
    async addDecompte(opId, input: DecompteInput) {
      const rate = input.retentionRate ?? 0.05;
      const { net } = decompteNet(Money.of(input.amountGross, currencyOf(opId)), rate);
      const d: Decompte = {
        id: id(), tenantId: session.tenantId, operationId: opId, contractId: input.contractId, number: input.number,
        amountGross: input.amountGross, retentionRate: rate, amountNet: net.toMajorNumber(), status: 'draft',
        createdAt: now(), updatedAt: now(),
      };
      db.decomptes.push(d);
      return { ...d };
    },
    async setDecompteStatus(did, status: DecompteStatus) {
      const d = db.decomptes.find((x) => x.id === did && x.tenantId === session.tenantId);
      if (!d) throw new Error('not_found');
      d.status = status;
      d.updatedAt = now();
      return { ...d };
    },
    async removeDecompte(did) {
      db.decomptes = db.decomptes.filter((d) => !(d.id === did && d.tenantId === session.tenantId));
    },
  };
}

export function createPlanningRepo(db: MockDb, session: Session, deps: Deps): PlanningRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const owned = (tid: string) => db.tasks.find((tk) => tk.id === tid && tk.tenantId === session.tenantId) ?? null;

  return {
    async list(opId) {
      return db.tasks
        .filter((tk) => tk.operationId === opId && tk.tenantId === session.tenantId)
        .map((tk) => ({ ...tk }));
    },
    async add(opId, input: TaskInput) {
      const tk: Task = {
        id: id(), tenantId: session.tenantId, operationId: opId, name: input.name.trim(),
        startDate: input.startDate ?? null, endDate: input.endDate ?? null,
        isMilestone: input.isMilestone ?? false, isCritical: input.isCritical ?? false,
        progress: input.progress ?? 0, createdAt: now(), updatedAt: now(),
      };
      db.tasks.push(tk);
      return { ...tk };
    },
    async update(tid, patch) {
      const tk = owned(tid);
      if (!tk) throw new Error('not_found');
      Object.assign(tk, patch, { updatedAt: now() });
      return { ...tk };
    },
    async remove(tid) {
      db.tasks = db.tasks.filter((tk) => !(tk.id === tid && tk.tenantId === session.tenantId));
    },
  };
}

export function createTendersRepo(db: MockDb, session: Session, deps: Deps): TendersRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const owned = (tid: string) => db.tenders.find((td) => td.id === tid && td.tenantId === session.tenantId) ?? null;

  return {
    async list(opId) {
      return db.tenders.filter((td) => td.operationId === opId && td.tenantId === session.tenantId).map((td) => ({ ...td }));
    },
    async add(opId, input: TenderInput) {
      const td: Tender = {
        id: id(), tenantId: session.tenantId, operationId: opId, mode: input.mode,
        procedure: input.procedure ?? null, object: input.object.trim(), thresholdOk: null,
        anoRequired: input.anoRequired ?? false, status: 'planned', awardedTo: null,
        createdAt: now(), updatedAt: now(),
      };
      db.tenders.push(td);
      return { ...td };
    },
    async setStatus(tid, status: TenderStatus) {
      const td = owned(tid);
      if (!td) throw new Error('not_found');
      td.status = status;
      td.updatedAt = now();
      return { ...td };
    },
    async setAwardedTo(tid, stakeholderId) {
      const td = owned(tid);
      if (!td) throw new Error('not_found');
      td.awardedTo = stakeholderId;
      td.updatedAt = now();
      return { ...td };
    },
    async remove(tid) {
      db.tenders = db.tenders.filter((td) => !(td.id === tid && td.tenantId === session.tenantId));
    },
  };
}
