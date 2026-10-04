/**
 * M19 (HSSE) — règles pures du registre d'incidents. Aucune dépendance UI/IO ;
 * l'horloge (`now` ISO) est injectée pour un comportement déterministe.
 */
import type { HsseIncident, HsseInspection, HsseSeverity, HsseStatus } from './types';

/** Un incident est-il ouvert (non clos) ? */
export function isOpen(i: Pick<HsseIncident, 'status'>): boolean {
  return i.status !== 'clos';
}

/** Nombre d'incidents ouverts (déclarés ou en analyse). */
export function openCount(list: Pick<HsseIncident, 'status'>[]): number {
  return list.filter(isOpen).length;
}

/** Nombre d'incidents critiques encore ouverts (priorité d'instruction). */
export function criticalOpenCount(list: Pick<HsseIncident, 'status' | 'severity'>[]): number {
  return list.filter((i) => isOpen(i) && i.severity === 'critique').length;
}

/**
 * Jours écoulés depuis le dernier ACCIDENT (indicateur HSSE classique
 * « jours sans accident »). null s'il n'y a jamais eu d'accident enregistré.
 * Compté en jours pleins ; jamais négatif (un accident daté dans le futur ⇒ 0).
 */
export function daysSinceLastAccident(
  list: Pick<HsseIncident, 'kind' | 'occurredAt'>[],
  now: string,
): number | null {
  const dates = list.filter((i) => i.kind === 'accident').map((i) => Date.parse(i.occurredAt)).filter((n) => !Number.isNaN(n));
  if (dates.length === 0) return null;
  const last = Math.max(...dates);
  const days = Math.floor((Date.parse(now) - last) / 86_400_000);
  return Math.max(0, days);
}

/** Transitions autorisées : marche avant linéaire + réouverture depuis « clos ». */
export const HSSE_TRANSITIONS: Record<HsseStatus, HsseStatus[]> = {
  declare: ['en_analyse'],
  en_analyse: ['clos'],
  clos: ['en_analyse'],
};

export function canTransitionHsse(from: HsseStatus, to: HsseStatus): boolean {
  return HSSE_TRANSITIONS[from].includes(to);
}

/** Rang de gravité (tri décroissant : critique d'abord). */
export function severityRank(s: HsseSeverity): number {
  return { critique: 3, grave: 2, mineure: 1 }[s];
}

/** Tri par gravité décroissante puis date de survenance décroissante. */
export function sortByPriority<T extends Pick<HsseIncident, 'severity' | 'occurredAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    severityRank(b.severity) - severityRank(a.severity) || b.occurredAt.localeCompare(a.occurredAt));
}

// ── Indicateurs réglementaires (spec M19 §6, transposé d'Advancity) ─────────
//   TF (taux de fréquence) = accidents avec arrêt × 1 000 000 / heures travaillées
//   TG (taux de gravité)   = journées perdues    × 1 000     / heures travaillées

/** Accident avec arrêt : un accident ayant occasionné au moins une journée perdue. */
export function accidentsAvecArret(list: Pick<HsseIncident, 'kind' | 'daysLost'>[]): number {
  return list.filter((i) => i.kind === 'accident' && i.daysLost > 0).length;
}

export function journeesPerdues(list: Pick<HsseIncident, 'daysLost'>[]): number {
  return list.reduce((acc, i) => acc + Math.max(0, i.daysLost), 0);
}

/** Heures travaillées cumulées, déclarées visite après visite. */
export function heuresTravaillees(inspections: Pick<HsseInspection, 'hoursWorked'>[]): number {
  return inspections.reduce((acc, i) => acc + Math.max(0, i.hoursWorked), 0);
}

/** null tant qu'aucune heure travaillée n'est déclarée : on n'affiche pas un taux faux. */
export function tauxFrequence(incidents: Pick<HsseIncident, 'kind' | 'daysLost'>[], hours: number): number | null {
  return hours > 0 ? (accidentsAvecArret(incidents) * 1_000_000) / hours : null;
}

export function tauxGravite(incidents: Pick<HsseIncident, 'daysLost'>[], hours: number): number | null {
  return hours > 0 ? (journeesPerdues(incidents) * 1_000) / hours : null;
}

/** Une visite est conforme à partir de 80/100 (seuil usuel du plan HSE). */
export const COMPLIANCE_THRESHOLD = 80;
export function isCompliant(score: number): boolean {
  return score >= COMPLIANCE_THRESHOLD;
}

/** Part des visites conformes ; null sans visite (pas de 100 % par défaut). */
export function complianceRate(inspections: Pick<HsseInspection, 'score'>[]): number | null {
  if (inspections.length === 0) return null;
  return inspections.filter((i) => isCompliant(i.score)).length / inspections.length;
}
