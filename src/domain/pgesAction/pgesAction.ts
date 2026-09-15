/**
 * M19 (PGES) — règles pures : avancement, retard, priorisation.
 * Une action « soldée » clôt le suivi. Une échéance nulle n'est jamais en retard.
 */
import { PGES_STATUSES, type PgesAction, type PgesStatus } from './types';

/** L'action est-elle encore ouverte (non soldée) ? */
export function isOpen(a: Pick<PgesAction, 'status'>): boolean {
  return a.status !== 'soldee';
}

/** Nombre d'actions ouvertes. */
export function openCount(list: Pick<PgesAction, 'status'>[]): number {
  return list.filter(isOpen).length;
}

/** Action en retard : échéance dépassée et action non soldée. */
export function isOverdue(a: Pick<PgesAction, 'status' | 'echeance'>, today: string): boolean {
  return isOpen(a) && !!a.echeance && a.echeance < today;
}

/** Nombre d'actions en retard. */
export function overdueCount(list: Pick<PgesAction, 'status' | 'echeance'>[], today: string): number {
  return list.filter((a) => isOverdue(a, today)).length;
}

/** Taux d'achèvement : actions soldées / total (0..1). Vide ⇒ 0. */
export function completionRate(list: Pick<PgesAction, 'status'>[]): number {
  if (list.length === 0) return 0;
  return list.filter((a) => a.status === 'soldee').length / list.length;
}

/**
 * Tri de priorité : actions en retard d'abord, puis ouvertes par échéance
 * croissante (sans échéance en dernier au sein du groupe), soldées en dernier.
 * Ne mute pas la liste d'entrée.
 */
export function sortByPriority<T extends Pick<PgesAction, 'status' | 'echeance'>>(list: T[], today: string): T[] {
  const rank = (a: T) => (isOverdue(a, today) ? 0 : isOpen(a) ? 1 : 2);
  return [...list].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.echeance === b.echeance) return 0;
    if (!a.echeance) return 1;
    if (!b.echeance) return -1;
    return a.echeance < b.echeance ? -1 : 1;
  });
}

/** Transitions autorisées (machine à états gardée). */
const TRANSITIONS: Record<PgesStatus, PgesStatus[]> = {
  ouvert: ['en_cours', 'soldee'],
  en_cours: ['soldee'],
  soldee: [],
};

export function canTransitionPges(from: PgesStatus, to: PgesStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: PgesStatus): PgesStatus[] {
  return PGES_STATUSES.filter((s) => canTransitionPges(from, s));
}
