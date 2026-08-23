import { t, type MessageKey } from '../../i18n';
import { getCountry } from '../../domain/country';
import { posteKey } from '../../domain/finance/postes';
import type { OpType, OperationStatus, Phase, ProgramCategory } from '../../domain/m1/types';
import type { StakeholderType } from '../../domain/m2/types';
import type { AuthorizationType, AuthorizationStatus } from '../../domain/m2/authorizations';
import type { DueDiligenceCategory, DueDiligenceSeverity, DueDiligenceStatus } from '../../domain/m2/dueDiligence';
import type { InsuranceType, InsuranceStatus, Raci, DecisionKind } from '../../domain/m7/types';
import type { TenureType, AcquisitionStatus, TitleDocType, TitleDocStatus } from '../../domain/m2/foncier';
import type { FinancingSource, FinancingStatus, DrawdownStatus } from '../../domain/m5/types';
import type { UnitStatus, SaleKind, SaleStatus, ReceiptStatus } from '../../domain/m6/types';
import type { DecompteStatus } from '../../domain/payments/types';
import type { TenderStatus, TenderProcedure, TenderMode } from '../../domain/m8/types';
import type { StudyKind, StudyStatus } from '../../domain/m3/types';

const PHASE_KEY: Record<Phase, MessageKey> = {
  amont: 'operation.phase.amont',
  conception: 'operation.phase.conception',
  passation: 'operation.phase.passation',
  realisation: 'operation.phase.realisation',
  reception: 'operation.phase.reception',
  exploitation: 'operation.phase.exploitation',
  cloture: 'operation.phase.cloture',
};

const OPTYPE_KEY: Record<OpType, MessageKey> = {
  residential: 'operation.type.residential',
  commercial: 'operation.type.commercial',
  public: 'operation.type.public',
  mixed: 'operation.type.mixed',
};

const STATUS_KEY: Record<OperationStatus, MessageKey> = {
  active: 'operation.status.active',
  paused: 'operation.status.paused',
  closed: 'operation.status.closed',
};

const CATEGORY_KEY: Record<ProgramCategory, MessageKey> = {
  surface: 'program.category.surface',
  usage: 'program.category.usage',
  exigence_fonctionnelle: 'program.category.exigence_fonctionnelle',
  exigence_technique: 'program.category.exigence_technique',
  exigence_env: 'program.category.exigence_env',
};

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'warning';

export const PHASE_TONE: Record<Phase, BadgeTone> = {
  amont: 'neutral',
  conception: 'info',
  passation: 'warning',
  realisation: 'accent',
  reception: 'info',
  exploitation: 'success',
  cloture: 'neutral',
};

export const STATUS_TONE: Record<OperationStatus, BadgeTone> = {
  active: 'success',
  paused: 'warning',
  closed: 'neutral',
};

export const phaseLabel = (p: Phase) => t(PHASE_KEY[p]);
export const opTypeLabel = (o: OpType) => t(OPTYPE_KEY[o]);
export const statusLabel = (s: OperationStatus) => t(STATUS_KEY[s]);
export const categoryLabel = (c: ProgramCategory) => t(CATEGORY_KEY[c]);
export const posteLabel = (p: string) => t(posteKey(p));

const STK_KEY: Record<StakeholderType, MessageKey> = {
  moe: 'stk.type.moe',
  amo: 'stk.type.amo',
  bet: 'stk.type.bet',
  ct: 'stk.type.ct',
  csps: 'stk.type.csps',
  notaire: 'stk.type.notaire',
  banque: 'stk.type.banque',
  assureur: 'stk.type.assureur',
  entreprise: 'stk.type.entreprise',
  concessionnaire: 'stk.type.concessionnaire',
  exploitant: 'stk.type.exploitant',
  admin: 'stk.type.admin',
};
export const stakeholderTypeLabel = (s: StakeholderType) => t(STK_KEY[s]);

// ── Gouvernance M7 : RACI & registre des décisions ───────────────────────────
const RACI_KEY: Record<Raci, MessageKey> = {
  R: 'raci.R',
  A: 'raci.A',
  C: 'raci.C',
  I: 'raci.I',
};
export const RACI_TONE: Record<Raci, BadgeTone> = {
  R: 'info',
  A: 'accent',
  C: 'neutral',
  I: 'neutral',
};
export const raciLabel = (r: Raci) => t(RACI_KEY[r]);

const DECISION_KIND_KEY: Record<DecisionKind, MessageKey> = {
  decision: 'decision.kind.decision',
  courrier: 'decision.kind.courrier',
  OS: 'decision.kind.OS',
  CR_reunion: 'decision.kind.CR_reunion',
};
export const decisionKindLabel = (k: DecisionKind) => t(DECISION_KIND_KEY[k]);

const DECOMPTE_KEY: Record<DecompteStatus, MessageKey> = {
  draft: 'decompte.status.draft',
  validated: 'decompte.status.validated',
  mandated: 'decompte.status.mandated',
  paid: 'decompte.status.paid',
};
export const DECOMPTE_TONE: Record<DecompteStatus, BadgeTone> = {
  draft: 'neutral',
  validated: 'info',
  mandated: 'warning',
  paid: 'success',
};
export const decompteStatusLabel = (s: DecompteStatus) => t(DECOMPTE_KEY[s]);

const TENDER_KEY: Record<TenderStatus, MessageKey> = {
  planned: 'tender.status.planned',
  published: 'tender.status.published',
  opened: 'tender.status.opened',
  evaluated: 'tender.status.evaluated',
  awarded: 'tender.status.awarded',
  notified: 'tender.status.notified',
};
export const TENDER_TONE: Record<TenderStatus, BadgeTone> = {
  planned: 'neutral',
  published: 'info',
  opened: 'info',
  evaluated: 'warning',
  awarded: 'accent',
  notified: 'success',
};
export const tenderStatusLabel = (s: TenderStatus) => t(TENDER_KEY[s]);
export const tenderModeLabel = (m: TenderMode) => t(m === 'public' ? 'mode.public' : 'mode.private');
export const tenderProcedureLabel = (p: TenderProcedure) => t(`proc.${p}` as MessageKey);
export const countryLabel = (code: string) => {
  const c = getCountry(code);
  return c ? t(c.nameKey as MessageKey) : code;
};

// ── Conformité & gardes M1 (M2 autorisations/DD, M7 assurances) ──────────────
const AUTH_TYPE_KEY: Record<AuthorizationType, MessageKey> = {
  permis_construire: 'auth.type.permis_construire',
  autorisation_env: 'auth.type.autorisation_env',
  conformite: 'auth.type.conformite',
};
const AUTH_STATUS_KEY: Record<AuthorizationStatus, MessageKey> = {
  draft: 'auth.status.draft',
  submitted: 'auth.status.submitted',
  granted: 'auth.status.granted',
  refused: 'auth.status.refused',
};
export const AUTH_STATUS_TONE: Record<AuthorizationStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  granted: 'success',
  refused: 'danger',
};
export const authorizationTypeLabel = (a: AuthorizationType) => t(AUTH_TYPE_KEY[a]);
export const authorizationStatusLabel = (s: AuthorizationStatus) => t(AUTH_STATUS_KEY[s]);

const INS_TYPE_KEY: Record<InsuranceType, MessageKey> = {
  DO: 'ins.type.DO',
  decennale: 'ins.type.decennale',
  RC: 'ins.type.RC',
  TRC: 'ins.type.TRC',
  RC_pro: 'ins.type.RC_pro',
};
const INS_STATUS_KEY: Record<InsuranceStatus, MessageKey> = {
  valid: 'ins.status.valid',
  expiring: 'ins.status.expiring',
  expired: 'ins.status.expired',
  missing: 'ins.status.missing',
};
export const INS_STATUS_TONE: Record<InsuranceStatus, BadgeTone> = {
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
  missing: 'neutral',
};
export const insuranceTypeLabel = (i: InsuranceType) => t(INS_TYPE_KEY[i]);
export const insuranceStatusLabel = (s: InsuranceStatus) => t(INS_STATUS_KEY[s]);

const DD_CAT_KEY: Record<DueDiligenceCategory, MessageKey> = {
  servitude: 'dd.cat.servitude',
  litige: 'dd.cat.litige',
  hypotheque: 'dd.cat.hypotheque',
  bornage: 'dd.cat.bornage',
  conformite: 'dd.cat.conformite',
};
const DD_SEV_KEY: Record<DueDiligenceSeverity, MessageKey> = {
  low: 'dd.sev.low',
  medium: 'dd.sev.medium',
  high: 'dd.sev.high',
  critical: 'dd.sev.critical',
};
export const DD_SEV_TONE: Record<DueDiligenceSeverity, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};
const DD_STATUS_KEY: Record<DueDiligenceStatus, MessageKey> = {
  open: 'dd.status.open',
  cleared: 'dd.status.cleared',
};
export const ddCategoryLabel = (c: DueDiligenceCategory) => t(DD_CAT_KEY[c]);
export const ddSeverityLabel = (s: DueDiligenceSeverity) => t(DD_SEV_KEY[s]);
export const ddStatusLabel = (s: DueDiligenceStatus) => t(DD_STATUS_KEY[s]);

// ── Foncier (M2 dossier foncier) ─────────────────────────────────────────────
const TENURE_KEY: Record<TenureType, MessageKey> = {
  titre_foncier: 'parcel.tenure.titre_foncier',
  bail_emphyteotique: 'parcel.tenure.bail_emphyteotique',
  droit_coutumier: 'parcel.tenure.droit_coutumier',
  concession: 'parcel.tenure.concession',
};
const ACQ_KEY: Record<AcquisitionStatus, MessageKey> = {
  prospection: 'parcel.acq.prospection',
  sous_promesse: 'parcel.acq.sous_promesse',
  conditions_levees: 'parcel.acq.conditions_levees',
  acquis: 'parcel.acq.acquis',
};
export const ACQ_TONE: Record<AcquisitionStatus, BadgeTone> = {
  prospection: 'neutral',
  sous_promesse: 'info',
  conditions_levees: 'warning',
  acquis: 'success',
};
const TITLE_TYPE_KEY: Record<TitleDocType, MessageKey> = {
  titre_foncier: 'title.type.titre_foncier',
  acte_notarie: 'title.type.acte_notarie',
  certificat: 'title.type.certificat',
  bornage: 'title.type.bornage',
};
const TITLE_STATUS_KEY: Record<TitleDocStatus, MessageKey> = {
  pending: 'title.status.pending',
  verified: 'title.status.verified',
};
export const TITLE_STATUS_TONE: Record<TitleDocStatus, BadgeTone> = {
  pending: 'neutral',
  verified: 'success',
};
export const tenureLabel = (tdoc: TenureType) => t(TENURE_KEY[tdoc]);
export const acquisitionStatusLabel = (s: AcquisitionStatus) => t(ACQ_KEY[s]);
export const titleDocTypeLabel = (tdoc: TitleDocType) => t(TITLE_TYPE_KEY[tdoc]);
export const titleStatusLabel = (s: TitleDocStatus) => t(TITLE_STATUS_KEY[s]);

// ── Financement (M5) ─────────────────────────────────────────────────────────
const FIN_SOURCE_KEY: Record<FinancingSource, MessageKey> = {
  credit_promoteur: 'fin.source.credit_promoteur',
  bailleur: 'fin.source.bailleur',
  fonds_propres: 'fin.source.fonds_propres',
};
const FIN_STATUS_KEY: Record<FinancingStatus, MessageKey> = {
  negocie: 'fin.status.negocie',
  accorde: 'fin.status.accorde',
  en_cours: 'fin.status.en_cours',
  solde: 'fin.status.solde',
};
export const FIN_STATUS_TONE: Record<FinancingStatus, BadgeTone> = {
  negocie: 'neutral',
  accorde: 'info',
  en_cours: 'accent',
  solde: 'success',
};
const DRAWDOWN_STATUS_KEY: Record<DrawdownStatus, MessageKey> = {
  planifie: 'draw.status.planifie',
  demande: 'draw.status.demande',
  debloque: 'draw.status.debloque',
  refuse: 'draw.status.refuse',
};
export const DRAWDOWN_STATUS_TONE: Record<DrawdownStatus, BadgeTone> = {
  planifie: 'neutral',
  demande: 'info',
  debloque: 'success',
  refuse: 'danger',
};
export const financingSourceLabel = (s: FinancingSource) => t(FIN_SOURCE_KEY[s]);
export const financingStatusLabel = (s: FinancingStatus) => t(FIN_STATUS_KEY[s]);
export const drawdownStatusLabel = (s: DrawdownStatus) => t(DRAWDOWN_STATUS_KEY[s]);

// ── Commercialisation (M6) ───────────────────────────────────────────────────
const UNIT_STATUS_KEY: Record<UnitStatus, MessageKey> = {
  disponible: 'unit.status.disponible',
  optionne: 'unit.status.optionne',
  reserve: 'unit.status.reserve',
  vendu: 'unit.status.vendu',
  loue: 'unit.status.loue',
};
export const UNIT_STATUS_TONE: Record<UnitStatus, BadgeTone> = {
  disponible: 'neutral',
  optionne: 'info',
  reserve: 'warning',
  vendu: 'success',
  loue: 'accent',
};
const SALE_KIND_KEY: Record<SaleKind, MessageKey> = {
  reservation: 'sale.kind.reservation',
  lease: 'sale.kind.lease',
};
const SALE_STATUS_KEY: Record<SaleStatus, MessageKey> = {
  draft: 'sale.status.draft',
  active: 'sale.status.active',
  soldee: 'sale.status.soldee',
  resiliee: 'sale.status.resiliee',
};
export const SALE_STATUS_TONE: Record<SaleStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'accent',
  soldee: 'success',
  resiliee: 'danger',
};
const RECEIPT_STATUS_KEY: Record<ReceiptStatus, MessageKey> = {
  pending: 'receipt.status.pending',
  settled: 'receipt.status.settled',
};
export const RECEIPT_STATUS_TONE: Record<ReceiptStatus, BadgeTone> = {
  pending: 'neutral',
  settled: 'success',
};
// ── Études amont (M3) ────────────────────────────────────────────────────────
const STUDY_KIND_KEY: Record<StudyKind, MessageKey> = {
  geotechnique: 'study.kind.geotechnique',
  environnementale: 'study.kind.environnementale',
  programmatique: 'study.kind.programmatique',
  topographique: 'study.kind.topographique',
  hydraulique: 'study.kind.hydraulique',
  autre: 'study.kind.autre',
};
const STUDY_STATUS_KEY: Record<StudyStatus, MessageKey> = {
  planifiee: 'study.status.planifiee',
  en_cours: 'study.status.en_cours',
  remise: 'study.status.remise',
  validee: 'study.status.validee',
};
export const STUDY_STATUS_TONE: Record<StudyStatus, BadgeTone> = {
  planifiee: 'neutral',
  en_cours: 'info',
  remise: 'warning',
  validee: 'success',
};
export const studyKindLabel = (k: StudyKind) => t(STUDY_KIND_KEY[k]);
export const studyStatusLabel = (s: StudyStatus) => t(STUDY_STATUS_KEY[s]);

export const unitStatusLabel = (s: UnitStatus) => t(UNIT_STATUS_KEY[s]);
export const saleKindLabel = (k: SaleKind) => t(SALE_KIND_KEY[k]);
export const saleStatusLabel = (s: SaleStatus) => t(SALE_STATUS_KEY[s]);
export const receiptStatusLabel = (s: ReceiptStatus) => t(RECEIPT_STATUS_KEY[s]);
