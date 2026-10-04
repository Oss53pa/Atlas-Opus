/**
 * M4 — Scénarios & sensibilité du bilan (transposé d'Advancity, « études de
 * faisabilité »). Calcul pur appliqué au bilan réel de l'opération : rien n'est
 * ressaisi, seules les hypothèses (deltas) varient. Montants via Money.ts.
 */
import type { Money } from '../money/Money';

export interface BilanBase {
  recettes: Money;
  coutTotal: Money;
}

export const SCENARIO_KINDS = ['optimiste', 'probable', 'pessimiste', 'stress'] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

/** Hypothèses d'un scénario : deltas en taux (+0,05 = +5 %). */
export interface ScenarioAssumptions {
  revenueDelta: number;
  costDelta: number;
  delayMonths: number;
}

/**
 * Jeu de scénarios de référence (convention de comité d'engagement). Ajustables
 * à l'écran ; ils servent de point de départ, pas de vérité.
 */
export const SCENARIO_PRESETS: Record<ScenarioKind, ScenarioAssumptions> = {
  optimiste: { revenueDelta: 0.05, costDelta: -0.02, delayMonths: 0 },
  probable: { revenueDelta: 0, costDelta: 0, delayMonths: 0 },
  pessimiste: { revenueDelta: -0.05, costDelta: 0.08, delayMonths: 4 },
  stress: { revenueDelta: -0.15, costDelta: 0.15, delayMonths: 9 },
};

export interface ScenarioResult {
  recettes: Money;
  coutTotal: Money;
  marge: Money;
  /** marge / coût total (0 si coût nul) — même définition que le bilan M4. */
  tauxMarge: number;
  delayMonths: number;
}

export function applyScenario(base: BilanBase, s: ScenarioAssumptions): ScenarioResult {
  const recettes = base.recettes.mulRate(1 + s.revenueDelta);
  const coutTotal = base.coutTotal.mulRate(1 + s.costDelta);
  const marge = recettes.subtract(coutTotal);
  return {
    recettes,
    coutTotal,
    marge,
    tauxMarge: coutTotal.isZero() ? 0 : marge.toMajorNumber() / coutTotal.toMajorNumber(),
    delayMonths: s.delayMonths,
  };
}

export type SensitivityAxis = 'revenue' | 'cost';

export interface SensitivityRow {
  delta: number;
  marge: Money;
  tauxMarge: number;
}

const onAxis = (axis: SensitivityAxis, delta: number): ScenarioAssumptions => ({
  revenueDelta: axis === 'revenue' ? delta : 0,
  costDelta: axis === 'cost' ? delta : 0,
  delayMonths: 0,
});

/** Fait varier un seul axe, toutes choses égales par ailleurs. */
export function sensitivity(base: BilanBase, axis: SensitivityAxis, deltas: number[]): SensitivityRow[] {
  return deltas.map((delta) => {
    const r = applyScenario(base, onAxis(axis, delta));
    return { delta, marge: r.marge, tauxMarge: r.tauxMarge };
  });
}

/**
 * Point mort sur un axe : delta (au 0,1 % près) à partir duquel la marge
 * s'annule — baisse des recettes ou hausse des coûts. null si la marge ne
 * bascule pas dans l'intervalle ±100 %, ou si elle est déjà nulle ou négative.
 */
export function pointMort(base: BilanBase, axis: SensitivityAxis): number | null {
  const sign = axis === 'revenue' ? -1 : 1;
  for (let i = 0; i <= 1000; i++) {
    const delta = sign * i * 0.001;
    if (!applyScenario(base, onAxis(axis, delta)).marge.isPositive()) return i === 0 ? null : delta;
  }
  return null;
}
