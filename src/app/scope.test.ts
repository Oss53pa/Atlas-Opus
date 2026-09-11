import { describe, it, expect } from 'vitest';
import { resolveOperationScope } from './scope';

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
