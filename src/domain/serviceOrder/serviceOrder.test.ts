import { describe, it, expect } from 'vitest';
import {
  isEffective, notifiedCount, draftCount, countByType, worksStopped,
  canTransitionServiceOrder, nextStatuses,
} from './serviceOrder';
import type { ServiceOrder } from './types';

const so = (over: Partial<ServiceOrder> = {}): ServiceOrder => ({
  id: 's', tenantId: 't', operationId: 'op', contractId: null, type: 'notification',
  reference: 'OS-01', content: '…', status: 'projet', createdAt: '2026-01-01T00:00:00.000Z', ...over,
});

describe('serviceOrder — décompte & état des travaux', () => {
  it('isEffective / notifiedCount / draftCount', () => {
    expect(isEffective(so({ status: 'emis' }))).toBe(true);
    expect(isEffective(so({ status: 'notifie' }))).toBe(true);
    expect(isEffective(so({ status: 'projet' }))).toBe(false);
    const list = [so({ status: 'notifie' }), so({ status: 'emis' }), so({ status: 'projet' }), so({ status: 'projet' })];
    expect(notifiedCount(list)).toBe(1);
    expect(draftCount(list)).toBe(2);
  });

  it('countByType répartit par nature', () => {
    const c = countByType([so({ type: 'demarrage' }), so({ type: 'arret' }), so({ type: 'arret' })]);
    expect(c.arret).toBe(2);
    expect(c.demarrage).toBe(1);
    expect(c.reprise).toBe(0);
  });

  it('worksStopped : dernier arrêt notifié non suivi de reprise', () => {
    const stopped = [
      so({ type: 'demarrage', status: 'notifie', createdAt: '2026-01-01T00:00:00Z' }),
      so({ type: 'arret', status: 'notifie', createdAt: '2026-03-01T00:00:00Z' }),
    ];
    expect(worksStopped(stopped)).toBe(true);
    const resumed = [...stopped, so({ type: 'reprise', status: 'notifie', createdAt: '2026-04-01T00:00:00Z' })];
    expect(worksStopped(resumed)).toBe(false);
  });

  it('worksStopped ignore les OS non notifiés', () => {
    const list = [
      so({ type: 'arret', status: 'notifie', createdAt: '2026-03-01T00:00:00Z' }),
      so({ type: 'reprise', status: 'projet', createdAt: '2026-04-01T00:00:00Z' }), // pas encore notifié
    ];
    expect(worksStopped(list)).toBe(true);
    expect(worksStopped([so({ type: 'demarrage', status: 'notifie' })])).toBe(false); // aucun arrêt
  });
});

describe('serviceOrder — machine à états', () => {
  it('transitions autorisées / interdites', () => {
    expect(canTransitionServiceOrder('projet', 'emis')).toBe(true);
    expect(canTransitionServiceOrder('emis', 'notifie')).toBe(true);
    expect(canTransitionServiceOrder('projet', 'notifie')).toBe(false); // pas de saut
    expect(canTransitionServiceOrder('notifie', 'annule')).toBe(false); // terminal
  });
  it('nextStatuses', () => {
    expect(nextStatuses('projet')).toEqual(['emis', 'annule']);
    expect(nextStatuses('notifie')).toEqual([]);
  });
});
