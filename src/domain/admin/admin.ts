/**
 * Administration transverse · règles pures, testables.
 * Routage par seuil (RG-M14-03) : ≤ 10 M → AMO ; 10–50 M → directeur ; > 50 M → comité.
 * Aucune dépendance UI/IO.
 */
import type { Role } from '../m1/types';
import type { ApprovalTask, Member, NotificationItem, NotifSeverity, ThresholdTier } from './types';

/** Paliers de routage par défaut (config tenant simplifiée, unités majeures). */
export const DEFAULT_THRESHOLDS: ThresholdTier[] = [
  { maxAmount: 10_000_000, role: 'amo' },
  { maxAmount: 50_000_000, role: 'moa_director' },
  { maxAmount: null, role: 'owner' },
];

/**
 * RG-M14-03 — Rôle requis pour approuver un montant selon les paliers.
 * Compare la valeur absolue du montant aux bornes croissantes.
 */
export function thresholdRole(amount: number, tiers: ThresholdTier[] = DEFAULT_THRESHOLDS): Role {
  const abs = Math.abs(amount);
  const sorted = [...tiers].sort((a, b) => (a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity));
  for (const tier of sorted) {
    if (tier.maxAmount === null || abs <= tier.maxAmount) return tier.role;
  }
  return sorted[sorted.length - 1]?.role ?? 'owner';
}

/** Nombre de tâches d'approbation assignées à l'utilisateur courant. */
export function tasksForMe(tasks: Pick<ApprovalTask, 'forMe'>[]): number {
  return tasks.filter((t) => t.forMe).length;
}

/** Nombre de notifications non lues. */
export function unreadCount(items: Pick<NotificationItem, 'read'>[]): number {
  return items.filter((n) => !n.read).length;
}

/** Nombre de notifications d'une sévérité donnée. */
export function countBySeverity(items: Pick<NotificationItem, 'severity'>[], severity: NotifSeverity): number {
  return items.filter((n) => n.severity === severity).length;
}

/** Nombre de membres actifs (hors invitations en attente / suspendus). */
export function activeMembers(members: Pick<Member, 'status'>[]): number {
  return members.filter((m) => m.status === 'actif').length;
}

/** Nombre de rôles distincts effectivement attribués. */
export function distinctRoles(members: Pick<Member, 'role'>[]): number {
  return new Set(members.map((m) => m.role)).size;
}
