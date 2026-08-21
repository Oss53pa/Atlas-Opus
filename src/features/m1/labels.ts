import { t, type MessageKey } from '../../i18n';
import { getCountry } from '../../domain/country';
import { posteKey } from '../../domain/finance/postes';
import type { OpType, OperationStatus, Phase, ProgramCategory } from '../../domain/m1/types';
import type { StakeholderType } from '../../domain/m2/types';
import type { DecompteStatus } from '../../domain/payments/types';
import type { TenderStatus, TenderProcedure, TenderMode } from '../../domain/m8/types';

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
