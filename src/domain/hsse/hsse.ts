/**
 * M19 (HSSE) — règles pures du registre d'incidents. Aucune dépendance UI/IO ;
 * l'horloge (`now` ISO) est injectée pour un comportement déterministe.
 */
import type { HsseIncident, HsseSeverity, HsseStatus } from './types';

/** Un incident est-il ouvert (non clos) ? */
export function isOpen(i: Pick<HsseIncident, 'status'>): boolean {
  return i.status !== 'clos';
}

/** Nombre d'incidents ouverts (déclarés ou en analyse). */
export function openCount(list: Pick<HsseIncident, 'status'>[]): number {
  return list.filter(isOpen).length;
}

/** Nombre d'incidents critiques encore ouverts (priorité d'instruction). */
export function criticalOpenCount(list: Pick<HsseIncident, 'status' | 'severity'>[]): number {
  return list.filter((i) => isOpen(i) && i.severity === 'critique').length;
}

/**
 * Jours écoulés depuis le dernier ACCIDENT (indicateur HSSE classique
 * « jours sans accident »). null s'il n'y a jamais eu d'accident enregistré.
 * Compté en jours pleins ; jamais négatif (un accident daté dans le futur ⇒ 0).
 */
export function daysSinceLastAccident(
  list: Pick<HsseIncident, 'kind' | 'occurredAt'>[],
  now: string,
): number | null {
  const dates = list.filter((i) => i.kind === 'accident').map((i) => Date.parse(i.occurredAt)).filter((n) => !Number.isNaN(n));
  if (dates.length === 0) return null;
  const last = Math.max(...dates);
  const days = Math.floor((Date.parse(now) - last) / 86_400_000);
  return Math.max(0, days);
}

/** Transitions autorisées : marche avant linéaire + réouverture depuis « clos ». */
export const HSSE_TRANSITIONS: Record<HsseStatus, HsseStatus[]> = {
  declare: ['en_analyse'],
  en_analyse: ['clos'],
  clos: ['en_analyse'],
};

export function canTransitionHsse(from: HsseStatus, to: HsseStatus): boolean {
  return HSSE_TRANSITIONS[from].includes(to);
}

/** Rang de gravité (tri décroissant : critique d'abord). */
export function severityRank(s: HsseSeverity): number {
  return { critique: 3, grave: 2, mineure: 1 }[s];
}

/** Tri par gravité décroissante puis date de survenance décroissante. */
export function sortByPriority<T extends Pick<HsseIncident, 'severity' | 'occurredAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    severityRank(b.severity) - severityRank(a.severity) || b.occurredAt.localeCompare(a.occurredAt));
}
