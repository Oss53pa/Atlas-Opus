/**
 * M23 (dépouillement) — règles pures de pondération et de notation.
 * Les poids sont des fractions (0..1) devant sommer à 1 ; les notes brutes
 * sont des points (0..100). La note pondérée d'une offre agrège poids × note.
 */
import { CRITERION_TYPES, type CriterionType, type EvaluationCriterion } from './types';

/** Somme des poids (fraction). */
export function totalWeight(list: Pick<EvaluationCriterion, 'weight'>[]): number {
  return list.reduce((acc, c) => acc + c.weight, 0);
}

/** La grille est-elle pondérée à 100 % (à 0,0001 près) et non vide ? */
export function isWeightBalanced(list: Pick<EvaluationCriterion, 'weight'>[]): boolean {
  if (list.length === 0) return false;
  return Math.abs(totalWeight(list) - 1) < 0.0001;
}

/** Poids cumulé par nature de critère. */
export function weightByType(list: Pick<EvaluationCriterion, 'type' | 'weight'>[]): Record<CriterionType, number> {
  const acc = { technique: 0, financier: 0, administratif: 0, delai: 0 } as Record<CriterionType, number>;
  for (const c of list) acc[c.type] += c.weight;
  return acc;
}

/** Note pondérée d'un critère : note brute (0..100) × poids (0..1). */
export function weightedScore(rawScore: number, weight: number): number {
  return rawScore * weight;
}

/**
 * Note pondérée totale d'une offre : somme des (note brute × poids) sur les
 * critères notés. Résultat sur 100 si la grille est équilibrée.
 */
export function weightedTotal(entries: { rawScore: number; weight: number }[]): number {
  return entries.reduce((acc, e) => acc + weightedScore(e.rawScore, e.weight), 0);
}

/**
 * Renormalise les poids pour qu'ils somment à 1, en conservant les proportions.
 * Retourne les mêmes objets avec un `weight` ajusté ; liste inchangée si somme
 * nulle. Ne mute pas les entrées.
 */
export function normalizeWeights<T extends { weight: number }>(list: T[]): T[] {
  const total = totalWeight(list);
  if (total === 0) return list.map((c) => ({ ...c }));
  return list.map((c) => ({ ...c, weight: c.weight / total }));
}

/** Nature ordonnée (pour un affichage stable de la grille). */
export function orderedTypes(): readonly CriterionType[] {
  return CRITERION_TYPES;
}
