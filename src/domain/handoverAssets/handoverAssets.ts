/**
 * M20 (actifs de transfert) — règles pures. Horloge injectée (`now` ISO).
 */
import type { HandoverAsset } from './types';

/** Un actif est-il encore sous garantie à la date donnée ? (pas de garantie ⇒ non). */
export function isUnderWarranty(a: Pick<HandoverAsset, 'warrantyEnd'>, now: string): boolean {
  return a.warrantyEnd !== null && Date.parse(a.warrantyEnd) >= Date.parse(now);
}

/** Nombre d'actifs sous garantie. */
export function underWarrantyCount(list: Pick<HandoverAsset, 'warrantyEnd'>[], now: string): number {
  return list.filter((a) => isUnderWarranty(a, now)).length;
}

/**
 * Actifs dont la garantie expire dans les `days` prochains jours (et pas encore
 * expirée) — file d'alerte GPA avant bascule/exploitation.
 */
export function expiringWarranty(list: Pick<HandoverAsset, 'warrantyEnd'>[], now: string, days = 90): number {
  const from = Date.parse(now);
  const to = from + days * 86_400_000;
  return list.filter((a) => a.warrantyEnd !== null && Date.parse(a.warrantyEnd) >= from && Date.parse(a.warrantyEnd) <= to).length;
}

/** Nombre d'actifs sans système d'exploitation cible renseigné (à compléter avant bascule). */
export function unassignedCount(list: Pick<HandoverAsset, 'targetSystem'>[]): number {
  return list.filter((a) => !a.targetSystem).length;
}
