/**
 * M18 (volet qualité) — Règles de gestion des non-conformités, pures.
 * RG-NC-01 : une NC critique ouverte bloque le prononcé de la réception.
 * RG-NC-02 : passer « soldée » exige une action corrective renseignée.
 */
import type { NcSeverity, NcStatus, NonConformity } from './types';

/** NC encore à traiter. */
export function isOpen(nc: Pick<NonConformity, 'status'>): boolean {
  return nc.status !== 'soldee';
}

export function openCount(list: Pick<NonConformity, 'status'>[]): number {
  return list.filter(isOpen).length;
}

/** NC critiques encore ouvertes — remontées au cockpit (M21). */
export function criticalOpenCount(list: Pick<NonConformity, 'status' | 'severity'>[]): number {
  return list.filter((n) => isOpen(n) && n.severity === 'critique').length;
}

/** NC ouverte dont l'échéance de traitement est dépassée. */
export function isOverdue(nc: Pick<NonConformity, 'status' | 'dueDate'>, now: string): boolean {
  return isOpen(nc) && nc.dueDate !== null && nc.dueDate < now;
}

export function overdueCount(list: Pick<NonConformity, 'status' | 'dueDate'>[], now: string): number {
  return list.filter((n) => isOverdue(n, now)).length;
}

/** Taux de traitement = NC soldées / total. null sans aucune NC (pas de 100 % par défaut). */
export function traitementRate(list: Pick<NonConformity, 'status'>[]): number | null {
  if (list.length === 0) return null;
  return list.filter((n) => n.status === 'soldee').length / list.length;
}

export function bySeverity(list: Pick<NonConformity, 'status' | 'severity'>[]): Record<NcSeverity, number> {
  const out: Record<NcSeverity, number> = { mineure: 0, majeure: 0, critique: 0 };
  for (const n of list.filter(isOpen)) out[n.severity] += 1;
  return out;
}

const SEVERITY_RANK: Record<NcSeverity, number> = { critique: 0, majeure: 1, mineure: 2 };

/** Priorité d'affichage : ouvertes d'abord, puis gravité, puis ancienneté. */
export function sortByPriority<T extends Pick<NonConformity, 'status' | 'severity' | 'detectedAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    Number(isOpen(b)) - Number(isOpen(a))
    || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || a.detectedAt.localeCompare(b.detectedAt));
}

/** Transitions : marche avant linéaire + réouverture depuis « soldée ». */
export const NC_TRANSITIONS: Record<NcStatus, NcStatus[]> = {
  ouverte: ['en_traitement', 'soldee'],
  en_traitement: ['soldee'],
  soldee: ['en_traitement'],
};

export type NcDecision =
  | { ok: true; to: NcStatus }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'corrective_action_required' };

export function canTransitionNc(from: NcStatus, to: NcStatus): boolean {
  return NC_TRANSITIONS[from].includes(to);
}

/**
 * RG-NC-02 — On ne solde pas une non-conformité sans dire comment : l'action
 * corrective est exigée au moment du solde, pas à l'ouverture.
 */
export function evaluateNcTransition(
  from: NcStatus,
  to: NcStatus,
  ctx: { correctiveAction: string | null },
): NcDecision {
  if (!canTransitionNc(from, to)) return { ok: false, code: 'invalid_transition' };
  if (to === 'soldee' && !ctx.correctiveAction?.trim()) return { ok: false, code: 'corrective_action_required' };
  return { ok: true, to };
}

/**
 * RG-NC-01 — Garde de réception : une NC critique ouverte interdit de prononcer
 * la réception (l'ouvrage n'est pas conforme au référentiel).
 */
export function receptionBlockedByNc(list: Pick<NonConformity, 'status' | 'severity'>[]): boolean {
  return criticalOpenCount(list) > 0;
}
