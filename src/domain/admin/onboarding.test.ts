import { describe, it, expect } from 'vitest';
import {
  normalizeScope, effectiveRole, areRolesKnown, validateGrantInput, isValidEmail, scopeSummary,
} from './onboarding';

describe('F1 onboarding — normalizeScope', () => {
  it('vide/null ⇒ null (toutes les opérations)', () => {
    expect(normalizeScope(null)).toBeNull();
    expect(normalizeScope([])).toBeNull();
    expect(normalizeScope(['', ''])).toBeNull();
  });
  it('déduplique en préservant l’ordre', () => {
    expect(normalizeScope(['op-2', 'op-1', 'op-2'])).toEqual(['op-2', 'op-1']);
  });
});

describe('F1 onboarding — effectiveRole', () => {
  it('choisit le plus privilégié (ordre ROLES)', () => {
    expect(effectiveRole(['site', 'finance', 'viewer'])).toBe('finance');
    expect(effectiveRole(['viewer', 'owner'])).toBe('owner');
  });
  it('[] ⇒ null, ignore les inconnus', () => {
    expect(effectiveRole([])).toBeNull();
    expect(effectiveRole(['moe' as never])).toBeNull();
  });
});

describe('F1 onboarding — validation', () => {
  it('areRolesKnown', () => {
    expect(areRolesKnown(['owner', 'finance'])).toBe(true);
    expect(areRolesKnown(['moe'])).toBe(false);
  });
  it('validateGrantInput exige userId + au moins un rôle connu', () => {
    expect(validateGrantInput({ userId: 'u1', roles: ['finance'], operationScope: null }).ok).toBe(true);
    expect(validateGrantInput({ userId: '', roles: ['finance'], operationScope: null }).ok).toBe(false);
    expect(validateGrantInput({ userId: 'u1', roles: [], operationScope: null }).ok).toBe(false);
    expect(validateGrantInput({ userId: 'u1', roles: ['moe' as never], operationScope: null }).errors)
      .toContain('rôle inconnu (hors vocabulaire)');
  });
  it('isValidEmail', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
});

describe('F1 onboarding — scopeSummary', () => {
  it('résume le périmètre', () => {
    expect(scopeSummary(null)).toBe('Toutes les opérations');
    expect(scopeSummary([])).toBe('Toutes les opérations');
    expect(scopeSummary(['op-1'])).toBe('1 opération');
    expect(scopeSummary(['op-1', 'op-2'])).toBe('2 opérations');
  });
});
