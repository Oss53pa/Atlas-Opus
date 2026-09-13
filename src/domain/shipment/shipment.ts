/**
 * M9 (logistique) — règles pures : réception, dédouanement, retard d'ETA.
 * Le passage à « livre » matérialise la réception (receivedAt).
 */
import { CUSTOMS_STATUSES, type CustomsStatus, type Shipment } from './types';

/** L'expédition est-elle réceptionnée (livrée) ? */
export function isReceived(s: Pick<Shipment, 'customsStatus'>): boolean {
  return s.customsStatus === 'livre';
}

/** Nombre d'expéditions livrées. */
export function receivedCount(list: Pick<Shipment, 'customsStatus'>[]): number {
  return list.filter(isReceived).length;
}

/** Nombre d'expéditions bloquées en douane. */
export function atCustomsCount(list: Pick<Shipment, 'customsStatus'>[]): number {
  return list.filter((s) => s.customsStatus === 'en_douane').length;
}

/** Nombre d'expéditions en cours (non encore livrées). */
export function inTransitCount(list: Pick<Shipment, 'customsStatus'>[]): number {
  return list.filter((s) => !isReceived(s)).length;
}

/** ETA dépassée alors que l'expédition n'est pas livrée ? */
export function isEtaOverdue(s: Pick<Shipment, 'customsStatus' | 'eta'>, today: string): boolean {
  return !isReceived(s) && !!s.eta && s.eta < today;
}

/** Nombre d'expéditions en retard sur leur ETA. */
export function overdueCount(list: Pick<Shipment, 'customsStatus' | 'eta'>[], today: string): number {
  return list.filter((s) => isEtaOverdue(s, today)).length;
}

/**
 * Tri par ETA croissante ; les expéditions sans ETA en dernier. Ne mute pas.
 */
export function sortByEta<T extends Pick<Shipment, 'eta'>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.eta === b.eta) return 0;
    if (!a.eta) return 1;
    if (!b.eta) return -1;
    return a.eta < b.eta ? -1 : 1;
  });
}

/** Transitions autorisées (machine à états gardée, avancement logistique). */
const TRANSITIONS: Record<CustomsStatus, CustomsStatus[]> = {
  en_attente: ['en_transit'],
  en_transit: ['en_douane', 'livre'],
  en_douane: ['dedouane'],
  dedouane: ['livre'],
  livre: [],
};

export function canTransitionShipment(from: CustomsStatus, to: CustomsStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: CustomsStatus): CustomsStatus[] {
  return CUSTOMS_STATUSES.filter((s) => canTransitionShipment(from, s));
}
