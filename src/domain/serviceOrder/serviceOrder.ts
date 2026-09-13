/**
 * M13/M15 (ordres de service) — règles pures : décompte, état des travaux
 * (arrêt/reprise), machine à états gardée.
 */
import {
  SERVICE_ORDER_STATUSES, type ServiceOrder, type ServiceOrderStatus, type ServiceOrderType,
} from './types';

/** L'OS est-il effectif (émis ou notifié) ? */
export function isEffective(so: Pick<ServiceOrder, 'status'>): boolean {
  return so.status === 'emis' || so.status === 'notifie';
}

/** Nombre d'OS notifiés. */
export function notifiedCount(list: Pick<ServiceOrder, 'status'>[]): number {
  return list.filter((s) => s.status === 'notifie').length;
}

/** Nombre d'OS en projet (non encore émis). */
export function draftCount(list: Pick<ServiceOrder, 'status'>[]): number {
  return list.filter((s) => s.status === 'projet').length;
}

/** Répartition par nature (tous statuts). */
export function countByType(list: Pick<ServiceOrder, 'type'>[]): Record<ServiceOrderType, number> {
  const acc = { demarrage: 0, arret: 0, reprise: 0, notification: 0, autre: 0 } as Record<ServiceOrderType, number>;
  for (const s of list) acc[s.type] += 1;
  return acc;
}

/**
 * Les travaux sont-ils à l'arrêt ? On regarde la suite des OS d'arrêt/reprise
 * NOTIFIÉS, du plus ancien au plus récent : si le dernier est un « arrêt », les
 * travaux sont suspendus ; un « reprise » postérieur les relance.
 */
export function worksStopped(list: Pick<ServiceOrder, 'type' | 'status' | 'createdAt'>[]): boolean {
  const seq = list
    .filter((s) => s.status === 'notifie' && (s.type === 'arret' || s.type === 'reprise'))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const last = seq[seq.length - 1];
  return last?.type === 'arret';
}

/** Transitions autorisées (machine à états gardée). */
const TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  projet: ['emis', 'annule'],
  emis: ['notifie', 'annule'],
  notifie: [],
  annule: [],
};

export function canTransitionServiceOrder(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: ServiceOrderStatus): ServiceOrderStatus[] {
  return SERVICE_ORDER_STATUSES.filter((s) => canTransitionServiceOrder(from, s));
}
