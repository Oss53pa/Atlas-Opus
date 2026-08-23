/**
 * M13 — Pilotage de réalisation · types du domaine, pur.
 * Comptes rendus de chantier : avancement physique, points de blocage, décisions.
 * Table : ao_site_reports. Avancement en fraction 0..1.
 */

export interface SiteReport {
  id: string;
  tenantId: string;
  operationId: string;
  number: number;
  date: string;
  author: string;
  /** Avancement physique constaté (0..1). */
  progress: number;
  summary: string;
  /** Nombre de points de blocage relevés. */
  blockers: number;
}

export interface SiteReportInput {
  date: string;
  author: string;
  progress: number;
  summary: string;
  blockers: number;
}
