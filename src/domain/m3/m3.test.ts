import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { nextStudyStatus, canTransitionStudy, validatedCount, studiesCleared, studiesCostTotal } from './studies';
import type { Study } from './types';

const XOF = 'XOF';
const s = (status: Study['status'], cost = 0): Pick<Study, 'status' | 'cost'> => ({ status, cost });

describe('M3 — machine d’étude', () => {
  it('cycle planifiée → en_cours → remise → validée', () => {
    expect(nextStudyStatus('planifiee')).toBe('en_cours');
    expect(nextStudyStatus('en_cours')).toBe('remise');
    expect(nextStudyStatus('remise')).toBe('validee');
    expect(nextStudyStatus('validee')).toBeNull();
  });
  it('renvoi remise → en_cours autorisé ; sauts interdits', () => {
    expect(canTransitionStudy('remise', 'en_cours')).toBe(true);
    expect(canTransitionStudy('planifiee', 'validee')).toBe(false);
    expect(canTransitionStudy('en_cours', 'remise')).toBe(true);
  });
});

describe('M3 — garde & cumuls', () => {
  it('validatedCount compte les études validées', () => {
    expect(validatedCount([s('validee'), s('remise'), s('validee')])).toBe(2);
  });
  it('studiesCleared : vrai seulement si non vide et toutes validées', () => {
    expect(studiesCleared([])).toBe(false);
    expect(studiesCleared([s('validee'), s('remise')])).toBe(false);
    expect(studiesCleared([s('validee'), s('validee')])).toBe(true);
  });
  it('studiesCostTotal cumule via Money.ts', () => {
    const total = studiesCostTotal([s('validee', 12_000_000), s('en_cours', 8_000_000)], XOF);
    expect(total.equals(Money.of(20_000_000, XOF))).toBe(true);
  });
});
