/**
 * F7 — Escalades des approbations en souffrance, moteur pur (CLAUDE.md §3/§8).
 * Le moteur de workflow (F7) route chaque décision vers un rôle ; si elle reste
 * en file au-delà d'un SLA, on **escalade** par une relance de sévérité croissante.
 * Job pg_cron/BullMQ via le runner. N'AUTOMUTE PAS l'approbation (le routage reste
 * une décision humaine) : il alerte, à paliers, sans jamais dupliquer.
 *
 * Paliers par défaut (ancienneté en jours) : L1 ≥ 3 (echeance), L2 ≥ 7 (danger),
 * L3 ≥ 14 (danger). Une approbation n'émet qu'à SON palier courant le plus haut ;
 * la clé de dédoublonnage inclut le palier → franchir un nouveau seuil émet une
 * nouvelle relance, les précédentes restant dédoublonnées.
 */
import type { NotifSeverity } from '../admin/types';
import type { ApprovalTask } from '../admin/types';
import type { NotificationUpsert } from '../f4/echeances';

/** Seuils d'ancienneté (jours) définissant les paliers d'escalade, croissants. */
export const DEFAULT_ESCALATION_LEVELS = [3, 7, 14] as const;

export interface EscalationItem {
  approvalId: string;
  tenantId: string;
  requiredRole: string;
  /** Palier atteint (1..n). */
  level: number;
  ageDays: number;
  severity: NotifSeverity;
  title: string;
  context: string;
  dedupKey: string;
}

export interface EscalationInput {
  approvals: ApprovalTask[];
  /** Instant de référence (ISO). */
  now: string;
  /** Seuils croissants (jours) ; défaut DEFAULT_ESCALATION_LEVELS. */
  levels?: readonly number[];
}

const DAY_MS = 86_400_000;

function ageInDays(createdAt: string, now: string): number {
  return Math.floor((Date.parse(now) - Date.parse(createdAt)) / DAY_MS);
}

/** Indice (1-based) du palier le plus haut atteint, ou 0 si aucun. */
function reachedLevel(ageDays: number, levels: readonly number[]): number {
  let level = 0;
  for (let i = 0; i < levels.length; i++) {
    if (ageDays >= levels[i]) level = i + 1;
  }
  return level;
}

/** Dérive une escalade par approbation ayant franchi un palier, la plus urgente d'abord. */
export function deriveEscalations(input: EscalationInput): EscalationItem[] {
  const levels = input.levels ?? DEFAULT_ESCALATION_LEVELS;
  const items: EscalationItem[] = [];

  for (const a of input.approvals) {
    const ageDays = ageInDays(a.createdAt, input.now);
    const level = reachedLevel(ageDays, levels);
    if (level === 0) continue;
    items.push({
      approvalId: a.id,
      tenantId: a.tenantId,
      requiredRole: a.requiredRole,
      level,
      ageDays,
      severity: level >= 2 ? 'danger' : 'echeance',
      title: `Escalade — ${a.object}`,
      context: `${a.module} · ${a.requiredRole} · ${ageDays} j en attente`,
      dedupKey: `escalation:${a.id}:L${level}`,
    });
  }

  return items.sort((x, y) => (x.level !== y.level ? y.level - x.level : y.ageDays - x.ageDays));
}

/** Pont F4 : escalades → upserts de notification (idempotents). */
export function escalationsToNotifications(items: EscalationItem[], at: string): NotificationUpsert[] {
  return items.map((i) => ({
    tenantId: i.tenantId,
    severity: i.severity,
    title: i.title,
    context: i.context,
    at,
    dedupKey: i.dedupKey,
  }));
}
