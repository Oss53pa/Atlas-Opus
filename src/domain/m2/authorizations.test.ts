import { describe, it, expect } from 'vitest';
import {
  canTransitionAuthorization,
  isAuthorizationEffective,
  permitGate,
  isAuthorizationExpiring,
  type Authorization,
} from './authorizations';

const TODAY = '2026-08-22';
const auth = (over: Partial<Authorization> = {}): Pick<Authorization, 'type' | 'status' | 'validity'> => ({
  type: 'permis_construire',
  status: 'granted',
  validity: '2027-01-01',
  ...over,
});

describe('M2 — machine des autorisations (§4)', () => {
  it('draft → submitted → granted | refused', () => {
    expect(canTransitionAuthorization('draft', 'submitted')).toBe(true);
    expect(canTransitionAuthorization('submitted', 'granted')).toBe(true);
    expect(canTransitionAuthorization('submitted', 'refused')).toBe(true);
    expect(canTransitionAuthorization('draft', 'granted')).toBe(false);
    expect(canTransitionAuthorization('granted', 'refused')).toBe(false);
  });
});

describe('M2 — effectivité d’une autorisation', () => {
  it('granted et non expirée → effective', () => {
    expect(isAuthorizationEffective(auth(), TODAY)).toBe(true);
    expect(isAuthorizationEffective(auth({ validity: null }), TODAY)).toBe(true);
  });
  it('non granted ou expirée → non effective', () => {
    expect(isAuthorizationEffective(auth({ status: 'submitted' }), TODAY)).toBe(false);
    expect(isAuthorizationEffective(auth({ validity: '2026-01-01' }), TODAY)).toBe(false);
  });
});

describe('M2 — garde permis → M1 (RG-M2-07)', () => {
  it('permis « submitted » → bloquant', () => {
    const g = permitGate([auth({ status: 'submitted' })], TODAY);
    expect(g.ok).toBe(false);
    expect(g.blocking).toEqual(['permis_construire']);
  });
  it('permis « granted » et valide → garde levée', () => {
    expect(permitGate([auth()], TODAY)).toEqual({ ok: true, blocking: [] });
  });
  it('aucun permis dans la liste → bloquant', () => {
    expect(permitGate([auth({ type: 'autorisation_env' })], TODAY).ok).toBe(false);
  });
});

describe('M2 — échéance d’autorisation (RG-M2-09)', () => {
  it('validité ≤ 30 j ou dépassée → à alerter', () => {
    expect(isAuthorizationExpiring(auth({ validity: '2026-09-10' }), TODAY)).toBe(true); // 19 j
    expect(isAuthorizationExpiring(auth({ validity: '2026-08-01' }), TODAY)).toBe(true); // dépassée
    expect(isAuthorizationExpiring(auth({ validity: '2027-06-01' }), TODAY)).toBe(false);
    expect(isAuthorizationExpiring(auth({ status: 'submitted' }), TODAY)).toBe(false);
  });
});
