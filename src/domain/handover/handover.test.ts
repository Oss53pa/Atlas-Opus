import { describe, it, expect } from 'vitest';
import { doeCompletion, categoryCompletion, categoryStatus, canTransfer } from './handover';
import type { DoeCategory, HandoverFile } from './types';

const cat = (key: DoeCategory['key'], expected: number, received: number): DoeCategory => ({
  key, responsible: 'x', expected, received,
});

describe('handover — complétude DOE', () => {
  it('doeCompletion agrège attendus/reçus', () => {
    const doe = [cat('plans_asbuilt', 86, 34), cat('notices', 42, 18)];
    expect(doeCompletion(doe)).toBeCloseTo((34 + 18) / (86 + 42));
  });

  it('doeCompletion = 0 si rien attendu', () => {
    expect(doeCompletion([])).toBe(0);
    expect(doeCompletion([cat('notices', 0, 0)])).toBe(0);
  });

  it('categoryCompletion et categoryStatus par seuil', () => {
    expect(categoryCompletion(cat('notices', 100, 40))).toBeCloseTo(0.4);
    expect(categoryStatus(cat('notices', 100, 40))).toBe('incomplet');
    expect(categoryStatus(cat('notices', 100, 60))).toBe('en_cours');
    expect(categoryStatus(cat('notices', 100, 100))).toBe('complet');
  });
});

describe('handover — RG-M20-01 conditions du transfert', () => {
  const file = (received: number, exportReady: boolean): Pick<HandoverFile, 'doe' | 'exportReady'> => ({
    doe: [cat('plans_asbuilt', 100, received)],
    exportReady,
  });

  it('bloque si DOE incomplet, réception non prononcée ou export non prêt', () => {
    expect(canTransfer(file(100, true), false)).toBe(false); // réception non prononcée
    expect(canTransfer(file(50, true), true)).toBe(false); // DOE incomplet
    expect(canTransfer(file(100, false), true)).toBe(false); // export non prêt
  });

  it('autorise quand tout est réuni', () => {
    expect(canTransfer(file(100, true), true)).toBe(true);
  });
});
