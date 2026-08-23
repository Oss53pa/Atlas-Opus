/**
 * M23 — Journal & audit · types du domaine, pur.
 * Journal append-only : chaque écriture sensible y laisse une trace horodatée
 * (auteur, action, module, objet). Inaltérable (aucune édition). Table : ao_audit_log.
 */

/** Nature de l'action journalisée. */
export const AUDIT_ACTIONS = ['create', 'update', 'approve', 'transition', 'export', 'access'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  id: string;
  tenantId: string;
  operationId: string;
  /** Horodatage serveur (ISO). */
  at: string;
  actor: string;
  action: AuditAction;
  /** Code module (M1..M23). */
  module: string;
  /** Objet concerné (référence, id métier). */
  object: string;
  summary: string | null;
}

export interface AuditInput {
  action: AuditAction;
  module: string;
  object: string;
  summary?: string | null;
}
