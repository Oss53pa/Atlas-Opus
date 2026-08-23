/**
 * M12 (handoff) — Règles RFI, pures et testables.
 * Machine ouverte → répondue → clôturée ; compteurs ouvertes / en retard / urgentes.
 */
import type { Rfi, RfiStatus } from './types';

const NEXT: Record<RfiStatus, RfiStatus | null> = {
  ouverte: 'repondue',
  repondue: 'cloturee',
  cloturee: null,
};

export function nextRfiStatus(from: RfiStatus): RfiStatus | null {
  return NEXT[from];
}

export function isOpen(status: RfiStatus): boolean {
  return status === 'ouverte';
}

export function openCount(rfis: Pick<Rfi, 'status'>[]): number {
  return rfis.filter((r) => isOpen(r.status)).length;
}

export function urgentOpenCount(rfis: Pick<Rfi, 'status' | 'priority'>[]): number {
  return rfis.filter((r) => isOpen(r.status) && r.priority === 'urgente').length;
}

/** RFI ouverte dont l'échéance de réponse est dépassée. */
export function isOverdue(rfi: Pick<Rfi, 'status' | 'dueDate'>, today: string): boolean {
  return isOpen(rfi.status) && !!rfi.dueDate && rfi.dueDate < today;
}

export function overdueCount(rfis: Pick<Rfi, 'status' | 'dueDate'>[], today: string): number {
  return rfis.filter((r) => isOverdue(r, today)).length;
}
