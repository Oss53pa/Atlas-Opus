/**
 * M18 (volet qualité) — Non-conformités · types du domaine, purs. Transposé du
 * module Qualité d'Advancity. Une non-conformité est un écart constaté par
 * rapport au référentiel (plans, CCTP, normes) : distincte de la **réserve**
 * (relevée à la réception, M18) et de l'**incident HSSE** (fait de sécurité,
 * M19). Elle se solde par une action corrective tracée.
 * Table : ao_non_conformities (opération-scopée).
 */

/** Origine du constat. */
export const NC_SOURCES = ['chantier', 'fournisseur', 'etude', 'audit', 'client'] as const;
export type NcSource = (typeof NC_SOURCES)[number];

/** Gravité (croissante) — même échelle que HSSE pour une lecture homogène. */
export const NC_SEVERITIES = ['mineure', 'majeure', 'critique'] as const;
export type NcSeverity = (typeof NC_SEVERITIES)[number];

/** Machine : ouverte → en traitement → soldée (réouverture possible). */
export const NC_STATUSES = ['ouverte', 'en_traitement', 'soldee'] as const;
export type NcStatus = (typeof NC_STATUSES)[number];

export interface NonConformity {
  id: string;
  tenantId: string;
  operationId: string;
  /** Référence interne (ex. NC-2026-012). */
  reference: string;
  label: string;
  source: NcSource;
  severity: NcSeverity;
  /** Localisation sur l'ouvrage (ou null). */
  location: string | null;
  /** Action corrective décidée (null tant que non instruite). */
  correctiveAction: string | null;
  /** Responsable du traitement (entreprise, MOE…). */
  owner: string | null;
  detectedAt: string;
  dueDate: string | null;
  closedAt: string | null;
  status: NcStatus;
}

export interface NonConformityInput {
  reference: string;
  label: string;
  source: NcSource;
  severity: NcSeverity;
  location?: string | null;
  correctiveAction?: string | null;
  owner?: string | null;
  detectedAt: string;
  dueDate?: string | null;
}
