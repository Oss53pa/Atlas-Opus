import { describe, it, expect } from 'vitest';
import { deriveEcheances, echeancesToNotifications } from './echeances';
import type { Insurance } from '../m7/types';
import type { Guarantee } from '../m17/types';

const TODAY = '2026-09-04';

const ins = (over: Partial<Insurance> = {}): Insurance => ({
  id: 'i1', tenantId: 't', operationId: 'op', stakeholderId: null, type: 'DO', insurer: 'AXA',
  validFrom: '2026-01-01', validTo: '2026-12-31', attestationRef: 'ATT-1', ...over,
});
const gua = (over: Partial<Guarantee> = {}): Guarantee => ({
  id: 'g1', tenantId: 't', operationId: 'op', type: 'restitution_avance', issuer: 'BOA',
  amount: 10_000_000, validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'active', ...over,
});

describe('F4 — relances & échéances (moteur)', () => {
  it('assurance valide (> fenêtre) → aucune relance', () => {
    expect(deriveEcheances({ insurances: [ins({ validTo: '2027-06-30' })], guarantees: [], today: TODAY })).toEqual([]);
  });

  it('assurance imminente (≤ 30 j) → echeance ; dépassée → danger', () => {
    const soon = deriveEcheances({ insurances: [ins({ validTo: '2026-09-20' })], guarantees: [], today: TODAY });
    expect(soon[0]).toMatchObject({ kind: 'assurance', severity: 'echeance', bucket: 'expiring', dedupKey: 'echeance:assurance:i1:expiring' });
    const past = deriveEcheances({ insurances: [ins({ validTo: '2026-08-31' })], guarantees: [], today: TODAY });
    expect(past[0]).toMatchObject({ severity: 'danger', bucket: 'expired', dedupKey: 'echeance:assurance:i1:expired' });
  });

  it('caution imminente/dépassée détectée ; statut terminal ignoré', () => {
    const soon = deriveEcheances({ insurances: [], guarantees: [gua({ validUntil: '2026-09-10' })], today: TODAY });
    expect(soon[0]).toMatchObject({ kind: 'caution', severity: 'echeance', dedupKey: 'echeance:caution:g1:expiring' });
    // Garantie déjà libérée → hors périmètre (pas de relance).
    expect(deriveEcheances({ insurances: [], guarantees: [gua({ validUntil: '2026-08-01', status: 'liberee' })], today: TODAY })).toEqual([]);
  });

  it('sans échéance (validTo/validUntil null) → ignoré', () => {
    expect(deriveEcheances({ insurances: [ins({ validTo: null })], guarantees: [gua({ validUntil: null })], today: TODAY })).toEqual([]);
  });

  it('tri par urgence : dépassées avant imminentes', () => {
    const items = deriveEcheances({
      insurances: [ins({ id: 'soon', validTo: '2026-09-20' }), ins({ id: 'past', validTo: '2026-08-01' })],
      guarantees: [],
      today: TODAY,
    });
    expect(items.map((i) => i.refId)).toEqual(['past', 'soon']);
  });

  it('pont notifications : idempotent via dedupKey, daté à `at`', () => {
    const items = deriveEcheances({ insurances: [ins({ validTo: '2026-08-31' })], guarantees: [], today: TODAY });
    const notifs = echeancesToNotifications(items, TODAY);
    expect(notifs[0]).toMatchObject({ tenantId: 't', severity: 'danger', at: TODAY, dedupKey: 'echeance:assurance:i1:expired' });
  });
});
