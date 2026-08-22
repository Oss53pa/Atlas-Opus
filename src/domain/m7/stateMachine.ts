/**
 * M7 — Machine à états des livrables (réf Spec M7 §4).
 *   pending → submitted → accepted ; → late si l'échéance est dépassée sans acceptation.
 * Les statuts d'assurance sont dérivés (voir rules.insuranceStatus), pas transités.
 */
import type { DeliverableStatus } from './types';

export type DeliverableAction = 'submit' | 'accept';

const TRANSITIONS: Record<DeliverableAction, { from: DeliverableStatus; to: DeliverableStatus }> = {
  submit: { from: 'pending', to: 'submitted' },
  accept: { from: 'submitted', to: 'accepted' },
};

export function nextDeliverableStatus(from: DeliverableStatus, action: DeliverableAction): DeliverableStatus | null {
  const t = TRANSITIONS[action];
  return t && t.from === from ? t.to : null;
}

/**
 * Statut effectif d'un livrable à la date `today` : un livrable non encore
 * accepté dont l'échéance est passée bascule « late » (affichage/alerte).
 * Un livrable accepté reste accepté même si l'échéance est passée.
 */
export function effectiveDeliverableStatus(
  status: DeliverableStatus,
  dueDate: string,
  today: string,
): DeliverableStatus {
  if (status === 'accepted') return 'accepted';
  const overdue = Date.parse(today) > Date.parse(dueDate);
  return overdue ? 'late' : status;
}

export interface DeliverableDecision {
  ok: boolean;
  to?: DeliverableStatus;
  code?: 'invalid_transition';
}

export function evaluateDeliverableTransition(
  from: DeliverableStatus,
  action: DeliverableAction,
): DeliverableDecision {
  const to = nextDeliverableStatus(from, action);
  if (!to) return { ok: false, code: 'invalid_transition' };
  return { ok: true, to };
}
