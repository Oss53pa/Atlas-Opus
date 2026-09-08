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

type TransportDeps = Pick<DataApi, 'siteReports'>;

interface SiteReportCreatePayload {
  operationId: string;
  date: string;
  author: string;
  progress: number;
  summary: string;
  blockers: number;
}

async function dispatch(api: TransportDeps, m: PendingMutation): Promise<SettleResult> {
  if (m.entity === 'siteReports' && m.op === 'create') {
    const p = m.payload as unknown as SiteReportCreatePayload;
    await api.siteReports.add(p.operationId, {
      date: p.date, author: p.author, progress: p.progress, summary: p.summary, blockers: p.blockers,
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
