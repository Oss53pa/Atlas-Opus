/**
 * M2 — Due diligence foncière & juridique (réf Spec M2 §3/§5), domaine pur.
 * Fournit la garde DD consommée par la transition M1 amont → conception :
 * un item « critical » ou « high » non « cleared » bloque (RG-M2-03).
 */

export const DD_CATEGORIES = ['servitude', 'litige', 'hypotheque', 'bornage', 'conformite'] as const;
export type DueDiligenceCategory = (typeof DD_CATEGORIES)[number];

export const DD_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type DueDiligenceSeverity = (typeof DD_SEVERITIES)[number];

export type DueDiligenceStatus = 'open' | 'cleared';

export interface DueDiligenceItem {
  id: string;
  tenantId: string;
  operationId: string;
  category: DueDiligenceCategory;
  finding: string;
  severity: DueDiligenceSeverity;
  status: DueDiligenceStatus;
}

/** Saisie de création d'un item de due diligence (écran conformité). */
export interface DueDiligenceInput {
  category: DueDiligenceCategory;
  finding: string;
  severity: DueDiligenceSeverity;
}

/** Sévérités bloquantes pour la phase « conception » (RG-M2-03). */
const BLOCKING_SEVERITIES: DueDiligenceSeverity[] = ['high', 'critical'];

/** Un item bloque-t-il la conception ? (critical/high ET non cleared) */
export function isBlockingItem(item: Pick<DueDiligenceItem, 'severity' | 'status'>): boolean {
  return item.status === 'open' && BLOCKING_SEVERITIES.includes(item.severity);
}

/** Résultat de garde réutilisable (même forme que permitGate / doGate). */
export interface DdGateResult {
  ok: boolean;
  blocking: DueDiligenceItem[];
}

/**
 * RG-M2-03 — Garde DD : renvoie les items « critical »/« high » non « cleared »
 * qui bloquent la transition amont → conception (garde M1). ok = aucun bloquant.
 */
export function ddGate(items: DueDiligenceItem[]): DdGateResult {
  const blocking = items.filter(isBlockingItem);
  return { ok: blocking.length === 0, blocking };
}
