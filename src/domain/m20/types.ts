/**
 * M20 — Risques (registre des risques) · types du domaine, pur.
 * La matrice RACI est portée par M7 (gouvernance) ; M20 couvre le registre des
 * risques : criticité = probabilité × impact. Table : ao_risks.
 */

export const RISK_CATEGORIES = ['technique', 'financier', 'juridique', 'delai', 'hsse', 'externe'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

/** Machine d'un risque : ouvert → maîtrisé → clos (réouverture possible). */
export const RISK_STATUSES = ['ouvert', 'maitrise', 'clos'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

/** Niveau de criticité dérivé du score (jamais persisté). */
export type RiskLevel = 'faible' | 'moyen' | 'eleve' | 'critique';

export interface Risk {
  id: string;
  tenantId: string;
  operationId: string;
  code: string;
  label: string;
  category: RiskCategory;
  /** Probabilité 1..5. */
  probability: number;
  /** Impact 1..5. */
  impact: number;
  status: RiskStatus;
  /** Mesure de maîtrise (parade). */
  mitigation: string | null;
}

export interface RiskInput {
  code: string;
  label: string;
  category: RiskCategory;
  probability: number;
  impact: number;
  mitigation?: string | null;
}
