import { describe, it, expect } from 'vitest';
import { severityRank, isActive, evaluateRules, firedRules, countBySeverity, highestFiredSeverity } from './alertRule';
import type { AlertRule } from './types';

const r = (over: Partial<AlertRule> = {}): AlertRule => ({
  id: 'r', tenantId: 't', metric: 'retard_jours', threshold: 10, severity: 'warning', ...over,
});

describe('alertRule — évaluation des seuils', () => {
  it('severityRank ordonne info < warning < critical', () => {
    expect(severityRank('info')).toBe(0);
    expect(severityRank('critical')).toBe(2);
    expect(severityRank('critical')).toBeGreaterThan(severityRank('warning'));
  });

  it('isActive : seuil défini', () => {
    expect(isActive(r({ threshold: 5 }))).toBe(true);
    expect(isActive(r({ threshold: null }))).toBe(false);
  });

  it('evaluateRules : déclenche si valeur ≥ seuil ; null si métrique absente', () => {
    const rules = [
      r({ id: 'a', metric: 'retard_jours', threshold: 10 }),
      r({ id: 'b', metric: 'reserves_ouvertes', threshold: 3 }),
      r({ id: 'c', metric: 'sinistres_ouverts', threshold: 1 }), // absente de l'instantané
      r({ id: 'd', metric: 'retard_jours', threshold: null }),   // inactive
    ];
    const snap = { retard_jours: 12, reserves_ouvertes: 2 };
    const ev = evaluateRules(rules, snap);
    expect(ev.find((e) => e.rule.id === 'a')).toMatchObject({ value: 12, fired: true }); // 12 ≥ 10
    expect(ev.find((e) => e.rule.id === 'b')).toMatchObject({ value: 2, fired: false }); // 2 < 3
    expect(ev.find((e) => e.rule.id === 'c')).toMatchObject({ value: null, fired: false }); // absente
    expect(ev.find((e) => e.rule.id === 'd')).toMatchObject({ fired: false }); // inactive
  });

  it('evaluateRules : seuil atteint exactement déclenche (≥)', () => {
    expect(evaluateRules([r({ threshold: 10 })], { retard_jours: 10 })[0].fired).toBe(true);
  });

  it('firedRules : seules les déclenchées, triées par sévérité décroissante', () => {
    const rules = [
      r({ id: 'w', metric: 'retard_jours', threshold: 5, severity: 'warning' }),
      r({ id: 'c', metric: 'reserves_ouvertes', threshold: 2, severity: 'critical' }),
    ];
    const fired = firedRules(rules, { retard_jours: 9, reserves_ouvertes: 4 });
    expect(fired.map((e) => e.rule.id)).toEqual(['c', 'w']); // critical d'abord
  });

  it('countBySeverity / highestFiredSeverity', () => {
    const rules = [r({ severity: 'info' }), r({ severity: 'warning' }), r({ severity: 'critical' })];
    expect(countBySeverity(rules)).toEqual({ info: 1, warning: 1, critical: 1 });
    const ev = evaluateRules([r({ metric: 'm', threshold: 1, severity: 'warning' }), r({ metric: 'm', threshold: 1, severity: 'critical' })], { m: 5 });
    expect(highestFiredSeverity(ev)).toBe('critical');
    expect(highestFiredSeverity(evaluateRules([r({ threshold: 100 })], { retard_jours: 1 }))).toBeNull();
  });
});
