/**
 * M2 (foncier & montage juridique) — Structure juridique de portage. Véhicule
 * ad hoc (SPV) constitué pour porter l'opération : forme OHADA, RCCM,
 * répartition du capital. Domaine pur, aucune dépendance UI/IO.
 * Table : ao_legal_entities (opération-scopée).
 */

/** Formes juridiques usuelles (espace OHADA). */
export const STRUCTURE_TYPES = ['sci', 'sarl', 'sa', 'sas', 'gie', 'snc', 'autre'] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

/** Cycle de vie de la structure. */
export const LEGAL_ENTITY_STATUSES = ['projet', 'constituee', 'active', 'dissoute'] as const;
export type LegalEntityStatus = (typeof LEGAL_ENTITY_STATUSES)[number];

/** Associé et sa quote-part de capital (en pourcentage). */
export interface Shareholder {
  name: string;
  /** Part du capital en % (0..100). */
  sharePct: number;
}

export interface LegalEntity {
  id: string;
  tenantId: string;
  operationId: string;
  structureType: StructureType;
  name: string;
  /** Numéro RCCM (registre du commerce), ou null tant que non immatriculée. */
  rccm: string | null;
  shareholders: Shareholder[];
  status: LegalEntityStatus;
}

export interface LegalEntityInput {
  structureType: StructureType;
  name: string;
  rccm?: string | null;
  shareholders?: Shareholder[];
}
