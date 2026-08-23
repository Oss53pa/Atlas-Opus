/**
 * M3 — Règles de gestion des études amont, pures et testables.
 * Machine de statut, cumul des coûts (via Money.ts), garde « études validées ».
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import { STUDY_STATUSES, type Study, type StudyStatus } from './types';

/** Transitions autorisées de la machine d'étude (§4). */
const NEXT: Record<StudyStatus, StudyStatus | null> = {
  planifiee: 'en_cours',
  en_cours: 'remise',
  remise: 'validee',
  validee: null,
};

/** Statut suivant dans le cycle de vie, ou null si terminal. */
export function nextStudyStatus(from: StudyStatus): StudyStatus | null {
  return NEXT[from];
}

/** Transition valide ? (avancer d'un cran, ou renvoyer « remise » → « en_cours »). */
export function canTransitionStudy(from: StudyStatus, to: StudyStatus): boolean {
  if (NEXT[from] === to) return true;
  // Renvoi pour reprise : une étude remise peut repasser en cours.
  return from === 'remise' && to === 'en_cours';
}

/** Nombre d'études validées. */
export function validatedCount(studies: Pick<Study, 'status'>[]): number {
  return studies.filter((s) => s.status === 'validee').length;
}

/**
 * Garde M3 → M1 : les études amont sont « levées » quand il existe au moins une
 * étude et que toutes sont validées. Une liste vide ne lève pas la garde.
 */
export function studiesCleared(studies: Pick<Study, 'status'>[]): boolean {
  return studies.length > 0 && studies.every((s) => s.status === 'validee');
}

/** Cumul des coûts d'études (→ poste « études » du bilan M4). */
export function studiesCostTotal(studies: Pick<Study, 'cost'>[], currency: Currency): Money {
  return sumMoney(studies.map((s) => Money.of(s.cost, currency)), currency);
}

export { STUDY_STATUSES };
