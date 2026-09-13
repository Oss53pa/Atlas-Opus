/**
 * M19 (EIES) — règles pures : gravité, atténuation, priorisation.
 * Une mesure « soldée » clôt le suivi de l'impact.
 */
import { EIES_STATUSES, SEVERITIES, type EiesItem, type EiesStatus, type Milieu, type Severity } from './types';

/** Rang de gravité (0 = faible … 3 = critique). */
export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

/** Impact à forte gravité (forte ou critique) ? */
export function isHighSeverity(item: Pick<EiesItem, 'severity'>): boolean {
  return item.severity === 'forte' || item.severity === 'critique';
}

/** La mesure est-elle soldée (suivi clos) ? */
export function isMitigated(item: Pick<EiesItem, 'status'>): boolean {
  return item.status === 'soldee';
}

/** Impacts à forte gravité dont la mesure n'est pas soldée. */
export function openHighCount(list: Pick<EiesItem, 'severity' | 'status'>[]): number {
  return list.filter((i) => isHighSeverity(i) && !isMitigated(i)).length;
}

/** Taux d'atténuation : mesures soldées / total (0..1). Vide ⇒ 0. */
export function mitigatedRate(list: Pick<EiesItem, 'status'>[]): number {
  if (list.length === 0) return 0;
  return list.filter(isMitigated).length / list.length;
}

/** Répartition par milieu. */
export function countByMilieu(list: Pick<EiesItem, 'milieu'>[]): Record<Milieu, number> {
  const acc = { physique: 0, biologique: 0, humain: 0, socio_economique: 0 } as Record<Milieu, number>;
  for (const i of list) acc[i.milieu] += 1;
  return acc;
}

/**
 * Tri de priorité : gravité décroissante d'abord, puis mesures non soldées avant
 * soldées. Ne mute pas la liste d'entrée.
 */
export function sortByPriority<T extends Pick<EiesItem, 'severity' | 'status'>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const sr = severityRank(b.severity) - severityRank(a.severity);
    if (sr !== 0) return sr;
    return Number(isMitigated(a)) - Number(isMitigated(b));
  });
}

/** Transitions autorisées (machine à états gardée, avancement linéaire). */
const TRANSITIONS: Record<EiesStatus, EiesStatus[]> = {
  planifiee: ['en_cours', 'soldee'],
  en_cours: ['mise_en_oeuvre', 'soldee'],
  mise_en_oeuvre: ['soldee'],
  soldee: [],
};

export function canTransitionEies(from: EiesStatus, to: EiesStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts atteignables depuis l'état courant. */
export function nextStatuses(from: EiesStatus): EiesStatus[] {
  return EIES_STATUSES.filter((s) => canTransitionEies(from, s));
}
