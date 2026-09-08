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

type TransportDeps = Pick<DataApi, 'siteReports' | 'payments' | 'rfis' | 'reception' | 'purchasing' | 'documents'>;

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
