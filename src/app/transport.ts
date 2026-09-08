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
import type { SaleKind, ScheduleStage } from '../domain/m6/types';
import type { TenureType } from '../domain/m2/foncier';
import type { RevisionTerm } from '../domain/f6/types';
import { Money } from '../domain/money/Money';

type TransportDeps = Pick<DataApi, 'siteReports' | 'payments' | 'rfis' | 'reception' | 'purchasing' | 'documents' | 'commercialisation' | 'compliance' | 'revisions'>;

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
    await api.siteReports.add(p.operationId, {
      date: p.date, author: p.author, progress: p.progress, summary: p.summary, blockers: p.blockers,
    });
    return { ok: true };
  }
  // M15 — un décompte capturé hors-ligne est nécessairement un brouillon (§4) ;
  // sa création (statut draft par construction) est rejouable. Les transitions
  // sensibles (validation/mandatement) restent en ligne (Edge Functions gardées).
  if (m.entity === 'decomptes' && m.op === 'create') {
    const p = m.payload as unknown as DecompteCreatePayload;
    await api.payments.addDecompte(p.operationId, {
      contractId: p.contractId, number: p.number, amountGross: p.amountGross, retentionRate: p.retentionRate,
    });
    return { ok: true };
  }
  // M11 — RFI (collaboration terrain), non financier : rejouable tel quel.
  if (m.entity === 'rfis' && m.op === 'create') {
    const p = m.payload as unknown as RfiCreatePayload;
    await api.rfis.add(p.operationId, {
      number: p.number, subject: p.subject, question: p.question, raisedBy: p.raisedBy,
      priority: p.priority, dueDate: p.dueDate ?? null, documentRef: p.documentRef ?? null,
    });
    return { ok: true };
  }
  // M19 — réserve de réception, non financière : rejouable tel quel.
  if (m.entity === 'reserves' && m.op === 'create') {
    const p = m.payload as unknown as ReserveCreatePayload;
    await api.reception.addReserve(p.operationId, {
      label: p.label, location: p.location, severity: p.severity, raisedAt: p.raisedAt,
    });
    return { ok: true };
  }
  // M9 — bon d'achat capturé hors-ligne = brouillon (§4) ; sa création est
  // rejouable. L'engagement (passage hors brouillon) reste en ligne.
  if (m.entity === 'purchaseOrders' && m.op === 'create') {
    const p = m.payload as unknown as PurchaseOrderCreatePayload;
    await api.purchasing.add(p.operationId, {
      reference: p.reference, supplier: p.supplier, item: p.item, quantity: p.quantity, unit: p.unit, amount: p.amount,
    });
    return { ok: true };
  }
  // M10 — document GED (non financier) : rejouable tel quel.
  if (m.entity === 'documents' && m.op === 'create') {
    const p = m.payload as unknown as DocumentCreatePayload;
    await api.documents.add(p.operationId, {
      reference: p.reference, title: p.title, discipline: p.discipline, indice: p.indice,
    });
    return { ok: true };
  }
  // M6 — unité (inventaire physique, non financier).
  if (m.entity === 'units' && m.op === 'create') {
    const p = m.payload as unknown as UnitCreatePayload;
    await api.commercialisation.addUnit(p.operationId, {
      lotId: p.lotId ?? null, typology: p.typology, area: p.area, price: Money.of(p.priceMajor, p.currency),
    });
    return { ok: true };
  }
  // M6 — vente/bail capturée hors-ligne = brouillon (§4) ; création rejouable.
  if (m.entity === 'sales' && m.op === 'create') {
    const p = m.payload as unknown as SaleCreatePayload;
    await api.commercialisation.addSale(p.operationId, {
      kind: p.kind, unitId: p.unitId ?? null, counterpart: p.counterpart,
      amount: Money.of(p.amountMajor, p.currency), schedule: p.schedule ?? [],
    });
    return { ok: true };
  }
  // M2 — parcelle foncière (montage juridique) créée en « prospection », rejouable.
  if (m.entity === 'landParcels' && m.op === 'create') {
    const p = m.payload as unknown as LandParcelCreatePayload;
    await api.compliance.addLandParcel(p.operationId, {
      reference: p.reference, area: p.area, tenureType: p.tenureType, price: p.price,
      notary: p.notary ?? null, suspensiveConditions: p.suspensiveConditions ?? [],
    });
    return { ok: true };
  }
  // M8 — révision de prix (v4.1). Coefficient/montant révisé calculés en TS (F6).
  if (m.entity === 'priceRevisions' && m.op === 'create') {
    const p = m.payload as unknown as PriceRevisionCreatePayload;
    await api.revisions.add(p.operationId, {
      contractId: p.contractId, baseAmount: p.baseAmount, a0: p.a0, terms: p.terms,
      coefficient: p.coefficient, revisedAmount: p.revisedAmount,
    });
    return { ok: true };
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
