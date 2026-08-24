/**
 * Passation vers exploitation (bascule) · types du domaine, pur.
 * Le transfert vers l'exploitation (Keystone / Atlas Lease) est conditionné au
 * DOE complet et à la réception prononcée (RG-M20-01). Table : ao_handover
 * (un enregistrement par opération ; catégories DOE et équipements en jsonb).
 */

/** Catégorie du dossier des ouvrages exécutés (DOE). */
export const DOE_CATEGORIES = ['plans_asbuilt', 'notices', 'garanties', 'pv_controle'] as const;
export type DoeCategoryKey = (typeof DOE_CATEGORIES)[number];

/** Système cible d'un transfert d'équipement. */
export const TARGET_SYSTEMS = ['keystone', 'lease'] as const;
export type TargetSystem = (typeof TARGET_SYSTEMS)[number];

/** Une catégorie du DOE : attendus vs reçus (complétude dérivée, jamais persistée). */
export interface DoeCategory {
  key: DoeCategoryKey;
  /** Responsable de la production (donnée libre : entreprise, CT…). */
  responsible: string;
  expected: number;
  received: number;
}

/** Un lot d'équipements/actifs à transférer à un système cible. */
export interface TransferEquipment {
  label: string;
  detail: string;
  target: TargetSystem;
}

/** Statut de préparation du transfert. */
export const TRANSFER_STATES = ['non_lance', 'preparation', 'pret', 'transfere'] as const;
export type TransferState = (typeof TRANSFER_STATES)[number];

/** Dossier de bascule d'une opération. */
export interface HandoverFile {
  operationId: string;
  doe: DoeCategory[];
  equipment: TransferEquipment[];
  /** Nombre total d'équipements inventoriés. */
  equipmentCount: number;
  /** Nombre de garanties suivies. */
  guaranteesCount: number;
  /** Garanties sans date de fin (à compléter). */
  guaranteesWithoutEnd: number;
  transferState: TransferState;
  /** Export tracé et souverain prêt (journalisé à l'audit). */
  exportReady: boolean;
}
