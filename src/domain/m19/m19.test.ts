import { describe, it, expect } from 'vitest';
import { openReservesCount, majorOpenCount, clearedCount, canPronounceReception } from './reception';
import type { Reserve } from './types';

const r = (severity: Reserve['severity'], status: Reserve['status']): Pick<Reserve, 'severity' | 'status'> => ({ severity, status });

describe('M19 — réserves', () => {
  it('compte ouvertes / majeures ouvertes / levées', () => {
    const list = [r('majeure', 'ouverte'), r('mineure', 'ouverte'), r('majeure', 'levee')];
    expect(openReservesCount(list)).toBe(2);
    expect(majorOpenCount(list)).toBe(1);
    expect(clearedCount(list)).toBe(1);
  });
});

describe('M19 — garde de réception (RG-M19)', () => {
  it('bloquée tant qu’une réserve majeure est ouverte', () => {
    expect(canPronounceReception([r('majeure', 'ouverte')])).toEqual({ ok: false, blocking: 1 });
  });
  it('prononçable si seules des réserves mineures restent ouvertes', () => {
    expect(canPronounceReception([r('mineure', 'ouverte'), r('majeure', 'levee')])).toEqual({ ok: true, blocking: 0 });
  });
  it('prononçable si aucune réserve', () => {
    expect(canPronounceReception([])).toEqual({ ok: true, blocking: 0 });
  });
});
