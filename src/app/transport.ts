/**
 * F3 — transport de rejeu concret : exécute une mutation hors-ligne contre les
 * repos applicatifs (mock ou Supabase). Ferme la boucle offline : capture →
 * file persistée → drainQueue(transport) au retour du réseau.
 * Le dispatch est par (entity, op). Une entité/op non gérée est un échec
 * DÉFINITIF (rejected) — pas de boucle infinie ; une erreur d'exécution est
 * RETRIABLE (le réseau réessaiera). Extensible : élargir le Pick et le switch.
 */
import type { OfflineTransport, PendingMutation, SettleResult } from '../domain/f3';
import type { DataApi } from './providers';
import type { RfiPriority } from '../domain/rfi/types';
import type { ReserveSeverity } from '../domain/m19/types';
import type { DocDiscipline } from '../domain/ged/types';
import type { SaleKind, ScheduleStage, ReceiptMethod } from '../domain/m6/types';
import type { TenureType } from '../domain/m2/foncier';
import type { StakeholderType } from '../domain/m2/types';
import type { RevisionTerm } from '../domain/f6/types';
import type { GuaranteeType } from '../domain/m17/types';
import type { ChangeOrigin } from '../domain/m14/types';
import type { RiskCategory } from '../domain/m20/types';
import type { UtilityType } from '../domain/m18/types';
import type { StudyKind } from '../domain/m3/types';
import type { HsseKind, HsseSeverity } from '../domain/hsse/types';
import type { DoeCategory } from '../domain/doe/types';
import type { AssetType } from '../domain/handoverAssets/types';
import type { BaselineTask } from '../domain/baseline/types';
import type { StructureType, Shareholder } from '../domain/legalEntity/types';
import type { ServiceOrderType } from '../domain/serviceOrder/types';
import type { Milieu, Severity } from '../domain/eiesItem/types';
import type { Incoterm } from '../domain/shipment/types';
import type { CriterionType } from '../domain/evaluationCriterion/types';
import { Money } from '../domain/money/Money';

type TransportDeps = Pick<DataApi, 'siteReports' | 'payments' | 'rfis' | 'reception' | 'purchasing' | 'documents' | 'commercialisation' | 'compliance' | 'revisions' | 'stakeholders' | 'financing' | 'guarantees' | 'changeOrders' | 'risks' | 'connections' | 'planning' | 'studies' | 'hsse' | 'disputes' | 'claims' | 'doe' | 'handoverAssets' | 'baselines' | 'legalEntities' | 'actionItems' | 'serviceOrders' | 'eiesItems' | 'shipments' | 'budgetLines' | 'evaluationCriteria' | 'offerScores' | 'pgesActions'>;

interface SiteReportCreatePayload {
  operationId: string;
  date: string;
  author: string;
  progress: number;
  summary: string;
  blockers: number;
}

interface DecompteCreatePayload {
  operationId: string;
  contractId: string;
  number: number;
  amountGross: number;
  retentionRate?: number;
}

interface RfiCreatePayload {
  operationId: string;
  number: string;
  subject: string;
  question: string;
  raisedBy: string;
  priority: RfiPriority;
  dueDate?: string | null;
  documentRef?: string | null;
}

interface ReserveCreatePayload {
  operationId: string;
  label: string;
  location: string;
  severity: ReserveSeverity;
  raisedAt: string;
}

interface PurchaseOrderCreatePayload {
  operationId: string;
  reference: string;
  supplier: string;
  item: string;
  quantity: number;
  unit: string;
  amount: number;
}

interface DocumentCreatePayload {
  operationId: string;
  reference: string;
  title: string;
  discipline: DocDiscipline;
  indice: string;
}

// M6 — les montants transitent en unités majeures + devise (JSON-safe : Money
// utilise des centimes bigint, non sérialisables) ; le transport reconstruit Money.
interface UnitCreatePayload {
  operationId: string;
  lotId?: string | null;
  typology: string;
  area: number;
  priceMajor: number;
  currency: string;
}

interface SaleCreatePayload {
  operationId: string;
  kind: SaleKind;
  unitId?: string | null;
  counterpart: string;
  amountMajor: number;
  currency: string;
  schedule?: ScheduleStage[];
}

// M8 — révision de prix : montants en unités majeures (JSON-safe), coefficient
// et montant révisé déjà calculés côté TS (F6 / Money.ts).
interface PriceRevisionCreatePayload {
  operationId: string;
  contractId: string;
  baseAmount: number;
  a0: number;
  terms: RevisionTerm[];
  coefficient: number;
  revisedAmount: number;
}

// M5 — déblocage (tranche) : le montant alimente les frais financiers du bilan.
interface DrawdownCreatePayload {
  financingId: string;
  amountMajor: number;
  currency: string;
  condition: number;
}

// M7 — intervenant : ses honoraires (feeAmount, number) alimentent le poste
// honoraires vérifié du bilan. JSON-safe (pas de Money).
interface StakeholderCreatePayload {
  operationId: string;
  type: StakeholderType;
  name: string;
  email?: string | null;
  phone?: string | null;
  mission?: string | null;
  feeAmount?: number;
}

// M6 — encaissement : montant en unités majeures + devise (Money reconstruit).
interface ReceiptCreatePayload {
  saleId: string;
  amountMajor: number;
  currency: string;
  method: ReceiptMethod;
  reference?: string | null;
}

// M20 (actifs) — actif d'inventaire de transfert (non écriture).
interface HandoverAssetCreatePayload {
  operationId: string;
  label: string;
  assetType: AssetType;
  location?: string | null;
  warrantyEnd?: string | null;
  targetSystem?: string | null;
}

// M20 (DOE) — pièce du dossier des ouvrages exécutés (non écriture), non validée.
interface DoeCreatePayload {
  operationId: string;
  category: DoeCategory;
  fileRef?: string | null;
}

// M12 (planning) — capture d'une baseline (non écriture) : instantané figé des
// tâches (JSON-safe), rejouable tel quel ; devient la baseline active.
interface BaselineCreatePayload {
  operationId: string;
  label: string;
  snapshot: BaselineTask[];
}

// M19 (PGES) — action E&S relevée hors-ligne (non écriture) : créée « ouvert ».
interface PgesActionCreatePayload {
  operationId: string;
  action: string;
  responsable: string;
  echeance?: string | null;
  indicateur?: string | null;
}

// M23 — note d'offre (non écriture) : upsert idempotent (rejouable), JSON-safe.
interface OfferScoreCreatePayload {
  operationId: string;
  offerId: string;
  criteriaId: string;
  rawScore: number;
  weightedScore: number;
}

// M23 — critère d'évaluation (non écriture) : poids fraction 0..1 (JSON-safe).
interface EvaluationCriterionCreatePayload {
  operationId: string;
  label: string;
  type: CriterionType;
  weight: number;
}

// M4/M5 — ligne budgétaire (écriture financière) saisie en brouillon hors-ligne ;
// montant `number` (unités majeures, JSON-safe).
interface BudgetLineCreatePayload {
  operationId: string;
  syscohadaAccount: string;
  label: string;
  amountBac: number;
}

// M9 (logistique) — expédition enregistrée hors-ligne (non écriture) : « en_attente ».
interface ShipmentCreatePayload {
  operationId: string;
  reference: string;
  poId?: string | null;
  incoterm?: Incoterm | null;
  eta?: string | null;
}

// M19 (E&S) — impact EIES relevé hors-ligne (non écriture) : créé « planifiee ».
interface EiesItemCreatePayload {
  operationId: string;
  impact: string;
  milieu: Milieu;
  severity: Severity;
  mesureAttenuation?: string | null;
}

// M13/M15 — ordre de service rédigé hors-ligne (non écriture) : créé « projet ».
interface ServiceOrderCreatePayload {
  operationId: string;
  type: ServiceOrderType;
  reference: string;
  content: string;
  contractId?: string | null;
}

// M13 (pilotage) — action relevée sur le terrain (non écriture) : créée « ouvert ».
interface ActionItemCreatePayload {
  operationId: string;
  description: string;
  owner: string;
  dueDate: string;
  siteReportId?: string | null;
}

// M2 (montage juridique) — structure de portage (non écriture) : créée « projet » ;
// répartition du capital JSON-safe.
interface LegalEntityCreatePayload {
  operationId: string;
  structureType: StructureType;
  name: string;
  rccm?: string | null;
  shareholders?: Shareholder[];
}

// M19 (sinistres) — déclaration d'assurance (non écriture) : créée « déclaré » ;
// montant `number` (unités majeures, JSON-safe).
interface ClaimCreatePayload {
  operationId: string;
  event: string;
  amount: number;
  insuranceId?: string | null;
}

// M19 (litiges) — litige (suivi, non écriture) : créé « ouvert » ; montant en
// jeu `number` (unités majeures, JSON-safe, pas de Money).
interface DisputeCreatePayload {
  operationId: string;
  counterpart: string;
  object: string;
  amountAtStake: number;
  fileRef?: string | null;
}

// M19 (HSSE) — incident terrain (fait, non écriture) : créé « déclaré » ;
// payload JSON-safe (dates ISO, énumérés).
interface HsseCreatePayload {
  operationId: string;
  reference: string;
  kind: HsseKind;
  severity: HsseSeverity;
  occurredAt: string;
  location?: string | null;
  description: string;
  correctiveAction?: string | null;
}

// M3 — étude amont (diagnostic, non écriture) : créée « planifiée » ;
// coût `number` (unités majeures, JSON-safe, pas de Money).
interface StudyCreatePayload {
  operationId: string;
  kind: StudyKind;
  provider: string;
  cost: number;
  dueDate?: string | null;
  summary?: string | null;
}

// M12 — tâche de planning (jalon/ligne de temps, non écriture) : payload
// JSON-safe (dates ISO, progression 0..1, drapeaux booléens).
interface TaskCreatePayload {
  operationId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isMilestone?: boolean;
  isCritical?: boolean;
  progress?: number;
}

// M18 — demande de raccordement concessionnaire : créée « demande », suivi
// (non écriture) ; coût `number` (unités majeures, JSON-safe, pas de Money).
interface ConnectionCreatePayload {
  operationId: string;
  utility: UtilityType;
  concessionaire: string;
  reference: string;
  cost: number;
  requestedAt: string;
}

// M20 — risque (registre, dont HSSE) : créé « ouvert », non financier.
// Probabilité/impact 1..5 ; payload JSON-safe (pas de Money).
interface RiskCreatePayload {
  operationId: string;
  code: string;
  label: string;
  category: RiskCategory;
  probability: number;
  impact: number;
  mitigation?: string | null;
}

// M14 — demande de modification (change order) : créée « requested » (§4),
// sans montant (l'impact est instruit en ligne). Payload JSON-safe.
interface ChangeOrderCreatePayload {
  operationId: string;
  contractId: string;
  origin: ChangeOrigin;
  description: string;
}

// M17 — caution/garantie : montant `number` (JSON-safe, pas de Money) ;
// document (non écriture), donc rejouable tel quel.
interface GuaranteeCreatePayload {
  operationId: string;
  type: GuaranteeType;
  issuer: string;
  amount: number;
  validFrom: string;
  validUntil?: string | null;
}

// M2 — la parcelle porte un prix `number` (déjà JSON-safe, pas de Money).
interface LandParcelCreatePayload {
  operationId: string;
  reference: string;
  area: number;
  tenureType: TenureType;
  price: number;
  notary?: string | null;
  suspensiveConditions?: string[];
}

async function dispatch(api: TransportDeps, m: PendingMutation): Promise<SettleResult> {
  if (m.entity === 'siteReports' && m.op === 'create') {
    const p = m.payload as unknown as SiteReportCreatePayload;
    const __rec = await api.siteReports.add(p.operationId, {
      date: p.date, author: p.author, progress: p.progress, summary: p.summary, blockers: p.blockers,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M15 — un décompte capturé hors-ligne est nécessairement un brouillon (§4) ;
  // sa création (statut draft par construction) est rejouable. Les transitions
  // sensibles (validation/mandatement) restent en ligne (Edge Functions gardées).
  if (m.entity === 'decomptes' && m.op === 'create') {
    const p = m.payload as unknown as DecompteCreatePayload;
    const __rec = await api.payments.addDecompte(p.operationId, {
      contractId: p.contractId, number: p.number, amountGross: p.amountGross, retentionRate: p.retentionRate,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M11 — RFI (collaboration terrain), non financier : rejouable tel quel.
  if (m.entity === 'rfis' && m.op === 'create') {
    const p = m.payload as unknown as RfiCreatePayload;
    const __rec = await api.rfis.add(p.operationId, {
      number: p.number, subject: p.subject, question: p.question, raisedBy: p.raisedBy,
      priority: p.priority, dueDate: p.dueDate ?? null, documentRef: p.documentRef ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 — réserve de réception, non financière : rejouable tel quel.
  if (m.entity === 'reserves' && m.op === 'create') {
    const p = m.payload as unknown as ReserveCreatePayload;
    const __rec = await api.reception.addReserve(p.operationId, {
      label: p.label, location: p.location, severity: p.severity, raisedAt: p.raisedAt,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M9 — bon d'achat capturé hors-ligne = brouillon (§4) ; sa création est
  // rejouable. L'engagement (passage hors brouillon) reste en ligne.
  if (m.entity === 'purchaseOrders' && m.op === 'create') {
    const p = m.payload as unknown as PurchaseOrderCreatePayload;
    const __rec = await api.purchasing.add(p.operationId, {
      reference: p.reference, supplier: p.supplier, item: p.item, quantity: p.quantity, unit: p.unit, amount: p.amount,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M10 — document GED (non financier) : rejouable tel quel.
  if (m.entity === 'documents' && m.op === 'create') {
    const p = m.payload as unknown as DocumentCreatePayload;
    const __rec = await api.documents.add(p.operationId, {
      reference: p.reference, title: p.title, discipline: p.discipline, indice: p.indice,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M6 — unité (inventaire physique, non financier).
  if (m.entity === 'units' && m.op === 'create') {
    const p = m.payload as unknown as UnitCreatePayload;
    const __rec = await api.commercialisation.addUnit(p.operationId, {
      lotId: p.lotId ?? null, typology: p.typology, area: p.area, price: Money.of(p.priceMajor, p.currency),
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M6 — vente/bail capturée hors-ligne = brouillon (§4) ; création rejouable.
  if (m.entity === 'sales' && m.op === 'create') {
    const p = m.payload as unknown as SaleCreatePayload;
    const __rec = await api.commercialisation.addSale(p.operationId, {
      kind: p.kind, unitId: p.unitId ?? null, counterpart: p.counterpart,
      amount: Money.of(p.amountMajor, p.currency), schedule: p.schedule ?? [],
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M2 — parcelle foncière (montage juridique) créée en « prospection », rejouable.
  if (m.entity === 'landParcels' && m.op === 'create') {
    const p = m.payload as unknown as LandParcelCreatePayload;
    const __rec = await api.compliance.addLandParcel(p.operationId, {
      reference: p.reference, area: p.area, tenureType: p.tenureType, price: p.price,
      notary: p.notary ?? null, suspensiveConditions: p.suspensiveConditions ?? [],
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M8 — révision de prix (v4.1). Coefficient/montant révisé calculés en TS (F6).
  if (m.entity === 'priceRevisions' && m.op === 'create') {
    const p = m.payload as unknown as PriceRevisionCreatePayload;
    const __rec = await api.revisions.add(p.operationId, {
      contractId: p.contractId, baseAmount: p.baseAmount, a0: p.a0, terms: p.terms,
      coefficient: p.coefficient, revisedAmount: p.revisedAmount,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M7 — intervenant (alimente le poste honoraires du bilan).
  if (m.entity === 'stakeholders' && m.op === 'create') {
    const p = m.payload as unknown as StakeholderCreatePayload;
    const __rec = await api.stakeholders.add(p.operationId, {
      type: p.type, name: p.name, email: p.email ?? null, phone: p.phone ?? null,
      mission: p.mission ?? null, feeAmount: p.feeAmount ?? 0,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M6 — encaissement d'une vente (recette ; imputation « settled » en ligne).
  if (m.entity === 'receipts' && m.op === 'create') {
    const p = m.payload as unknown as ReceiptCreatePayload;
    const __rec = await api.commercialisation.addReceipt(p.saleId, { amount: Money.of(p.amountMajor, p.currency), method: p.method, reference: p.reference ?? null });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M5 — déblocage d'une tranche de financement (alimente les frais financiers).
  if (m.entity === 'drawdowns' && m.op === 'create') {
    const p = m.payload as unknown as DrawdownCreatePayload;
    const __rec = await api.financing.addDrawdown(p.financingId, { amount: Money.of(p.amountMajor, p.currency), condition: p.condition });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M20 (actifs) — inventaire relevé hors-ligne : rejouable tel quel.
  if (m.entity === 'handoverAssets' && m.op === 'create') {
    const p = m.payload as unknown as HandoverAssetCreatePayload;
    const __rec = await api.handoverAssets.add(p.operationId, {
      label: p.label, assetType: p.assetType, location: p.location ?? null,
      warrantyEnd: p.warrantyEnd ?? null, targetSystem: p.targetSystem ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M20 (DOE) — pièce collectée hors-ligne (non validée) : rejouable telle quelle.
  if (m.entity === 'doeDocuments' && m.op === 'create') {
    const p = m.payload as unknown as DoeCreatePayload;
    const __rec = await api.doe.add(p.operationId, { category: p.category, fileRef: p.fileRef ?? null });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M12 (planning) — capture de baseline hors-ligne : rejouable telle quelle.
  if (m.entity === 'baselines' && m.op === 'create') {
    const p = m.payload as unknown as BaselineCreatePayload;
    const __rec = await api.baselines.add(p.operationId, { label: p.label, snapshot: p.snapshot });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 (PGES) — action E&S créée « ouvert » : rejouable telle quelle.
  if (m.entity === 'pgesActions' && m.op === 'create') {
    const p = m.payload as unknown as PgesActionCreatePayload;
    const __rec = await api.pgesActions.add(p.operationId, {
      action: p.action, responsable: p.responsable, echeance: p.echeance ?? null, indicateur: p.indicateur ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M23 — note d'offre saisie hors-ligne : upsert idempotent, rejouable tel quel.
  if (m.entity === 'offerScores' && m.op === 'create') {
    const p = m.payload as unknown as OfferScoreCreatePayload;
    const __rec = await api.offerScores.setScore(p.operationId, {
      offerId: p.offerId, criteriaId: p.criteriaId, rawScore: p.rawScore, weightedScore: p.weightedScore,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M23 — critère d'évaluation créé hors-ligne : rejouable tel quel.
  if (m.entity === 'evaluationCriteria' && m.op === 'create') {
    const p = m.payload as unknown as EvaluationCriterionCreatePayload;
    const __rec = await api.evaluationCriteria.add(p.operationId, { label: p.label, type: p.type, weight: p.weight });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M4/M5 — ligne budgétaire (brouillon financier hors-ligne) : rejouable telle quelle.
  if (m.entity === 'budgetLines' && m.op === 'create') {
    const p = m.payload as unknown as BudgetLineCreatePayload;
    const __rec = await api.budgetLines.add(p.operationId, {
      syscohadaAccount: p.syscohadaAccount, label: p.label, amountBac: p.amountBac,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M9 (logistique) — expédition créée « en_attente » : rejouable telle quelle.
  if (m.entity === 'shipments' && m.op === 'create') {
    const p = m.payload as unknown as ShipmentCreatePayload;
    const __rec = await api.shipments.add(p.operationId, {
      reference: p.reference, poId: p.poId ?? null, incoterm: p.incoterm ?? null, eta: p.eta ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 (E&S) — impact EIES créé « planifiee » : rejouable tel quel.
  if (m.entity === 'eiesItems' && m.op === 'create') {
    const p = m.payload as unknown as EiesItemCreatePayload;
    const __rec = await api.eiesItems.add(p.operationId, {
      impact: p.impact, milieu: p.milieu, severity: p.severity, mesureAttenuation: p.mesureAttenuation ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M13/M15 — OS rédigé « projet » : rejouable tel quel (notification hors-ligne).
  if (m.entity === 'serviceOrders' && m.op === 'create') {
    const p = m.payload as unknown as ServiceOrderCreatePayload;
    const __rec = await api.serviceOrders.add(p.operationId, {
      type: p.type, reference: p.reference, content: p.content, contractId: p.contractId ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M13 (pilotage) — action créée « ouvert » : rejouable telle quelle.
  if (m.entity === 'actionItems' && m.op === 'create') {
    const p = m.payload as unknown as ActionItemCreatePayload;
    const __rec = await api.actionItems.add(p.operationId, {
      description: p.description, owner: p.owner, dueDate: p.dueDate, siteReportId: p.siteReportId ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M2 (montage juridique) — structure créée « projet » : rejouable telle quelle.
  if (m.entity === 'legalEntities' && m.op === 'create') {
    const p = m.payload as unknown as LegalEntityCreatePayload;
    const __rec = await api.legalEntities.add(p.operationId, {
      structureType: p.structureType, name: p.name, rccm: p.rccm ?? null, shareholders: p.shareholders ?? [],
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 (sinistres) — déclaration créée « déclaré » : rejouable telle quelle.
  if (m.entity === 'claims' && m.op === 'create') {
    const p = m.payload as unknown as ClaimCreatePayload;
    const __rec = await api.claims.add(p.operationId, { event: p.event, amount: p.amount, insuranceId: p.insuranceId ?? null });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 (litiges) — litige créé « ouvert » : rejouable tel quel.
  if (m.entity === 'disputes' && m.op === 'create') {
    const p = m.payload as unknown as DisputeCreatePayload;
    const __rec = await api.disputes.add(p.operationId, {
      counterpart: p.counterpart, object: p.object, amountAtStake: p.amountAtStake, fileRef: p.fileRef ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M19 (HSSE) — incident terrain créé « déclaré » : rejouable tel quel.
  if (m.entity === 'hsseIncidents' && m.op === 'create') {
    const p = m.payload as unknown as HsseCreatePayload;
    const __rec = await api.hsse.add(p.operationId, {
      reference: p.reference, kind: p.kind, severity: p.severity, occurredAt: p.occurredAt,
      location: p.location ?? null, description: p.description, correctiveAction: p.correctiveAction ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M3 — étude amont (diagnostic, non écriture) créée « planifiée » : rejouable.
  if (m.entity === 'studies' && m.op === 'create') {
    const p = m.payload as unknown as StudyCreatePayload;
    const __rec = await api.studies.add(p.operationId, {
      kind: p.kind, provider: p.provider, cost: p.cost,
      dueDate: p.dueDate ?? null, summary: p.summary ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M12 — tâche de planning (jalon/ligne de temps, non écriture) : rejouable.
  if (m.entity === 'tasks' && m.op === 'create') {
    const p = m.payload as unknown as TaskCreatePayload;
    const __rec = await api.planning.add(p.operationId, {
      name: p.name, startDate: p.startDate ?? null, endDate: p.endDate ?? null,
      isMilestone: p.isMilestone ?? false, isCritical: p.isCritical ?? false, progress: p.progress ?? 0,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M18 — demande de raccordement (créée « demande ») : rejouable tel quel.
  // Le paiement du devis (« payé ») reste une transition en ligne.
  if (m.entity === 'connections' && m.op === 'create') {
    const p = m.payload as unknown as ConnectionCreatePayload;
    const __rec = await api.connections.add(p.operationId, {
      utility: p.utility, concessionaire: p.concessionaire, reference: p.reference,
      cost: p.cost, requestedAt: p.requestedAt,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M20 — risque (registre, dont HSSE) créé « ouvert » : rejouable tel quel.
  if (m.entity === 'risks' && m.op === 'create') {
    const p = m.payload as unknown as RiskCreatePayload;
    const __rec = await api.risks.add(p.operationId, {
      code: p.code, label: p.label, category: p.category,
      probability: p.probability, impact: p.impact, mitigation: p.mitigation ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M14 — demande de modification (créée « requested ») : rejouable tel quel.
  // L'instruction d'impact et l'arbitrage (rôle-gardés) restent en ligne.
  if (m.entity === 'changeOrders' && m.op === 'create') {
    const p = m.payload as unknown as ChangeOrderCreatePayload;
    const __rec = await api.changeOrders.add(p.operationId, {
      contractId: p.contractId, origin: p.origin, description: p.description,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  // M17 — caution/garantie (document, non écriture) : rejouable tel quel.
  if (m.entity === 'guarantees' && m.op === 'create') {
    const p = m.payload as unknown as GuaranteeCreatePayload;
    const __rec = await api.guarantees.add(p.operationId, {
      type: p.type, issuer: p.issuer, amount: p.amount, validFrom: p.validFrom, validUntil: p.validUntil ?? null,
    });
    return { ok: true, serverId: (__rec as { id?: string } | undefined)?.id };
  }
  return { ok: false, retriable: false, error: `unsupported:${m.entity}.${m.op}` };
}

export function createRepoTransport(api: TransportDeps): OfflineTransport {
  return async (m) => {
    try {
      return await dispatch(api, m);
    } catch (e) {
      // Erreur d'exécution (réseau, indisponibilité) → retriable.
      return { ok: false, retriable: true, error: e instanceof Error ? e.message : 'transport_error' };
    }
  };
}
