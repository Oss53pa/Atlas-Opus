/** Passation — machine de statut de l'appel d'offres (linéaire), TS pur. */
import { TENDER_STATUSES, type TenderStatus } from './types';

/** Statut suivant : planned → published → opened → evaluated → awarded → notified (ou null). */
export function nextTenderStatus(s: TenderStatus): TenderStatus | null {
  const i = TENDER_STATUSES.indexOf(s);
  return i >= 0 && i < TENDER_STATUSES.length - 1 ? TENDER_STATUSES[i + 1] : null;
}

/** L'attribution est requise (renseigner le titulaire) à partir de « awarded ». */
export function requiresAward(s: TenderStatus): boolean {
  return s === 'awarded' || s === 'notified';
}
