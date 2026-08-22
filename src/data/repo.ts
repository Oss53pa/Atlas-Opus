/**
 * Frontière d'accès aux données M1. Les écrans dépendent de ces interfaces,
 * pas d'une implémentation : l'adaptateur mock (dev/test) sera remplacé par
 * l'adaptateur Supabase (RLS + Edge Functions) sans toucher l'UI.
 */
import type {
  CreateOperationInput,
  Operation,
  OperationPatch,
  OperationStatus,
  OpType,
  Phase,
  ProgramCategory,
  ProgramItem,
  ProgramItemDraft,
  Role,
} from '../domain/m1/types';
import type { TransitionContext } from '../domain/m1/stateMachine';
import type { BilanSummary } from '../domain/finance/bilan';
import type { Money } from '../domain/money/Money';
import type { Stakeholder, StakeholderInput, StakeholderPatch } from '../domain/m2/types';
import type { Authorization, AuthorizationInput, AuthorizationStatus } from '../domain/m2/authorizations';
import type { DueDiligenceItem, DueDiligenceInput, DueDiligenceStatus } from '../domain/m2/dueDiligence';
import type {
  LandParcel,
  LandParcelInput,
  AcquisitionStatus,
  TitleDocument,
  TitleDocumentInput,
  TitleDocStatus,
} from '../domain/m2/foncier';
import type {
  Insurance,
  InsuranceInput,
  RaciAssignment,
  RaciInput,
  Decision,
  DecisionInput,
} from '../domain/m7/types';
import type { ReportSnapshot, ReportInput } from '../domain/m21/reporting';
import type {
  Unit,
  UnitInput,
  UnitStatus,
  Sale,
  SaleInput,
  SaleStatus,
  Receipt,
  ReceiptInput,
  ReceiptStatus,
} from '../domain/m6/types';
import type {
  Financing,
  FinancingInput,
  FinancingStatus,
  Drawdown,
  DrawdownInput,
  DrawdownStatus,
} from '../domain/m5/types';
import type { Contract, ContractInput, Decompte, DecompteInput, DecompteStatus } from '../domain/payments/types';
import type { Task, TaskInput, TaskPatch } from '../domain/m12/types';
import type { Tender, TenderInput, TenderStatus } from '../domain/m8/types';

export interface Session {
  userId: string;
  tenantId: string;
  role: Role;
  /** null = toutes les opérations du tenant (réf memberships.operation_scope). */
  operationScope: string[] | null;
}

export interface OperationFilter {
  phase?: Phase;
  opType?: OpType;
  countryCode?: string;
  status?: OperationStatus;
  search?: string;
}

export interface OperationsRepo {
  list(filter?: OperationFilter): Promise<Operation[]>;
  get(id: string): Promise<Operation | null>;
  /** Noms existants du tenant (pour l'unicité RG-M1-02), hors id exclu. */
  existingNames(excludeId?: string): Promise<string[]>;
  create(input: CreateOperationInput): Promise<Operation>;
  update(id: string, patch: OperationPatch): Promise<Operation>;
  setStatus(id: string, status: OperationStatus): Promise<Operation>;
  /** Contexte de garde (alimenté par M4/M8/M11 — ici simulé). */
  getTransitionContext(id: string): Promise<TransitionContext>;
  /** Persiste la phase (frontière Edge Function transition-phase). */
  setPhase(id: string, to: Phase): Promise<Operation>;
}

export interface BilanView {
  summary: BilanSummary;
  tri: number | null;
  bac: Money;
  /** Flux nets de trésorerie par période (encaissements − décaissements). */
  cashflow: number[];
}

export interface BilanLineRecord {
  id: string;
  operationId: string;
  kind: 'cost' | 'revenue';
  poste: string;
  amountPlanned: number;
  amountActual: number;
}

export interface BilanLineInput {
  kind: 'cost' | 'revenue';
  poste: string;
  amountPlanned: number;
  amountActual?: number;
}

export type BilanLinePatch = Partial<Pick<BilanLineRecord, 'poste' | 'amountPlanned' | 'amountActual'>>;

export interface BilanRepo {
  /** Synthèse bilan d'une opération (coût/recettes/marge/taux + BAC + TRI). */
  summary(operationId: string): Promise<BilanView | null>;
  /** Lignes de bilan détaillées (M4 CRUD). */
  lines(operationId: string): Promise<BilanLineRecord[]>;
  addLine(operationId: string, input: BilanLineInput): Promise<BilanLineRecord>;
  updateLine(id: string, patch: BilanLinePatch): Promise<BilanLineRecord>;
  removeLine(id: string): Promise<void>;
}

export type ProgramItemPatch = Partial<Pick<ProgramItem, 'label' | 'targetValue' | 'unit' | 'category'>>;

export interface StakeholdersRepo {
  list(operationId: string): Promise<Stakeholder[]>;
  add(operationId: string, input: StakeholderInput): Promise<Stakeholder>;
  update(id: string, patch: StakeholderPatch): Promise<Stakeholder>;
  remove(id: string): Promise<void>;
}

/** Commercialisation (M6) : unités, ventes/baux, encaissements. */
export interface CommercialisationRepo {
  units(operationId: string): Promise<Unit[]>;
  addUnit(operationId: string, input: UnitInput): Promise<Unit>;
  setUnitStatus(id: string, status: UnitStatus): Promise<Unit>;
  removeUnit(id: string): Promise<void>;
  sales(operationId: string): Promise<Sale[]>;
  addSale(operationId: string, input: SaleInput): Promise<Sale>;
  setSaleStatus(id: string, status: SaleStatus): Promise<Sale>;
  removeSale(id: string): Promise<void>;
  receipts(saleId: string): Promise<Receipt[]>;
  addReceipt(saleId: string, input: ReceiptInput): Promise<Receipt>;
  setReceiptStatus(id: string, status: ReceiptStatus): Promise<Receipt>;
  removeReceipt(id: string): Promise<void>;
}

/** Reporting (M21) : snapshots datés & conservés. */
export interface ReportingRepo {
  list(operationId: string): Promise<ReportSnapshot[]>;
  generate(operationId: string, input: ReportInput): Promise<ReportSnapshot>;
  remove(id: string): Promise<void>;
}

/** Financement (M5) : sources & tranches de déblocage. */
export interface FinancingRepo {
  list(operationId: string): Promise<Financing[]>;
  add(operationId: string, input: FinancingInput): Promise<Financing>;
  setStatus(id: string, status: FinancingStatus): Promise<Financing>;
  remove(id: string): Promise<void>;
  drawdowns(financingId: string): Promise<Drawdown[]>;
  addDrawdown(financingId: string, input: DrawdownInput): Promise<Drawdown>;
  setDrawdownStatus(id: string, status: DrawdownStatus, date?: string | null): Promise<Drawdown>;
  removeDrawdown(id: string): Promise<void>;
}

/** Conformité & gardes M1 : autorisations (M2), assurances (M7), due diligence (M2). */
export interface ComplianceRepo {
  authorizations(operationId: string): Promise<Authorization[]>;
  addAuthorization(operationId: string, input: AuthorizationInput): Promise<Authorization>;
  setAuthorizationStatus(id: string, status: AuthorizationStatus): Promise<Authorization>;
  removeAuthorization(id: string): Promise<void>;
  insurances(operationId: string): Promise<Insurance[]>;
  addInsurance(operationId: string, input: InsuranceInput): Promise<Insurance>;
  removeInsurance(id: string): Promise<void>;
  dueDiligence(operationId: string): Promise<DueDiligenceItem[]>;
  addDueDiligence(operationId: string, input: DueDiligenceInput): Promise<DueDiligenceItem>;
  setDueDiligenceStatus(id: string, status: DueDiligenceStatus): Promise<DueDiligenceItem>;
  removeDueDiligence(id: string): Promise<void>;
  // Dossier foncier (M2) : parcelles + titres + machine d'acquisition.
  landParcels(operationId: string): Promise<LandParcel[]>;
  addLandParcel(operationId: string, input: LandParcelInput): Promise<LandParcel>;
  setAcquisitionStatus(id: string, status: AcquisitionStatus): Promise<LandParcel>;
  removeLandParcel(id: string): Promise<void>;
  titles(parcelId: string): Promise<TitleDocument[]>;
  addTitle(parcelId: string, input: TitleDocumentInput): Promise<TitleDocument>;
  setTitleStatus(id: string, status: TitleDocStatus): Promise<TitleDocument>;
  removeTitle(id: string): Promise<void>;
}

/**
 * Gouvernance (M7) : matrice RACI (RG-M7-07) & registre des décisions
 * (append-only, RG-M7-08 — d'où l'absence de méthode d'édition sur les décisions).
 */
export interface GovernanceRepo {
  raci(operationId: string): Promise<RaciAssignment[]>;
  addRaci(operationId: string, input: RaciInput): Promise<RaciAssignment>;
  removeRaci(id: string): Promise<void>;
  decisions(operationId: string): Promise<Decision[]>;
  addDecision(operationId: string, input: DecisionInput): Promise<Decision>;
}

export interface TendersRepo {
  list(operationId: string): Promise<Tender[]>;
  add(operationId: string, input: TenderInput): Promise<Tender>;
  setStatus(id: string, status: TenderStatus): Promise<Tender>;
  setAwardedTo(id: string, stakeholderId: string | null): Promise<Tender>;
  remove(id: string): Promise<void>;
}

export interface PlanningRepo {
  list(operationId: string): Promise<Task[]>;
  add(operationId: string, input: TaskInput): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  remove(id: string): Promise<void>;
}

export interface PaymentsRepo {
  contracts(operationId: string): Promise<Contract[]>;
  addContract(operationId: string, input: ContractInput): Promise<Contract>;
  removeContract(id: string): Promise<void>;
  decomptes(operationId: string): Promise<Decompte[]>;
  addDecompte(operationId: string, input: DecompteInput): Promise<Decompte>;
  setDecompteStatus(id: string, status: DecompteStatus): Promise<Decompte>;
  removeDecompte(id: string): Promise<void>;
}

export interface ProgramRepo {
  /** Items d'une version (défaut : version de travail courante). */
  list(operationId: string, version?: number): Promise<ProgramItem[]>;
  /** Numéros de versions validées (snapshots consultables). */
  versions(operationId: string): Promise<number[]>;
  currentVersion(operationId: string): Promise<number>;
  add(operationId: string, draft: ProgramItemDraft): Promise<ProgramItem>;
  update(id: string, patch: ProgramItemPatch): Promise<ProgramItem>;
  remove(id: string): Promise<void>;
  /** RG-M1-11 — fige la version courante et ouvre la suivante. Renvoie le n° figé. */
  validateVersion(operationId: string): Promise<number>;
}

export type { ProgramCategory };
