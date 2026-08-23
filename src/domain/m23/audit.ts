/**
 * M23 — Règles du journal d'audit, pures et testables.
 * Le journal est append-only (RG-M23) : aucune modification ni suppression d'une
 * entrée actée. Regroupement par jour et tri antéchronologique pour l'affichage.
 */
import type { AuditEntry } from './types';

/** RG-M23 — Une entrée d'audit n'est jamais modifiable ni supprimable. */
export function canModifyAudit(): boolean {
  return false;
}

/** Tri antéchronologique (plus récent d'abord). */
export function sortByDateDesc<T extends Pick<AuditEntry, 'at'>>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Regroupe les entrées par jour (clé ISO YYYY-MM-DD), jours triés décroissant. */
export function groupByDay(entries: AuditEntry[]): { day: string; entries: AuditEntry[] }[] {
  const map = new Map<string, AuditEntry[]>();
  for (const e of sortByDateDesc(entries)) {
    const day = e.at.slice(0, 10);
    const bucket = map.get(day);
    if (bucket) bucket.push(e);
    else map.set(day, [e]);
  }
  return [...map.entries()].map(([day, list]) => ({ day, entries: list }));
}

/** Nombre de modules distincts touchés. */
export function distinctModules(entries: Pick<AuditEntry, 'module'>[]): number {
  return new Set(entries.map((e) => e.module)).size;
}
