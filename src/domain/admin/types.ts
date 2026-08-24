/**
 * Administration transverse (F1/F4/F7) · types du domaine, purs.
 * Trois concerns tenant : membres & rôles (F1), notifications (F4),
 * boîte d'approbations (F7). Tables : ao_members, ao_notifications, ao_approvals.
 * Montants en `number` (unités majeures) ; le routage par seuil est pur.
 */
import type { Role } from '../m1/types';

// ── Membres & rôles (F1) ─────────────────────────────────────────────────────
export const MEMBER_STATUSES = ['actif', 'en_attente', 'suspendu'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface Member {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  /** Périmètre lisible (« toutes opérations », « Bellevue · Plateau »…). */
  scope: string;
  status: MemberStatus;
  /** Dernière activité (libellé relatif) ou null si invitation. */
  lastActivity: string | null;
}

// ── Notifications (F4) ───────────────────────────────────────────────────────
export const NOTIF_SEVERITIES = ['danger', 'echeance', 'info'] as const;
export type NotifSeverity = (typeof NOTIF_SEVERITIES)[number];

export interface NotificationItem {
  id: string;
  tenantId: string;
  severity: NotifSeverity;
  title: string;
  /** Contexte (opération · module · RG). */
  context: string;
  /** Date ISO du fait. */
  at: string;
  read: boolean;
}

// ── Boîte d'approbations (F7) ────────────────────────────────────────────────
export const APPROVAL_STATUSES = ['a_valider', 'a_arbitrer', 'a_decider', 'visa_moe'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalTask {
  id: string;
  tenantId: string;
  /** Code de module source (M13, M14, M8…). */
  module: string;
  object: string;
  /** Contexte court (visa obtenu, +12 j chemin critique…). */
  detail: string;
  /** Montant concerné (unités majeures ; signé pour un avenant). */
  amount: number;
  status: ApprovalStatus;
  /** Rôle requis par le routage de seuil. */
  requiredRole: Role;
  /** Assigné à l'utilisateur courant (file « pour vous »). */
  forMe: boolean;
}

/** Palier de routage par seuil (RG-M14-03). */
export interface ThresholdTier {
  /** Borne supérieure (unités majeures) ; null = pas de plafond. */
  maxAmount: number | null;
  role: Role;
}
