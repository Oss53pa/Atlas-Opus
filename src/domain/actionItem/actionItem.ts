/**
 * M13 (relevé d'actions) — règles pures : avancement, retard, priorisation.
 * Une action « ouverte » désigne un statut non terminal (ouvert ou en_cours).
 */
import { ACTION_ITEM_STATUSES, type ActionItem, type ActionItemStatus } from './types';

/** Statuts terminaux (l'action ne demande plus de suivi). */
const CLOSED: ActionItemStatus[] = ['fait', 'annule'];

/** L'action est-elle encore à mener ? */
export function isOpen(item: Pick<ActionItem, 'status'>): boolean {
  return !CLOSED.includes(item.status);
}

/** Nombre d'actions ouvertes (non terminales). */
export function openCount(list: Pick<ActionItem, 'status'>[]): number {
  return list.filter(isOpen).length;
}

/** L'action est-elle en retard (échéance dépassée et encore ouverte) ? */
export function isOverdue(item: Pick<ActionItem, 'status' | 'dueDate'>, today: string): boolean {
  return isOpen(item) && item.dueDate < today;
}

/** Nombre d'actions ouvertes en retard. */
export function overdueCount(list: Pick<ActionItem, 'status' | 'dueDate'>[], today: string): number {
  return list.filter((i) => isOverdue(i, today)).length;
}

/** Taux d'achèvement : actions « fait » / total (0..1). Vide ⇒ 0. */
export function completionRate(list: Pick<ActionItem, 'status'>[]): number {
  if (list.length === 0) return 0;
  return list.filter((i) => i.status === 'fait').length / list.length;
}

/**
 * Tri par priorité de traitement : les actions en retard d'abord, puis les
 * ouvertes par échéance croissante, les terminées en dernier. Ne mute pas.
 */
export function sortByPriority<T extends Pick<ActionItem, 'status' | 'dueDate'>>(list: T[], today: string): T[] {
  const rank = (i: T) => (isOverdue(i, today) ? 0 : isOpen(i) ? 1 : 2);
  return [...list].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  });
}

/** Transitions autorisées (machine à états gardée). */
const TRANSITIONS: Record<ActionItemStatus, ActionItemStatus[]> = {
  ouvert: ['en_cours', 'fait', 'annule'],
  en_cours: ['fait', 'annule'],
  fait: [],
  annule: [],
};

export function canTransitionActionItem(from: ActionItemStatus, to: ActionItemStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: ActionItemStatus): ActionItemStatus[] {
  return ACTION_ITEM_STATUSES.filter((s) => canTransitionActionItem(from, s));
}
