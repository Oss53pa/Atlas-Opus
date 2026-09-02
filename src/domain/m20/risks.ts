/**
 * M20 — Règles du registre des risques, pures et testables.
 * Criticité = probabilité × impact (1..25), niveau dérivé, compteurs, tri.
 */
import type { Risk, RiskLevel, RiskStatus } from './types';

/** Score de criticité brut (1..25). */
export function riskScore(probability: number, impact: number): number {
  return probability * impact;
}

/** Niveau dérivé : faible ≤4, moyen ≤9, élevé ≤15, critique >15. */
export function riskLevel(score: number): RiskLevel {
  if (score <= 4) return 'faible';
  if (score <= 9) return 'moyen';
  if (score <= 15) return 'eleve';
  return 'critique';
}

export function isOpen(status: RiskStatus): boolean {
  return status === 'ouvert';
}

/** Machine d'un risque : ouvert → maîtrisé → clos, avec réouverture. */
const RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  ouvert: ['maitrise', 'clos'],
  maitrise: ['clos', 'ouvert'],
  clos: ['ouvert'],
};
export function canTransitionRisk(from: RiskStatus, to: RiskStatus): boolean {
  return RISK_TRANSITIONS[from].includes(to);
}

export function openRisksCount(risks: Pick<Risk, 'status'>[]): number {
  return risks.filter((r) => isOpen(r.status)).length;
}

export function controlledCount(risks: Pick<Risk, 'status'>[]): number {
  return risks.filter((r) => r.status === 'maitrise').length;
}

/** Risques critiques encore ouverts (parade urgente). */
export function criticalOpenCount(risks: Pick<Risk, 'probability' | 'impact' | 'status'>[]): number {
  return risks.filter((r) => isOpen(r.status) && riskLevel(riskScore(r.probability, r.impact)) === 'critique').length;
}

/** Tri par criticité décroissante (ouverts d'abord à criticité égale). */
export function sortByCriticality<T extends Pick<Risk, 'probability' | 'impact' | 'status'>>(risks: T[]): T[] {
  return [...risks].sort((a, b) => {
    const d = riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact);
    if (d !== 0) return d;
    return (isOpen(b.status) ? 1 : 0) - (isOpen(a.status) ? 1 : 0);
  });
}

export { RISK_STATUSES } from './types';
