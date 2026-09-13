/**
 * M20 (passation→exploitation, volet actifs) — Inventaire des ouvrages/actifs à
 * transférer à l'exploitant · types du domaine, purs. Chaque actif porte une fin
 * de garantie (suivi GPA/maintenance) et un système d'exploitation cible.
 * Table : ao_handover_assets (opération-scopée).
 */

/** Nature de l'actif transféré. */
export const ASSET_TYPES = ['equipement', 'reseau', 'batiment', 'espace_vert', 'autre'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface HandoverAsset {
  id: string;
  tenantId: string;
  operationId: string;
  label: string;
  assetType: AssetType;
  /** Localisation sur site (ou null). */
  location: string | null;
  /** Fin de garantie (ISO date) ou null. */
  warrantyEnd: string | null;
  /** Système d'exploitation cible (GMAO, gestionnaire…) ou null. */
  targetSystem: string | null;
}

export interface HandoverAssetInput {
  label: string;
  assetType: AssetType;
  location?: string | null;
  warrantyEnd?: string | null;
  targetSystem?: string | null;
}
