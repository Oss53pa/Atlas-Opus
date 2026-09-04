import { describe, it, expect } from 'vitest';
import { deriveEscalations, escalationsToNotifications } from './escalations';
import type { ApprovalTask } from '../admin/types';

const NOW = '2026-09-04T12:00:00.000Z';

const ap = (over: Partial<ApprovalTask> = {}): ApprovalTask => ({
  id: 'a1', tenantId: 't', module: 'M13', object: 'Situation n° 7', detail: '', amount: 1_000_000,
  status: 'a_valider', requiredRole: 'moa_director', forMe: true, createdAt: '2026-09-01T09:00:00.000Z', ...over,
});

describe('F7 — escalades des approbations (moteur)', () => {
  it('récente (< 3 j) → aucune escalade', () => {
    expect(deriveEscalations({ approvals: [ap({ createdAt: '2026-09-03T09:00:00.000Z' })], now: NOW })).toEqual([]);
  });

  it('paliers : ≥3 j → L1 echeance ; ≥7 j → L2 danger ; ≥14 j → L3 danger', () => {
    const l1 = deriveEscalations({ approvals: [ap({ id: 'x', createdAt: '2026-09-01T00:00:00.000Z' })], now: NOW })[0]; // 3 j
    expect(l1).toMatchObject({ level: 1, severity: 'echeance', dedupKey: 'escalation:x:L1' });
    const l2 = deriveEscalations({ approvals: [ap({ id: 'y', createdAt: '2026-08-26T00:00:00.000Z' })], now: NOW })[0]; // 9 j
    expect(l2).toMatchObject({ level: 2, severity: 'danger', dedupKey: 'escalation:y:L2' });
    const l3 = deriveEscalations({ approvals: [ap({ id: 'z', createdAt: '2026-08-15T00:00:00.000Z' })], now: NOW })[0]; // 20 j
    expect(l3).toMatchObject({ level: 3, severity: 'danger', dedupKey: 'escalation:z:L3' });
  });

  it('n’émet qu’au palier courant le plus haut (une seule relance)', () => {
    const items = deriveEscalations({ approvals: [ap({ id: 'old', createdAt: '2026-08-01T00:00:00.000Z' })], now: NOW });
    expect(items).toHaveLength(1);
    expect(items[0].level).toBe(3);
  });

  it('tri par urgence : palier le plus haut d’abord', () => {
    const items = deriveEscalations({
      approvals: [
        ap({ id: 'l1', createdAt: '2026-09-01T00:00:00.000Z' }),
        ap({ id: 'l3', createdAt: '2026-08-10T00:00:00.000Z' }),
      ],
      now: NOW,
    });
    expect(items.map((i) => i.approvalId)).toEqual(['l3', 'l1']);
  });

  it('seuils personnalisables', () => {
    const items = deriveEscalations({ approvals: [ap({ createdAt: '2026-09-03T00:00:00.000Z' })], now: NOW, levels: [1] }); // 1 j
    expect(items[0]).toMatchObject({ level: 1 });
  });

  it('pont notifications : idempotent via dedupKey à palier', () => {
    const items = deriveEscalations({ approvals: [ap({ id: 'k', createdAt: '2026-08-20T00:00:00.000Z' })], now: NOW });
    expect(escalationsToNotifications(items, NOW)[0]).toMatchObject({ tenantId: 't', severity: 'danger', at: NOW, dedupKey: 'escalation:k:L3' });
  });
});
