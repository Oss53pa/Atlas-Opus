import { describe, it, expect } from 'vitest';
import { canVisa, isApproved, isRefused, approvedCount, pendingVisaCount, refusedCount, nextIndice } from './documents';
import type { Document } from './types';

const d = (status: Document['status']): Pick<Document, 'status'> => ({ status });

describe('M11 — GED & visa', () => {
  it('visa possible seulement si diffusé', () => {
    expect(canVisa('diffuse')).toBe(true);
    expect(canVisa('en_cours')).toBe(false);
    expect(canVisa('vise_a')).toBe(false);
  });
  it('approuvé = visa A ou B ; refusé = visa C', () => {
    expect(isApproved('vise_a')).toBe(true);
    expect(isApproved('vise_b')).toBe(true);
    expect(isApproved('vise_c')).toBe(false);
    expect(isRefused('vise_c')).toBe(true);
  });
  it('compteurs', () => {
    const list = [d('vise_a'), d('vise_b'), d('diffuse'), d('vise_c'), d('en_cours')];
    expect(approvedCount(list)).toBe(2);
    expect(pendingVisaCount(list)).toBe(1);
    expect(refusedCount(list)).toBe(1);
  });
  it('indice suivant', () => {
    expect(nextIndice('A')).toBe('B');
    expect(nextIndice('c')).toBe('D');
    expect(nextIndice('Z')).toBe('Z');
  });
});
