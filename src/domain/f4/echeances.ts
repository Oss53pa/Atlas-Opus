/**
 * F4 — Relances & échéances, moteur pur et testable (réf CLAUDE.md §3/§8).
 * Consolide les échéances contractuelles à surveiller — **assurances** (M7) et
 * **cautions/garanties** (M17) — en items de notification datés et **idempotents**
 * (clé stable). Piloté par pg_cron/BullMQ via le runner ; réutilise les statuts
 * déjà dérivés par chaque module (aucune règle de date redéfinie).
 *   · échéance dépassée      → severity « danger »   (relance forte) ;
 *   · échéance imminente     → severity « echeance » (relance préventive).
 * L'objet arrivé à terme mais déjà couvert/renouvelé n'émet rien.
 */
import type { NotifSeverity } from '../admin/types';
import { insuranceStatus, EXPIRY_WARNING_DAYS } from '../m7/rules';
import { effectiveStatus as guaranteeStatus } from '../m17/guarantees';
import type { Insurance } from '../m7/types';
import type { Guarantee } from '../m17/types';

export type EcheanceKind = 'assurance' | 'caution';
export type EcheanceBucket = 'expiring' | 'expired';

export interface EcheanceItem {
  kind: EcheanceKind;
  refId: string;
  operationId: string;
  tenantId: string;
  severity: NotifSeverity; // 'echeance' (imminente) | 'danger' (dépassée)
  bucket: EcheanceBucket;
  /** Échéance ISO (date). */
  dueDate: string;
  /** Libellé court (ex. « Assurance DO — AXA »). */
  title: string;
  /** Contexte (module · référence). */
  context: string;
  /**
   * Clé de dédoublonnage stable : inclut le palier (expiring/expired) pour
   * qu'une escalade imminente → dépassée émette bien une nouvelle relance, sans
   * répéter la même à chaque passage du cron.
   */
  dedupKey: string;
}

export interface EcheanceInput {
  insurances: Insurance[];
  guarantees: Guarantee[];
  today: string;
  /** Fenêtre d'alerte en jours (défaut aligné M7/M17 : 30 j). */
  warningDays?: number;
}

const bucketSeverity = (b: EcheanceBucket): NotifSeverity => (b === 'expired' ? 'danger' : 'echeance');

/** Dérive les relances d'échéance (assurances + cautions), triées par urgence. */
export function deriveEcheances(input: EcheanceInput): EcheanceItem[] {
  const w = input.warningDays ?? EXPIRY_WARNING_DAYS;
  const items: EcheanceItem[] = [];

  for (const ins of input.insurances) {
    if (!ins.validTo) continue;
    const st = insuranceStatus(ins, input.today, w);
    if (st !== 'expiring' && st !== 'expired') continue;
    const bucket: EcheanceBucket = st === 'expired' ? 'expired' : 'expiring';
    items.push({
      kind: 'assurance',
      refId: ins.id,
      operationId: ins.operationId,
      tenantId: ins.tenantId,
      severity: bucketSeverity(bucket),
      bucket,
      dueDate: ins.validTo,
      title: `Assurance ${ins.type} — ${ins.insurer}`,
      context: `M7 · police ${ins.attestationRef ?? ins.id}`,
      dedupKey: `echeance:assurance:${ins.id}:${bucket}`,
    });
  }

  for (const g of input.guarantees) {
    if (!g.validUntil) continue;
    const st = guaranteeStatus(g, input.today, w);
    if (st !== 'expiring' && st !== 'expiree') continue;
    const bucket: EcheanceBucket = st === 'expiree' ? 'expired' : 'expiring';
    items.push({
      kind: 'caution',
      refId: g.id,
      operationId: g.operationId,
      tenantId: g.tenantId,
      severity: bucketSeverity(bucket),
      bucket,
      dueDate: g.validUntil,
      title: `Caution ${g.type} — ${g.issuer}`,
      context: `M17 · garantie ${g.id}`,
      dedupKey: `echeance:caution:${g.id}:${bucket}`,
    });
  }

  // Les plus urgentes d'abord : dépassées avant imminentes, puis par échéance.
  return items.sort((a, b) =>
    a.bucket !== b.bucket ? (a.bucket === 'expired' ? -1 : 1) : a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0,
  );
}

/** Entrée d'upsert notification (F4) dérivée d'un item d'échéance. */
export interface NotificationUpsert {
  tenantId: string;
  severity: NotifSeverity;
  title: string;
  context: string;
  at: string;
  dedupKey: string;
}

/** Pont F4 : transforme les items en upserts de notification (idempotents). */
export function echeancesToNotifications(items: EcheanceItem[], at: string): NotificationUpsert[] {
  return items.map((i) => ({
    tenantId: i.tenantId,
    severity: i.severity,
    title: i.title,
    context: i.context,
    at,
    dedupKey: i.dedupKey,
  }));
}
