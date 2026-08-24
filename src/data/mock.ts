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
import { permitGate, type Authorization, type AuthorizationInput, type AuthorizationStatus } from '../domain/m2/authorizations';
import { ddGate, type DueDiligenceItem, type DueDiligenceInput, type DueDiligenceStatus } from '../domain/m2/dueDiligence';
import type {
  LandParcel,
  LandParcelInput,
  AcquisitionStatus,
  TitleDocument,
  TitleDocumentInput,
  TitleDocStatus,
} from '../domain/m2/foncier';
import { doGate, honorairesFromStakeholders } from '../domain/m7/rules';
import { canAssignAccountable } from '../domain/m7/validation';
import { fraisFinanciersFromDrawdowns } from '../domain/m5/financing';
import type { Financing, FinancingInput, FinancingStatus, Drawdown, DrawdownInput, DrawdownStatus } from '../domain/m5/types';
import type { Unit, UnitInput, UnitStatus, Sale, SaleInput, SaleStatus, Receipt, ReceiptInput, ReceiptStatus } from '../domain/m6/types';
import { recettesEncaissees } from '../domain/m6/commercialisation';
import type { ReportSnapshot, ReportInput } from '../domain/m21/reporting';
import type { Insurance, InsuranceInput, RaciAssignment, RaciInput, Decision, DecisionInput } from '../domain/m7/types';
import type { Contract, ContractInput, Decompte, DecompteInput, DecompteStatus } from '../domain/payments/types';
import type { Task, TaskInput } from '../domain/m12/types';
import type { Tender, TenderInput, TenderStatus } from '../domain/m8/types';
import type { Study, StudyInput, StudyStatus } from '../domain/m3/types';
import type { Offer, OfferInput, OfferStatus } from '../domain/m9/types';
import type { PurchaseOrder, PurchaseOrderInput, PurchaseStatus } from '../domain/m10/types';
import type { Reserve, ReserveInput, ReserveStatus } from '../domain/m19/types';
import type { Guarantee, GuaranteeInput, GuaranteeStatus } from '../domain/m17/types';
import type { Risk, RiskInput, RiskStatus } from '../domain/m20/types';
import type { AuditEntry, AuditInput } from '../domain/m23/types';
import type { SiteReport, SiteReportInput } from '../domain/m13/types';
import type { ChangeOrder, CreateChangeOrderInput } from '../domain/m14/types';
import { buildNewChangeOrder } from '../domain/m14';
import type { Document, DocumentInput, DocStatus } from '../domain/ged/types';
import type { Rfi, RfiInput, RfiStatus } from '../domain/rfi/types';
import type { Connection, ConnectionInput, ConnectionStatus } from '../domain/m18/types';
import type { LibraryDoc, LibraryDocInput, LibraryStatus } from '../domain/m22/types';
import type { HandoverFile } from '../domain/handover/types';
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
  ComplianceRepo,
  FinancingRepo,
  CommercialisationRepo,
  ReportingRepo,
  PaymentsRepo,
  PlanningRepo,
  TendersRepo,
  GovernanceRepo,
  StudiesRepo,
  OffersRepo,
  PurchasingRepo,
  ReceptionRepo,
  GuaranteesRepo,
  RisksRepo,
  AuditRepo,
  SiteReportsRepo,
  ChangeOrdersRepo,
  ChangeOrderPatch,
  DocumentsRepo,
  RfisRepo,
  ConnectionsRepo,
  LibraryRepo,
  HandoverRepo,
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
  insurances: Insurance[];
  dueDiligence: DueDiligenceItem[];
  landParcels: LandParcel[];
  titleDocuments: TitleDocument[];
  financings: Financing[];
  drawdowns: Drawdown[];
  units: Unit[];
  sales: Sale[];
  receipts: Receipt[];
  reportSnapshots: ReportSnapshot[];
  raciAssignments: RaciAssignment[];
  decisions: Decision[];
  studies: Study[];
  offers: Offer[];
  purchaseOrders: PurchaseOrder[];
  reserves: Reserve[];
  guarantees: Guarantee[];
  risks: Risk[];
  auditLog: AuditEntry[];
  siteReports: SiteReport[];
  changeOrders: ChangeOrder[];
  documents: Document[];
  rfis: Rfi[];
  connections: Connection[];
  library: LibraryDoc[];
  handover: HandoverFile[];
}

interface Deps {
  telemetry: Telemetry;
  id?: () => string;
  now?: () => string;
}

const defaultCtx = (over: Partial<TransitionContext> = {}): TransitionContext => ({
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
  const insurances: Insurance[] = [
    { id: 'in-p1', tenantId: T, operationId: 'op-palmiers', stakeholderId: 'st-p4', type: 'DO', insurer: 'NSIA Assurances', validFrom: '2026-02-01', validTo: '2030-12-31', attestationRef: 'DO-2026-0142' },
    { id: 'in-p2', tenantId: T, operationId: 'op-palmiers', stakeholderId: 'st-p3', type: 'decennale', insurer: 'NSIA Assurances', validFrom: '2026-02-01', validTo: '2030-12-31', attestationRef: 'DEC-2026-0143' },
  ];
  // Due diligence (M2) — Riviera : litige « critical » ouvert (bloque conception, RG-M2-03).
  // Palmiers : réserve « high » levée → non bloquante.
  const dueDiligence: DueDiligenceItem[] = [
    { id: 'dd-r1', tenantId: T, operationId: 'op-riviera', category: 'litige', finding: 'Litige de bornage avec parcelle voisine', severity: 'critical', status: 'open' },
    { id: 'dd-p1', tenantId: T, operationId: 'op-palmiers', category: 'servitude', finding: 'Servitude de passage régularisée', severity: 'high', status: 'cleared' },
  ];
  // Dossier foncier (M2) — Palmiers : parcelle acquise avec acte notarié vérifié ;
  // Cosmos : sous promesse avec condition suspensive restante.
  const landParcels: LandParcel[] = [
    { id: 'lp-p1', tenantId: T, operationId: 'op-palmiers', reference: 'TF 12345/PLATEAU', area: 4200, tenureType: 'titre_foncier', price: 520_000_000, acquisitionStatus: 'acquis', notary: 'Me Kouamé', suspensiveConditions: [] },
    { id: 'lp-c1', tenantId: T, operationId: 'op-cosmos', reference: 'TF 78901/COCODY', area: 6800, tenureType: 'titre_foncier', price: 1_200_000_000, acquisitionStatus: 'sous_promesse', notary: 'Me Diabaté', suspensiveConditions: ['Purge des droits coutumiers'] },
  ];
  const titleDocuments: TitleDocument[] = [
    { id: 'td-lp1a', tenantId: T, parcelId: 'lp-p1', docType: 'titre_foncier', reference: 'TF 12345', status: 'verified', fileRef: null },
    { id: 'td-lp1b', tenantId: T, parcelId: 'lp-p1', docType: 'acte_notarie', reference: 'AN-2026-0087', status: 'verified', fileRef: null },
  ];
  // Financement (M5) — Palmiers : crédit promoteur avec deux tranches débloquées
  // (alimentent les frais_financiers du bilan, RG-M5-02).
  const financings: Financing[] = [
    { id: 'fin-p1', tenantId: T, operationId: 'op-palmiers', source: 'credit_promoteur', amount: Money.of(1_500_000_000, 'XOF'), rate: 0.09, status: 'en_cours' },
  ];
  const drawdowns: Drawdown[] = [
    { id: 'dw-p1', tenantId: T, financingId: 'fin-p1', amount: Money.of(600_000_000, 'XOF'), condition: 0.2, status: 'debloque', date: '2026-03-01' },
    { id: 'dw-p2', tenantId: T, financingId: 'fin-p1', amount: Money.of(500_000_000, 'XOF'), condition: 0.5, status: 'demande', date: null },
  ];
  // Commercialisation (M6) — Palmiers : quelques lots (dispo, réservé, vendu).
  const VEFA_SCHEDULE = [
    { key: 'reservation', pct: 0.05 },
    { key: 'fondations', pct: 0.35 },
    { key: 'hors_eau', pct: 0.7 },
    { key: 'livraison', pct: 1.0 },
  ];
  const units: Unit[] = [
    { id: 'un-p1', tenantId: T, operationId: 'op-palmiers', lotId: null, typology: 'T3', area: 78, price: Money.of(42_000_000, 'XOF'), status: 'vendu' },
    { id: 'un-p2', tenantId: T, operationId: 'op-palmiers', lotId: null, typology: 'T4', area: 96, price: Money.of(55_000_000, 'XOF'), status: 'reserve' },
    { id: 'un-p3', tenantId: T, operationId: 'op-palmiers', lotId: null, typology: 'T2', area: 54, price: Money.of(31_000_000, 'XOF'), status: 'disponible' },
  ];
  const sales: Sale[] = [
    { id: 'sa-p1', tenantId: T, operationId: 'op-palmiers', kind: 'reservation', unitId: 'un-p1', counterpart: 'M. Traoré', amount: Money.of(42_000_000, 'XOF'), schedule: VEFA_SCHEDULE, status: 'active' },
    { id: 'sa-p2', tenantId: T, operationId: 'op-palmiers', kind: 'reservation', unitId: 'un-p2', counterpart: 'Mme Bamba', amount: Money.of(55_000_000, 'XOF'), schedule: VEFA_SCHEDULE, status: 'active' },
  ];
  const receipts: Receipt[] = [
    { id: 're-p1', tenantId: T, saleId: 'sa-p1', amount: Money.of(2_100_000, 'XOF'), method: 'virement', status: 'settled', reference: 'VIR-001' },
    { id: 're-p2', tenantId: T, saleId: 'sa-p1', amount: Money.of(14_700_000, 'XOF'), method: 'virement', status: 'settled', reference: 'VIR-002' },
    { id: 're-p3', tenantId: T, saleId: 'sa-p2', amount: Money.of(2_750_000, 'XOF'), method: 'mobile_money', status: 'pending', reference: null },
  ];

  const reportSnapshots: ReportSnapshot[] = [];

  // Gouvernance (M7) — Palmiers : matrice RACI de démonstration (un A par activité)
  // et quelques décisions actées (registre append-only).
  const raciAssignments: RaciAssignment[] = [
    { id: 'ra-p1', tenantId: T, operationId: 'op-palmiers', activity: 'Conception', stakeholderId: 'st-p1', raci: 'A' },
    { id: 'ra-p2', tenantId: T, operationId: 'op-palmiers', activity: 'Conception', stakeholderId: 'st-p2', raci: 'R' },
    { id: 'ra-p3', tenantId: T, operationId: 'op-palmiers', activity: 'Exécution travaux', stakeholderId: 'st-p3', raci: 'R' },
    { id: 'ra-p4', tenantId: T, operationId: 'op-palmiers', activity: 'Exécution travaux', stakeholderId: 'st-p1', raci: 'A' },
    { id: 'ra-p5', tenantId: T, operationId: 'op-palmiers', activity: 'Exécution travaux', stakeholderId: 'st-p2', raci: 'C' },
  ];
  const decisions: Decision[] = [
    { id: 'de-p1', tenantId: T, operationId: 'op-palmiers', kind: 'decision', reference: 'DEC-2026-001', date: '2026-03-15', summary: 'Validation de l’APD et lancement de la consultation gros œuvre', decidedBy: 'MOA — Direction', createdAt: '2026-03-15T09:00:00.000Z' },
    { id: 'de-p2', tenantId: T, operationId: 'op-palmiers', kind: 'OS', reference: 'OS-2026-012', date: '2026-05-20', summary: 'Ordre de service de démarrage — lot 1 gros œuvre', decidedBy: 'MOA — Direction', createdAt: '2026-05-20T09:00:00.000Z' },
  ];

  // Études amont (M3) — Cosmos : diagnostics en cours ; Riviera : programmation validée.
  const studies: Study[] = [
    { id: 'et-c1', tenantId: T, operationId: 'op-cosmos', kind: 'geotechnique', provider: 'Géotech CI', status: 'en_cours', cost: 18_000_000, dueDate: '2026-07-15', summary: null },
    { id: 'et-c2', tenantId: T, operationId: 'op-cosmos', kind: 'environnementale', provider: 'EnviroSahel', status: 'remise', cost: 22_000_000, dueDate: '2026-06-30', summary: 'EIES remise, avis favorable sous réserves' },
    { id: 'et-r1', tenantId: T, operationId: 'op-riviera', kind: 'programmatique', provider: 'Atelier Programmation', status: 'validee', cost: 9_000_000, dueDate: '2026-05-01', summary: 'Programme fonctionnel arrêté' },
  ];

  // Analyse des offres (M9) — Palmiers : dépouillement du marché second œuvre (td-p2).
  const offers: Offer[] = [
    { id: 'of-p1', tenantId: T, operationId: 'op-palmiers', tenderId: 'td-p2', bidder: 'Second Œuvre CI', amount: 480_000_000, scoreTechnical: 82, status: 'conforme' },
    { id: 'of-p2', tenantId: T, operationId: 'op-palmiers', tenderId: 'td-p2', bidder: 'Finitions Modernes', amount: 452_000_000, scoreTechnical: 76, status: 'conforme' },
    { id: 'of-p3', tenantId: T, operationId: 'op-palmiers', tenderId: 'td-p2', bidder: 'BTP Express', amount: 410_000_000, scoreTechnical: 61, status: 'ecarte' },
  ];

  // Achats & logistique (M10) — Palmiers : bons de commande d'approvisionnement.
  const purchaseOrders: PurchaseOrder[] = [
    { id: 'po-p1', tenantId: T, operationId: 'op-palmiers', reference: 'BC-2026-014', supplier: 'Ciments d\u2019Afrique', item: 'Ciment CPJ 42.5', quantity: 1200, unit: 'sacs', amount: 42_000_000, status: 'receptionne' },
    { id: 'po-p2', tenantId: T, operationId: 'op-palmiers', reference: 'BC-2026-021', supplier: 'Acier CI', item: 'Fer \u00e0 b\u00e9ton HA12', quantity: 18, unit: 't', amount: 27_000_000, status: 'livre' },
    { id: 'po-p3', tenantId: T, operationId: 'op-palmiers', reference: 'BC-2026-028', supplier: 'Menuiserie Alu Plus', item: 'Ch\u00e2ssis aluminium', quantity: 96, unit: 'u', amount: 33_000_000, status: 'commande' },
    { id: 'po-p4', tenantId: T, operationId: 'op-palmiers', reference: 'BC-2026-031', supplier: 'Sanitaire Pro', item: 'Kits sanitaires', quantity: 96, unit: 'u', amount: 15_000_000, status: 'brouillon' },
  ];

  // Réception & GPA (M19) — Palmiers : réserves de pré-réception (1 majeure ouverte).
  const reserves: Reserve[] = [
    { id: 'rs-p1', tenantId: T, operationId: 'op-palmiers', label: 'Étanchéité terrasse R+4 non conforme', location: 'Bât. A · R+4 · terrasse', severity: 'majeure', status: 'ouverte', raisedAt: '2026-06-01', clearedAt: null },
    { id: 'rs-p2', tenantId: T, operationId: 'op-palmiers', label: 'Faïence salle de bain fissurée', location: 'Bât. A · Lot 12', severity: 'mineure', status: 'ouverte', raisedAt: '2026-06-02', clearedAt: null },
    { id: 'rs-p3', tenantId: T, operationId: 'op-palmiers', label: 'Peinture cage d\u2019escalier reprise', location: 'Bât. A · circulation', severity: 'mineure', status: 'levee', raisedAt: '2026-05-20', clearedAt: '2026-06-05' },
  ];

  // Cautions & garanties (M17) — Palmiers : garanties bancaires (une à échéance).
  const guarantees: Guarantee[] = [
    { id: 'gt-p1', tenantId: T, operationId: 'op-palmiers', type: 'restitution_avance', issuer: 'Ecobank CI', amount: 145_000_000, validFrom: '2026-03-01', validUntil: '2027-03-01', status: 'active' },
    { id: 'gt-p2', tenantId: T, operationId: 'op-palmiers', type: 'bonne_execution', issuer: 'SGBCI', amount: 72_500_000, validFrom: '2026-03-01', validUntil: '2026-09-05', status: 'active' },
    { id: 'gt-p3', tenantId: T, operationId: 'op-palmiers', type: 'soumission', issuer: 'NSIA Banque', amount: 20_000_000, validFrom: '2026-01-15', validUntil: '2026-03-15', status: 'liberee' },
  ];

  // Registre des risques (M20) — Palmiers.
  const risks: Risk[] = [
    { id: 'rk-p1', tenantId: T, operationId: 'op-palmiers', code: 'R-04', label: 'Retard livraison acier (tension marché)', category: 'delai', probability: 4, impact: 4, status: 'ouvert', mitigation: 'Double sourcing + stock tampon' },
    { id: 'rk-p2', tenantId: T, operationId: 'op-palmiers', code: 'R-07', label: 'Dérive du coût gros œuvre', category: 'financier', probability: 3, impact: 5, status: 'maitrise', mitigation: 'Marché à prix ferme, avenants plafonnés' },
    { id: 'rk-p3', tenantId: T, operationId: 'op-palmiers', code: 'R-11', label: 'Attestation décennale entreprise expirée', category: 'juridique', probability: 5, impact: 5, status: 'ouvert', mitigation: 'Suspension paiement jusqu\u2019à régularisation' },
    { id: 'rk-p4', tenantId: T, operationId: 'op-palmiers', code: 'R-02', label: 'Intempéries saison des pluies', category: 'externe', probability: 3, impact: 2, status: 'ouvert', mitigation: 'Planning avec marge météo' },
  ];
  // Journal d'audit (M23) — Palmiers : quelques traces (append-only).
  const auditLog: AuditEntry[] = [
    { id: 'au-l1', tenantId: T, operationId: 'op-palmiers', at: '2026-06-08T10:12:00.000Z', actor: 'MOA — Direction', action: 'approve', module: 'M16', object: 'Décompte n°2', summary: 'Validation décompte 285 M' },
    { id: 'au-l2', tenantId: T, operationId: 'op-palmiers', at: '2026-06-05T14:30:00.000Z', actor: 'AMO', action: 'update', module: 'M19', object: 'Réserve étanchéité', summary: 'Réserve majeure ouverte' },
    { id: 'au-l3', tenantId: T, operationId: 'op-palmiers', at: '2026-05-20T09:00:00.000Z', actor: 'MOA — Direction', action: 'transition', module: 'M1', object: 'Opération', summary: 'Passage en réalisation' },
  ];

  // Pilotage de réalisation (M13) — Palmiers : comptes rendus de chantier.
  const siteReports: SiteReport[] = [
    { id: 'cr-p1', tenantId: T, operationId: 'op-palmiers', number: 1, date: '2026-05-15', author: 'MOE — Atelier Koffi', progress: 0.45, summary: 'Fondations achevées, démarrage élévations R+1', blockers: 1 },
    { id: 'cr-p2', tenantId: T, operationId: 'op-palmiers', number: 2, date: '2026-06-05', author: 'MOE — Atelier Koffi', progress: 0.62, summary: 'Élévations R+2 en cours ; RFI-042 sur voile porteur', blockers: 2 },
  ];
  // Maîtrise des modifications (M15) — Palmiers : avenant lot 02 sous instruction.
  const changeOrders: ChangeOrder[] = [
    { id: 'co-p1', tenantId: T, operationId: 'op-palmiers', contractId: 'ct-p1', origin: 'aleas', description: 'Fondations spéciales — sol de portance insuffisante', impactCost: Money.of(42_000_000, 'XOF'), impactDays: 15, impactQuality: null, impactAnalyzed: true, status: 'under_review', avenantRef: null, decidedBy: null, rejectionReason: null, createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-10T08:00:00.000Z' },
    { id: 'co-p2', tenantId: T, operationId: 'op-palmiers', contractId: 'ct-p1', origin: 'moa', description: 'Ajout d\u2019un local vélos', impactCost: Money.of(8_500_000, 'XOF'), impactDays: 0, impactQuality: null, impactAnalyzed: true, status: 'approved', avenantRef: null, decidedBy: 'MOA — Direction', rejectionReason: null, createdAt: '2026-05-20T08:00:00.000Z', updatedAt: '2026-05-28T08:00:00.000Z' },
  ];

  // Conception & GED (M11) — Palmiers : plans avec visas.
  const documents: Document[] = [
    { id: 'doc-p1', tenantId: T, operationId: 'op-palmiers', reference: 'ARC-EXE-045', title: 'Plan de niveau R+2', discipline: 'architecture', indice: 'B', status: 'vise_a' },
    { id: 'doc-p2', tenantId: T, operationId: 'op-palmiers', reference: 'STR-EXE-118', title: 'Voile porteur file C', discipline: 'structure', indice: 'C', status: 'diffuse' },
    { id: 'doc-p3', tenantId: T, operationId: 'op-palmiers', reference: 'FLU-EXE-032', title: 'Réseaux CVC R+1', discipline: 'fluides', indice: 'A', status: 'vise_b' },
  ];
  // RFI & collaboration (M12) — Palmiers : RFI-042 bloque le visa STR-EXE-118.
  const rfis: Rfi[] = [
    { id: 'rfi-p1', tenantId: T, operationId: 'op-palmiers', number: 'RFI-042', subject: 'Réservation gaine vs voile porteur', question: 'La réservation de gaine technique est incompatible avec le voile porteur file C ; arbitrage ?', raisedBy: 'BET Structures', priority: 'urgente', status: 'ouverte', dueDate: '2026-06-15', documentRef: 'STR-EXE-118', answer: null },
    { id: 'rfi-p2', tenantId: T, operationId: 'op-palmiers', number: 'RFI-039', subject: 'Nuancier façade', question: 'Confirmation du nuancier RAL pour l\u2019enduit de façade.', raisedBy: 'Entreprise BTP Ivoire', priority: 'normale', status: 'repondue', dueDate: '2026-05-30', documentRef: null, answer: 'RAL 1015 validé' },
  ];

  // Concessionnaires & raccordements (M18) — Palmiers.
  const connections: Connection[] = [
    { id: 'cx-p1', tenantId: T, operationId: 'op-palmiers', utility: 'electricite', concessionaire: 'CIE', reference: 'CIE-2026-4412', status: 'devis', cost: 38_000_000, requestedAt: '2026-04-10' },
    { id: 'cx-p2', tenantId: T, operationId: 'op-palmiers', utility: 'eau', concessionaire: 'SODECI', reference: 'SOD-2026-0891', status: 'raccorde', cost: 12_500_000, requestedAt: '2026-03-05' },
    { id: 'cx-p3', tenantId: T, operationId: 'op-palmiers', utility: 'telecom', concessionaire: 'Orange CI', reference: 'ORG-2026-2210', status: 'demande', cost: 6_000_000, requestedAt: '2026-06-01' },
  ];
  // Documents — GED transverse (M22) — Palmiers.
  const library: LibraryDoc[] = [
    { id: 'lb-p1', tenantId: T, operationId: 'op-palmiers', name: 'Marché gros œuvre — lot 1', category: 'contrat', reference: 'M-2026-001', version: 2, status: 'publie', updatedAt: '2026-03-01T08:00:00.000Z' },
    { id: 'lb-p2', tenantId: T, operationId: 'op-palmiers', name: 'Permis de construire', category: 'administratif', reference: 'PC-PLATEAU-0142', version: 1, status: 'publie', updatedAt: '2026-02-10T08:00:00.000Z' },
    { id: 'lb-p3', tenantId: T, operationId: 'op-palmiers', name: 'Plan de financement', category: 'financier', reference: 'FIN-2026-01', version: 3, status: 'brouillon', updatedAt: '2026-06-08T08:00:00.000Z' },
  ];

  // Passation vers exploitation (bascule) — Palmiers.
  const handover: HandoverFile[] = [
    {
      operationId: 'op-palmiers',
      doe: [
        { key: 'plans_asbuilt', responsible: 'Atelier Nord', expected: 86, received: 34 },
        { key: 'notices', responsible: 'Entreprises', expected: 42, received: 18 },
        { key: 'garanties', responsible: 'Entreprises', expected: 96, received: 64 },
        { key: 'pv_controle', responsible: 'CT', expected: 24, received: 24 },
      ],
      equipment: [
        { label: 'Ascenseurs (4)', detail: 'Garantie constructeur jusqu’au 03.2029', target: 'keystone' },
        { label: 'Groupe électrogène 250 kVA', detail: 'Contrat de maintenance à souscrire', target: 'keystone' },
        { label: '96 lots résidentiels', detail: 'Dont 12 en location', target: 'lease' },
        { label: '2 commerces RDC', detail: 'Baux commerciaux actifs', target: 'lease' },
      ],
      equipmentCount: 128,
      guaranteesCount: 96,
      guaranteesWithoutEnd: 32,
      transferState: 'preparation',
      exportReady: true,
    },
  ];

  return { operations, program, ctx, bilan, cashflows, stakeholders, contracts, decomptes, tasks, tenders, authorizations, insurances, dueDiligence, landParcels, titleDocuments, financings, drawdowns, units, sales, receipts, reportSnapshots, raciAssignments, decisions, studies, offers, purchaseOrders, reserves, guarantees, risks, auditLog, siteReports, changeOrders, documents, rfis, connections, library, handover };
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
      // Gardes M2 (permis, DD) et M7 (DO) dérivées des collections, comme en base (adapter Supabase).
      const today = (deps.now?.() ?? new Date().toISOString()).slice(0, 10);
      const auths = db.authorizations.filter((a) => a.operationId === opId && a.tenantId === session.tenantId);
      const inss = db.insurances.filter((i) => i.operationId === opId && i.tenantId === session.tenantId);
      const dds = db.dueDiligence.filter((d) => d.operationId === opId && d.tenantId === session.tenantId);
      return {
        ...base,
        validatedProgramItems: validatedCount(opId),
        bilanInitialized: hasBilan,
        permitGranted: permitGate(auths, today).ok,
        doInsuranceValid: doGate(inss, today).ok,
        ddCleared: ddGate(dds).ok,
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
  const today = () => (deps.now?.() ?? new Date().toISOString()).slice(0, 10);
  // Postes dérivés (source de vérité hors bilan) : honoraires (M7) et
  // frais_financiers (M5). Ils supersèdent toute ligne saisie manuellement.
  const DERIVED_POSTES = ['honoraires', 'frais_financiers'];
  const honoraires = (opId: string, currency: string) =>
    honorairesFromStakeholders(
      db.stakeholders.filter((s) => s.operationId === opId && s.tenantId === session.tenantId),
      currency,
    );
  const fraisFinanciers = (opId: string, currency: string) => {
    const finIds = db.financings.filter((f) => f.operationId === opId && f.tenantId === session.tenantId);
    const rateById = new Map(finIds.map((f) => [f.id, f.rate]));
    const items = db.drawdowns
      .filter((d) => d.tenantId === session.tenantId && rateById.has(d.financingId))
      .map((d) => ({ amount: d.amount, rate: rateById.get(d.financingId) ?? 0, date: d.date, status: d.status }));
    return fraisFinanciersFromDrawdowns(items, today(), currency);
  };
  const derivedCostLines = (opId: string, currency: string): { poste: string; amount: Money }[] =>
    [
      { poste: 'honoraires', amount: honoraires(opId, currency) },
      { poste: 'frais_financiers', amount: fraisFinanciers(opId, currency) },
    ].filter((l) => !l.amount.isZero());
  const nonDerivedSeeds = (opId: string) =>
    seeds(opId).filter((b) => !(b.kind === 'cost' && DERIVED_POSTES.includes(b.poste)));

  return {
    async summary(opId): Promise<BilanView | null> {
      const op = db.operations.find((o) => o.id === opId && o.tenantId === session.tenantId);
      if (!op) return null;
      const lines: BilanLine[] = nonDerivedSeeds(opId).map((b) => ({ kind: b.kind, amount: Money.of(b.amountPlanned, op.currency) }));
      for (const d of derivedCostLines(opId, op.currency)) lines.push({ kind: 'cost', amount: d.amount });
      // RG-M6-02 — recettes réalisées = encaissements « settled » des ventes de l'opération.
      const saleIds = new Set(db.sales.filter((s) => s.operationId === opId && s.tenantId === session.tenantId).map((s) => s.id));
      const realized = recettesEncaissees(
        db.receipts.filter((r) => r.tenantId === session.tenantId && saleIds.has(r.saleId)),
        op.currency,
      );
      return {
        summary: bilanSummary(lines, op.currency, realized),
        tri: tri(db.cashflows[opId] ?? []),
        bac: Money.of(op.budgetBac, op.currency),
        cashflow: db.cashflows[opId] ?? [],
      };
    },

    async lines(opId) {
      const op = db.operations.find((o) => o.id === opId && o.tenantId === session.tenantId);
      const currency = op?.currency ?? 'XOF';
      const records = nonDerivedSeeds(opId).map(toRecord);
      for (const d of derivedCostLines(opId, currency)) {
        const amount = d.amount.toMajorNumber();
        records.push({ id: `${d.poste}-derived-${opId}`, operationId: opId, kind: 'cost', poste: d.poste, amountPlanned: amount, amountActual: amount });
      }
      return records;
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

export function createComplianceRepo(db: MockDb, session: Session, deps: Deps): ComplianceRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);

  return {
    async authorizations(opId) {
      return mine(db.authorizations).filter((a) => a.operationId === opId).map((a) => ({ ...a }));
    },
    async addAuthorization(opId, input: AuthorizationInput) {
      const a: Authorization = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        type: input.type, authority: input.authority.trim(), status: 'draft', validity: input.validity ?? null,
      };
      db.authorizations.push(a);
      return { ...a };
    },
    async setAuthorizationStatus(aid, status: AuthorizationStatus) {
      const a = db.authorizations.find((x) => x.id === aid && x.tenantId === session.tenantId);
      if (!a) throw new Error('not_found');
      a.status = status;
      return { ...a };
    },
    async removeAuthorization(aid) {
      const i = db.authorizations.findIndex((x) => x.id === aid && x.tenantId === session.tenantId);
      if (i >= 0) db.authorizations.splice(i, 1);
    },

    async insurances(opId) {
      return mine(db.insurances).filter((x) => x.operationId === opId).map((x) => ({ ...x }));
    },
    async addInsurance(opId, input: InsuranceInput) {
      const ins: Insurance = {
        id: id(), tenantId: session.tenantId, operationId: opId, stakeholderId: input.stakeholderId ?? null,
        type: input.type, insurer: input.insurer.trim(), validFrom: input.validFrom,
        validTo: input.validTo ?? null, attestationRef: input.attestationRef ?? null,
      };
      db.insurances.push(ins);
      return { ...ins };
    },
    async removeInsurance(iid) {
      const i = db.insurances.findIndex((x) => x.id === iid && x.tenantId === session.tenantId);
      if (i >= 0) db.insurances.splice(i, 1);
    },

    async dueDiligence(opId) {
      return mine(db.dueDiligence).filter((d) => d.operationId === opId).map((d) => ({ ...d }));
    },
    async addDueDiligence(opId, input: DueDiligenceInput) {
      const d: DueDiligenceItem = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        category: input.category, finding: input.finding.trim(), severity: input.severity, status: 'open',
      };
      db.dueDiligence.push(d);
      return { ...d };
    },
    async setDueDiligenceStatus(did, status: DueDiligenceStatus) {
      const d = db.dueDiligence.find((x) => x.id === did && x.tenantId === session.tenantId);
      if (!d) throw new Error('not_found');
      d.status = status;
      return { ...d };
    },
    async removeDueDiligence(did) {
      const i = db.dueDiligence.findIndex((x) => x.id === did && x.tenantId === session.tenantId);
      if (i >= 0) db.dueDiligence.splice(i, 1);
    },

    async landParcels(opId) {
      return mine(db.landParcels).filter((p) => p.operationId === opId).map((p) => ({ ...p }));
    },
    async addLandParcel(opId, input: LandParcelInput) {
      const p: LandParcel = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        reference: input.reference.trim(), area: input.area, tenureType: input.tenureType, price: input.price,
        acquisitionStatus: 'prospection', notary: input.notary ?? null, suspensiveConditions: input.suspensiveConditions ?? [],
      };
      db.landParcels.push(p);
      return { ...p };
    },
    async setAcquisitionStatus(pid, status: AcquisitionStatus) {
      const p = db.landParcels.find((x) => x.id === pid && x.tenantId === session.tenantId);
      if (!p) throw new Error('not_found');
      p.acquisitionStatus = status;
      return { ...p };
    },
    async removeLandParcel(pid) {
      const i = db.landParcels.findIndex((x) => x.id === pid && x.tenantId === session.tenantId);
      if (i >= 0) db.landParcels.splice(i, 1);
      // Titres orphelins supprimés en cascade (comme la FK on delete cascade).
      db.titleDocuments = db.titleDocuments.filter((x) => x.parcelId !== pid);
    },
    async titles(parcelId) {
      return mine(db.titleDocuments).filter((tdoc) => tdoc.parcelId === parcelId).map((tdoc) => ({ ...tdoc }));
    },
    async addTitle(parcelId, input: TitleDocumentInput) {
      const tdoc: TitleDocument = {
        id: id(), tenantId: session.tenantId, parcelId,
        docType: input.docType, reference: input.reference.trim(), status: 'pending', fileRef: input.fileRef ?? null,
      };
      db.titleDocuments.push(tdoc);
      return { ...tdoc };
    },
    async setTitleStatus(tid, status: TitleDocStatus) {
      const tdoc = db.titleDocuments.find((x) => x.id === tid && x.tenantId === session.tenantId);
      if (!tdoc) throw new Error('not_found');
      tdoc.status = status;
      return { ...tdoc };
    },
    async removeTitle(tid) {
      const i = db.titleDocuments.findIndex((x) => x.id === tid && x.tenantId === session.tenantId);
      if (i >= 0) db.titleDocuments.splice(i, 1);
    },
  };
}

export function createCommercialisationRepo(db: MockDb, session: Session, deps: Deps): CommercialisationRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <U extends { tenantId: string }>(rows: U[]) => rows.filter((r) => r.tenantId === session.tenantId);

  return {
    async units(opId) {
      return mine(db.units).filter((u) => u.operationId === opId).map((u) => ({ ...u }));
    },
    async addUnit(opId, input: UnitInput) {
      const u: Unit = {
        id: id(), tenantId: session.tenantId, operationId: opId, lotId: input.lotId ?? null,
        typology: input.typology.trim(), area: input.area, price: input.price, status: 'disponible',
      };
      db.units.push(u);
      return { ...u };
    },
    async setUnitStatus(uid, status: UnitStatus) {
      const u = db.units.find((x) => x.id === uid && x.tenantId === session.tenantId);
      if (!u) throw new Error('not_found');
      u.status = status;
      return { ...u };
    },
    async removeUnit(uid) {
      const i = db.units.findIndex((x) => x.id === uid && x.tenantId === session.tenantId);
      if (i >= 0) db.units.splice(i, 1);
    },
    async sales(opId) {
      return mine(db.sales).filter((s) => s.operationId === opId).map((s) => ({ ...s }));
    },
    async addSale(opId, input: SaleInput) {
      const s: Sale = {
        id: id(), tenantId: session.tenantId, operationId: opId, kind: input.kind, unitId: input.unitId ?? null,
        counterpart: input.counterpart.trim(), amount: input.amount, schedule: input.schedule ?? [], status: 'draft',
      };
      db.sales.push(s);
      return { ...s };
    },
    async setSaleStatus(sid, status: SaleStatus) {
      const s = db.sales.find((x) => x.id === sid && x.tenantId === session.tenantId);
      if (!s) throw new Error('not_found');
      s.status = status;
      return { ...s };
    },
    async removeSale(sid) {
      const i = db.sales.findIndex((x) => x.id === sid && x.tenantId === session.tenantId);
      if (i >= 0) db.sales.splice(i, 1);
      db.receipts = db.receipts.filter((r) => r.saleId !== sid);
    },
    async receipts(saleId) {
      return mine(db.receipts).filter((r) => r.saleId === saleId).map((r) => ({ ...r }));
    },
    async addReceipt(saleId, input: ReceiptInput) {
      const r: Receipt = {
        id: id(), tenantId: session.tenantId, saleId, amount: input.amount, method: input.method,
        status: 'pending', reference: input.reference ?? null,
      };
      db.receipts.push(r);
      return { ...r };
    },
    async setReceiptStatus(rid, status: ReceiptStatus) {
      const r = db.receipts.find((x) => x.id === rid && x.tenantId === session.tenantId);
      if (!r) throw new Error('not_found');
      r.status = status;
      return { ...r };
    },
    async removeReceipt(rid) {
      const i = db.receipts.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.receipts.splice(i, 1);
    },
  };
}

export function createReportingRepo(db: MockDb, session: Session, deps: Deps): ReportingRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    async list(opId) {
      return db.reportSnapshots
        .filter((r) => r.operationId === opId && r.tenantId === session.tenantId)
        .map((r) => ({ ...r }))
        .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
    },
    async generate(opId, input: ReportInput) {
      const snap: ReportSnapshot = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        type: input.type, period: input.period, data: input.data, generatedAt: now(),
      };
      db.reportSnapshots.push(snap);
      return { ...snap };
    },
    async remove(rid) {
      const i = db.reportSnapshots.findIndex((r) => r.id === rid && r.tenantId === session.tenantId);
      if (i >= 0) db.reportSnapshots.splice(i, 1);
    },
  };
}

export function createFinancingRepo(db: MockDb, session: Session, deps: Deps): FinancingRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);

  return {
    async list(opId) {
      return mine(db.financings).filter((f) => f.operationId === opId).map((f) => ({ ...f }));
    },
    async add(opId, input: FinancingInput) {
      const f: Financing = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        source: input.source, amount: input.amount, rate: input.rate, status: 'negocie',
      };
      db.financings.push(f);
      return { ...f };
    },
    async setStatus(fid, status: FinancingStatus) {
      const f = db.financings.find((x) => x.id === fid && x.tenantId === session.tenantId);
      if (!f) throw new Error('not_found');
      f.status = status;
      return { ...f };
    },
    async remove(fid) {
      const i = db.financings.findIndex((x) => x.id === fid && x.tenantId === session.tenantId);
      if (i >= 0) db.financings.splice(i, 1);
      db.drawdowns = db.drawdowns.filter((d) => d.financingId !== fid);
    },
    async drawdowns(financingId) {
      return mine(db.drawdowns).filter((d) => d.financingId === financingId).map((d) => ({ ...d }));
    },
    async addDrawdown(financingId, input: DrawdownInput) {
      const d: Drawdown = {
        id: id(), tenantId: session.tenantId, financingId,
        amount: input.amount, condition: input.condition, status: 'planifie', date: null,
      };
      db.drawdowns.push(d);
      return { ...d };
    },
    async setDrawdownStatus(did, status: DrawdownStatus, date?: string | null) {
      const d = db.drawdowns.find((x) => x.id === did && x.tenantId === session.tenantId);
      if (!d) throw new Error('not_found');
      d.status = status;
      if (status === 'debloque') d.date = date ?? (deps.now?.() ?? new Date().toISOString()).slice(0, 10);
      return { ...d };
    },
    async removeDrawdown(did) {
      const i = db.drawdowns.findIndex((x) => x.id === did && x.tenantId === session.tenantId);
      if (i >= 0) db.drawdowns.splice(i, 1);
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

export function createGovernanceRepo(db: MockDb, session: Session, deps: Deps): GovernanceRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);

  return {
    async raci(opId) {
      return mine(db.raciAssignments).filter((r) => r.operationId === opId).map((r) => ({ ...r }));
    },
    async addRaci(opId, input: RaciInput) {
      const activity = input.activity.trim();
      // RG-M7-07 — au plus un « A » par activité.
      if (input.raci === 'A') {
        const existing = db.raciAssignments.filter(
          (r) => r.tenantId === session.tenantId && r.operationId === opId && r.activity === activity,
        );
        if (!canAssignAccountable(existing)) throw new Error('raci_duplicate_accountable');
      }
      const r: RaciAssignment = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        activity, stakeholderId: input.stakeholderId, raci: input.raci,
      };
      db.raciAssignments.push(r);
      return { ...r };
    },
    async removeRaci(rid) {
      const i = db.raciAssignments.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.raciAssignments.splice(i, 1);
    },

    async decisions(opId) {
      return mine(db.decisions)
        .filter((d) => d.operationId === opId)
        .map((d) => ({ ...d }))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
    },
    async addDecision(opId, input: DecisionInput) {
      // RG-M7-08 — le registre est append-only : uniquement une insertion.
      const d: Decision = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        kind: input.kind, reference: input.reference.trim(), date: input.date,
        summary: input.summary?.trim() || null, decidedBy: input.decidedBy.trim(), createdAt: now(),
      };
      db.decisions.push(d);
      return { ...d };
    },
  };
}

export function createConnectionsRepo(db: MockDb, session: Session, deps: Deps): ConnectionsRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.connections).filter((c) => c.operationId === opId).map((c) => ({ ...c }));
    },
    async add(opId, input: ConnectionInput) {
      const c: Connection = {
        id: id(), tenantId: session.tenantId, operationId: opId, utility: input.utility,
        concessionaire: input.concessionaire.trim(), reference: input.reference.trim(),
        status: 'demande', cost: input.cost, requestedAt: input.requestedAt,
      };
      db.connections.push(c);
      return { ...c };
    },
    async setStatus(cid, status: ConnectionStatus) {
      const c = db.connections.find((x) => x.id === cid && x.tenantId === session.tenantId);
      if (!c) throw new Error('not_found');
      c.status = status;
      return { ...c };
    },
    async remove(cid) {
      const i = db.connections.findIndex((x) => x.id === cid && x.tenantId === session.tenantId);
      if (i >= 0) db.connections.splice(i, 1);
    },
  };
}

export function createLibraryRepo(db: MockDb, session: Session, deps: Deps): LibraryRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.library).filter((d) => d.operationId === opId).map((d) => ({ ...d }));
    },
    async add(opId, input: LibraryDocInput) {
      const d: LibraryDoc = {
        id: id(), tenantId: session.tenantId, operationId: opId, name: input.name.trim(),
        category: input.category, reference: input.reference.trim(), version: 1, status: 'brouillon', updatedAt: now(),
      };
      db.library.push(d);
      return { ...d };
    },
    async setStatus(did, status: LibraryStatus) {
      const d = db.library.find((x) => x.id === did && x.tenantId === session.tenantId);
      if (!d) throw new Error('not_found');
      d.status = status;
      d.updatedAt = now();
      return { ...d };
    },
    async remove(did) {
      const i = db.library.findIndex((x) => x.id === did && x.tenantId === session.tenantId);
      if (i >= 0) db.library.splice(i, 1);
    },
  };
}

export function createHandoverRepo(db: MockDb): HandoverRepo {
  return {
    async get(opId) {
      const f = db.handover.find((h) => h.operationId === opId);
      return f ? { ...f, doe: f.doe.map((c) => ({ ...c })), equipment: f.equipment.map((e) => ({ ...e })) } : null;
    },
  };
}

export function createDocumentsRepo(db: MockDb, session: Session, deps: Deps): DocumentsRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.documents).filter((d) => d.operationId === opId).map((d) => ({ ...d }));
    },
    async add(opId, input: DocumentInput) {
      const d: Document = {
        id: id(), tenantId: session.tenantId, operationId: opId, reference: input.reference.trim(),
        title: input.title.trim(), discipline: input.discipline, indice: input.indice.trim() || 'A', status: 'en_cours',
      };
      db.documents.push(d);
      return { ...d };
    },
    async setStatus(did, status: DocStatus) {
      const d = db.documents.find((x) => x.id === did && x.tenantId === session.tenantId);
      if (!d) throw new Error('not_found');
      d.status = status;
      return { ...d };
    },
    async remove(did) {
      const i = db.documents.findIndex((x) => x.id === did && x.tenantId === session.tenantId);
      if (i >= 0) db.documents.splice(i, 1);
    },
  };
}

export function createRfisRepo(db: MockDb, session: Session, deps: Deps): RfisRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.rfis).filter((r) => r.operationId === opId).map((r) => ({ ...r }));
    },
    async add(opId, input: RfiInput) {
      const r: Rfi = {
        id: id(), tenantId: session.tenantId, operationId: opId, number: input.number.trim(),
        subject: input.subject.trim(), question: input.question.trim(), raisedBy: input.raisedBy.trim(),
        priority: input.priority, status: 'ouverte', dueDate: input.dueDate ?? null,
        documentRef: input.documentRef ?? null, answer: null,
      };
      db.rfis.push(r);
      return { ...r };
    },
    async setStatus(rid, status: RfiStatus, answer?: string | null) {
      const r = db.rfis.find((x) => x.id === rid && x.tenantId === session.tenantId);
      if (!r) throw new Error('not_found');
      r.status = status;
      if (answer !== undefined) r.answer = answer;
      return { ...r };
    },
    async remove(rid) {
      const i = db.rfis.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.rfis.splice(i, 1);
    },
  };
}

export function createSiteReportsRepo(db: MockDb, session: Session, deps: Deps): SiteReportsRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.siteReports)
        .filter((r) => r.operationId === opId)
        .map((r) => ({ ...r }))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.number - a.number));
    },
    async add(opId, input: SiteReportInput) {
      const nextNo = db.siteReports.filter((r) => r.operationId === opId && r.tenantId === session.tenantId)
        .reduce((max, r) => Math.max(max, r.number), 0) + 1;
      const r: SiteReport = {
        id: id(), tenantId: session.tenantId, operationId: opId, number: nextNo,
        date: input.date, author: input.author.trim(), progress: input.progress,
        summary: input.summary.trim(), blockers: input.blockers,
      };
      db.siteReports.push(r);
      return { ...r };
    },
    async remove(rid) {
      const i = db.siteReports.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.siteReports.splice(i, 1);
    },
  };
}

export function createChangeOrdersRepo(db: MockDb, session: Session, deps: Deps): ChangeOrdersRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  const currencyOf = (opId: string) =>
    db.operations.find((o) => o.id === opId && o.tenantId === session.tenantId)?.currency ?? 'XOF';
  return {
    async list(opId) {
      return mine(db.changeOrders).filter((c) => c.operationId === opId).map((c) => ({ ...c }));
    },
    async add(opId, input: CreateChangeOrderInput) {
      const co = buildNewChangeOrder(input, currencyOf(opId), { id: id(), tenantId: session.tenantId, operationId: opId, now: now() });
      db.changeOrders.push(co);
      return { ...co };
    },
    async update(cid, patch: ChangeOrderPatch) {
      const co = db.changeOrders.find((x) => x.id === cid && x.tenantId === session.tenantId);
      if (!co) throw new Error('not_found');
      Object.assign(co, patch, { updatedAt: now() });
      return { ...co };
    },
    async remove(cid) {
      const i = db.changeOrders.findIndex((x) => x.id === cid && x.tenantId === session.tenantId);
      if (i >= 0) db.changeOrders.splice(i, 1);
    },
  };
}

export function createRisksRepo(db: MockDb, session: Session, deps: Deps): RisksRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.risks).filter((r) => r.operationId === opId).map((r) => ({ ...r }));
    },
    async add(opId, input: RiskInput) {
      const r: Risk = {
        id: id(), tenantId: session.tenantId, operationId: opId, code: input.code.trim(), label: input.label.trim(),
        category: input.category, probability: input.probability, impact: input.impact,
        status: 'ouvert', mitigation: input.mitigation?.trim() || null,
      };
      db.risks.push(r);
      return { ...r };
    },
    async setStatus(rid, status: RiskStatus) {
      const r = db.risks.find((x) => x.id === rid && x.tenantId === session.tenantId);
      if (!r) throw new Error('not_found');
      r.status = status;
      return { ...r };
    },
    async remove(rid) {
      const i = db.risks.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.risks.splice(i, 1);
    },
  };
}

export function createAuditRepo(db: MockDb, session: Session, deps: Deps): AuditRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.auditLog)
        .filter((e) => e.operationId === opId)
        .map((e) => ({ ...e }))
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    },
    async append(opId, input: AuditInput) {
      // RG-M23 — append-only : uniquement une insertion.
      const e: AuditEntry = {
        id: id(), tenantId: session.tenantId, operationId: opId, at: now(),
        actor: session.userId, action: input.action, module: input.module.trim(),
        object: input.object.trim(), summary: input.summary?.trim() || null,
      };
      db.auditLog.push(e);
      return { ...e };
    },
  };
}

export function createGuaranteesRepo(db: MockDb, session: Session, deps: Deps): GuaranteesRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.guarantees).filter((g) => g.operationId === opId).map((g) => ({ ...g }));
    },
    async add(opId, input: GuaranteeInput) {
      const g: Guarantee = {
        id: id(), tenantId: session.tenantId, operationId: opId, type: input.type, issuer: input.issuer.trim(),
        amount: input.amount, validFrom: input.validFrom, validUntil: input.validUntil ?? null, status: 'active',
      };
      db.guarantees.push(g);
      return { ...g };
    },
    async setStatus(gid, status: GuaranteeStatus) {
      const g = db.guarantees.find((x) => x.id === gid && x.tenantId === session.tenantId);
      if (!g) throw new Error('not_found');
      g.status = status;
      return { ...g };
    },
    async remove(gid) {
      const i = db.guarantees.findIndex((x) => x.id === gid && x.tenantId === session.tenantId);
      if (i >= 0) db.guarantees.splice(i, 1);
    },
  };
}

export function createReceptionRepo(db: MockDb, session: Session, deps: Deps): ReceptionRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async reserves(opId) {
      return mine(db.reserves).filter((r) => r.operationId === opId).map((r) => ({ ...r }));
    },
    async addReserve(opId, input: ReserveInput) {
      const r: Reserve = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        label: input.label.trim(), location: input.location.trim(), severity: input.severity,
        status: 'ouverte', raisedAt: input.raisedAt, clearedAt: null,
      };
      db.reserves.push(r);
      return { ...r };
    },
    async setReserveStatus(rid, status: ReserveStatus) {
      const r = db.reserves.find((x) => x.id === rid && x.tenantId === session.tenantId);
      if (!r) throw new Error('not_found');
      r.status = status;
      r.clearedAt = status === 'levee' ? now().slice(0, 10) : null;
      return { ...r };
    },
    async removeReserve(rid) {
      const i = db.reserves.findIndex((x) => x.id === rid && x.tenantId === session.tenantId);
      if (i >= 0) db.reserves.splice(i, 1);
    },
  };
}

export function createPurchasingRepo(db: MockDb, session: Session, deps: Deps): PurchasingRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.purchaseOrders).filter((o) => o.operationId === opId).map((o) => ({ ...o }));
    },
    async add(opId, input: PurchaseOrderInput) {
      const o: PurchaseOrder = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        reference: input.reference.trim(), supplier: input.supplier.trim(), item: input.item.trim(),
        quantity: input.quantity, unit: input.unit.trim(), amount: input.amount, status: 'brouillon',
      };
      db.purchaseOrders.push(o);
      return { ...o };
    },
    async setStatus(oid, status: PurchaseStatus) {
      const o = db.purchaseOrders.find((x) => x.id === oid && x.tenantId === session.tenantId);
      if (!o) throw new Error('not_found');
      o.status = status;
      return { ...o };
    },
    async remove(oid) {
      const i = db.purchaseOrders.findIndex((x) => x.id === oid && x.tenantId === session.tenantId);
      if (i >= 0) db.purchaseOrders.splice(i, 1);
    },
  };
}

export function createOffersRepo(db: MockDb, session: Session, deps: Deps): OffersRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.offers).filter((o) => o.operationId === opId).map((o) => ({ ...o }));
    },
    async add(opId, input: OfferInput) {
      const o: Offer = {
        id: id(), tenantId: session.tenantId, operationId: opId, tenderId: input.tenderId,
        bidder: input.bidder.trim(), amount: input.amount, scoreTechnical: input.scoreTechnical, status: 'recu',
      };
      db.offers.push(o);
      return { ...o };
    },
    async setStatus(oid, status: OfferStatus) {
      const o = db.offers.find((x) => x.id === oid && x.tenantId === session.tenantId);
      if (!o) throw new Error('not_found');
      o.status = status;
      return { ...o };
    },
    async remove(oid) {
      const i = db.offers.findIndex((x) => x.id === oid && x.tenantId === session.tenantId);
      if (i >= 0) db.offers.splice(i, 1);
    },
  };
}

export function createStudiesRepo(db: MockDb, session: Session, deps: Deps): StudiesRepo {
  const id = deps.id ?? (() => crypto.randomUUID());
  const mine = <T extends { tenantId: string }>(rows: T[]) => rows.filter((r) => r.tenantId === session.tenantId);
  return {
    async list(opId) {
      return mine(db.studies).filter((s) => s.operationId === opId).map((s) => ({ ...s }));
    },
    async add(opId, input: StudyInput) {
      const s: Study = {
        id: id(), tenantId: session.tenantId, operationId: opId,
        kind: input.kind, provider: input.provider.trim(), status: 'planifiee',
        cost: input.cost, dueDate: input.dueDate ?? null, summary: input.summary?.trim() || null,
      };
      db.studies.push(s);
      return { ...s };
    },
    async setStatus(sid, status: StudyStatus) {
      const s = db.studies.find((x) => x.id === sid && x.tenantId === session.tenantId);
      if (!s) throw new Error('not_found');
      s.status = status;
      return { ...s };
    },
    async remove(sid) {
      const i = db.studies.findIndex((x) => x.id === sid && x.tenantId === session.tenantId);
      if (i >= 0) db.studies.splice(i, 1);
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
