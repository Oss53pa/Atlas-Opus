/**
 * M13 — Règles de pilotage de réalisation, pures et testables.
 * Dernier compte rendu, avancement courant, cumul des points de blocage.
 */
import type { SiteReport } from './types';

/** Comptes rendus triés du plus récent au plus ancien (par date puis numéro). */
export function sortReports<T extends Pick<SiteReport, 'date' | 'number'>>(reports: T[]): T[] {
  return [...reports].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.number - a.number));
}

/** Dernier compte rendu (le plus récent), ou null. */
export function latestReport(reports: SiteReport[]): SiteReport | null {
  return sortReports(reports)[0] ?? null;
}

/** Avancement du dernier compte rendu (0 si aucun). */
export function latestProgress(reports: SiteReport[]): number {
  return latestReport(reports)?.progress ?? 0;
}

/** Cumul des points de blocage ouverts (tous comptes rendus). */
export function totalBlockers(reports: Pick<SiteReport, 'blockers'>[]): number {
  return reports.reduce((s, r) => s + r.blockers, 0);
}

/** Prochain numéro de compte rendu (max + 1). */
export function nextReportNumber(reports: Pick<SiteReport, 'number'>[]): number {
  return reports.reduce((max, r) => Math.max(max, r.number), 0) + 1;
}
