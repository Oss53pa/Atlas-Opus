import { describe, it, expect } from 'vitest';
import {
  totalShares, isCapitalBalanced, majorityHolder, hasControllingHolder,
  registeredCount, activeCount, canTransitionLegalEntity, nextStatuses,
} from './legalEntity';
import type { LegalEntity, Shareholder } from './types';

const sh = (name: string, sharePct: number): Shareholder => ({ name, sharePct });

const e = (over: Partial<LegalEntity> = {}): LegalEntity => ({
  id: 'e', tenantId: 't', operationId: 'op', structureType: 'sci', name: 'SCI Palmiers',
  rccm: null, shareholders: [], status: 'projet', ...over,
});

describe('legalEntity — capital', () => {
  it('totalShares somme les quotes-parts', () => {
    expect(totalShares([sh('A', 60), sh('B', 40)])).toBe(100);
    expect(totalShares([])).toBe(0);
  });

  it('isCapitalBalanced : 100 % à 0,01 près', () => {
    expect(isCapitalBalanced([sh('A', 60), sh('B', 40)])).toBe(true);
    expect(isCapitalBalanced([sh('A', 60), sh('B', 39.995)])).toBe(true); // arrondi toléré
    expect(isCapitalBalanced([sh('A', 60), sh('B', 30)])).toBe(false);
    expect(isCapitalBalanced([])).toBe(false);
  });

  it('majorityHolder / hasControllingHolder', () => {
    expect(majorityHolder([sh('A', 51), sh('B', 49)])?.name).toBe('A');
    expect(hasControllingHolder([sh('A', 51), sh('B', 49)])).toBe(true);
    expect(hasControllingHolder([sh('A', 50), sh('B', 50)])).toBe(false); // 50 % n'est pas > 50
    expect(majorityHolder([])).toBeNull();
  });

  it('registeredCount / activeCount', () => {
    const list = [e({ rccm: 'CI-ABJ-2026-B-1234', status: 'active' }), e({ rccm: '   ' }), e({ rccm: null })];
    expect(registeredCount(list)).toBe(1);
    expect(activeCount(list)).toBe(1);
  });
});

describe('legalEntity — machine à états', () => {
  it('transitions autorisées', () => {
    expect(canTransitionLegalEntity('projet', 'constituee')).toBe(true);
    expect(canTransitionLegalEntity('constituee', 'active')).toBe(true);
    expect(canTransitionLegalEntity('active', 'dissoute')).toBe(true);
  });
  it('transitions interdites', () => {
    expect(canTransitionLegalEntity('projet', 'active')).toBe(false); // pas de saut
    expect(canTransitionLegalEntity('dissoute', 'active')).toBe(false); // terminal
  });
  it('nextStatuses reflète la machine', () => {
    expect(nextStatuses('projet')).toEqual(['constituee', 'dissoute']);
    expect(nextStatuses('dissoute')).toEqual([]);
  });
});
