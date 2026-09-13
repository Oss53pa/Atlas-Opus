import { describe, it, expect } from 'vitest';
import {
  isReceived, receivedCount, atCustomsCount, inTransitCount, isEtaOverdue,
  overdueCount, sortByEta, canTransitionShipment, nextStatuses,
} from './shipment';
import type { Shipment } from './types';

const TODAY = '2026-09-13';

const s = (over: Partial<Shipment> = {}): Shipment => ({
  id: 's', tenantId: 't', operationId: 'op', poId: null, reference: 'EXP-01',
  incoterm: 'CIF', customsStatus: 'en_transit', eta: '2026-09-20', receivedAt: null, ...over,
});

describe('shipment — réception & dédouanement', () => {
  it('isReceived / receivedCount / inTransitCount', () => {
    expect(isReceived(s({ customsStatus: 'livre' }))).toBe(true);
    expect(isReceived(s({ customsStatus: 'en_douane' }))).toBe(false);
    const list = [s({ customsStatus: 'livre' }), s({ customsStatus: 'en_douane' }), s({ customsStatus: 'en_transit' })];
    expect(receivedCount(list)).toBe(1);
    expect(inTransitCount(list)).toBe(2);
    expect(atCustomsCount(list)).toBe(1);
  });

  it('isEtaOverdue : ETA dépassée et non livré', () => {
    expect(isEtaOverdue(s({ eta: '2026-09-01' }), TODAY)).toBe(true);
    expect(isEtaOverdue(s({ eta: '2026-09-01', customsStatus: 'livre' }), TODAY)).toBe(false); // livré
    expect(isEtaOverdue(s({ eta: '2026-09-20' }), TODAY)).toBe(false); // à venir
    expect(isEtaOverdue(s({ eta: null }), TODAY)).toBe(false); // sans ETA
    expect(overdueCount([s({ eta: '2026-09-01' }), s({ eta: '2026-08-01', customsStatus: 'livre' })], TODAY)).toBe(1);
  });

  it('sortByEta : ETA croissante, sans ETA en dernier', () => {
    const list = [s({ id: 'none', eta: null }), s({ id: 'late', eta: '2026-08-01' }), s({ id: 'soon', eta: '2026-09-10' })];
    expect(sortByEta(list).map((x) => x.id)).toEqual(['late', 'soon', 'none']);
    expect(list[0].id).toBe('none'); // pas de mutation
  });
});

describe('shipment — machine à états', () => {
  it('transitions autorisées / interdites', () => {
    expect(canTransitionShipment('en_attente', 'en_transit')).toBe(true);
    expect(canTransitionShipment('en_douane', 'dedouane')).toBe(true);
    expect(canTransitionShipment('dedouane', 'livre')).toBe(true);
    expect(canTransitionShipment('en_transit', 'livre')).toBe(true); // livraison directe (pas d'import)
    expect(canTransitionShipment('en_attente', 'livre')).toBe(false); // pas de saut
    expect(canTransitionShipment('livre', 'en_transit')).toBe(false); // terminal
  });
  it('nextStatuses', () => {
    expect(nextStatuses('en_transit')).toEqual(['en_douane', 'livre']);
    expect(nextStatuses('livre')).toEqual([]);
  });
});
