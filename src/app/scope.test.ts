import { describe, it, expect } from 'vitest';
import { resolveOperationScope, resolveRole } from './scope';

describe('resolveOperationScope — miroir de ao_user_operations (RLS)', () => {
  it('aucune ligne ⇒ null (toutes les opérations du tenant)', () => {
    expect(resolveOperationScope(null)).toBeNull();
    expect(resolveOperationScope(undefined)).toBeNull();
    expect(resolveOperationScope([])).toBeNull();
  });

  it('des lignes ⇒ périmètre restreint aux operation_id', () => {
    expect(resolveOperationScope([{ operation_id: 'op-1' }, { operation_id: 'op-2' }])).toEqual(['op-1', 'op-2']);
  });

  it('déduplique en préservant l’ordre', () => {
    expect(resolveOperationScope([{ operation_id: 'op-1' }, { operation_id: 'op-1' }, { operation_id: 'op-2' }]))
      .toEqual(['op-1', 'op-2']);
  });

  it('ignore les operation_id vides et retombe sur null si rien de valide', () => {
    expect(resolveOperationScope([{ operation_id: '' }])).toBeNull();
  });
});

describe('resolveRole — rôle de session depuis ao_tenant_roles', () => {
  it('aucune ligne ⇒ fallback (user_tenants.role)', () => {
    expect(resolveRole(null, 'moa_director')).toBe('moa_director');
    expect(resolveRole([], 'viewer')).toBe('viewer');
  });

  it('choisit le rôle le plus privilégié (ordre ROLES)', () => {
    expect(resolveRole([{ role: 'site' }, { role: 'finance' }, { role: 'viewer' }], 'viewer')).toBe('finance');
    expect(resolveRole([{ role: 'viewer' }, { role: 'owner' }], 'viewer')).toBe('owner');
  });

  it('ignore les rôles inconnus et retombe sur le fallback si aucun connu', () => {
    expect(resolveRole([{ role: 'moe' }], 'viewer')).toBe('viewer'); // 'moe' hors vocabulaire app
    expect(resolveRole([{ role: 'inconnu' }, { role: 'commercial' }], 'viewer')).toBe('commercial');
  });
});
