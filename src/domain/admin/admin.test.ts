import { describe, it, expect } from 'vitest';
import { thresholdRole, tasksForMe, unreadCount, countBySeverity, activeMembers, distinctRoles, DEFAULT_THRESHOLDS } from './admin';

describe('admin — routage par seuil (RG-M14-03)', () => {
  it('≤ 10 M → AMO', () => {
    expect(thresholdRole(5_000_000)).toBe('amo');
    expect(thresholdRole(10_000_000)).toBe('amo');
  });
  it('10–50 M → directeur d’opération', () => {
    expect(thresholdRole(10_000_001)).toBe('moa_director');
    expect(thresholdRole(50_000_000)).toBe('moa_director');
  });
  it('> 50 M → comité (owner)', () => {
    expect(thresholdRole(50_000_001)).toBe('owner');
    expect(thresholdRole(398_000_000)).toBe('owner');
  });
  it('utilise la valeur absolue (avenant négatif)', () => {
    expect(thresholdRole(-64_000_000)).toBe('owner');
  });
  it('paliers non ordonnés donnent le même résultat', () => {
    const shuffled = [DEFAULT_THRESHOLDS[2], DEFAULT_THRESHOLDS[0], DEFAULT_THRESHOLDS[1]];
    expect(thresholdRole(20_000_000, shuffled)).toBe('moa_director');
  });
});

describe('admin — compteurs', () => {
  it('tasksForMe / unreadCount / countBySeverity', () => {
    expect(tasksForMe([{ forMe: true }, { forMe: false }, { forMe: true }])).toBe(2);
    expect(unreadCount([{ read: false }, { read: true }, { read: false }])).toBe(2);
    expect(countBySeverity([{ severity: 'danger' }, { severity: 'info' }, { severity: 'danger' }], 'danger')).toBe(2);
  });
  it('activeMembers / distinctRoles', () => {
    const members = [
      { status: 'actif' as const, role: 'moa_director' as const },
      { status: 'actif' as const, role: 'finance' as const },
      { status: 'en_attente' as const, role: 'viewer' as const },
    ];
    expect(activeMembers(members)).toBe(2);
    expect(distinctRoles(members)).toBe(3);
  });
});
