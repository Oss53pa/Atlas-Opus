import { describe, it, expect } from 'vitest';
import { consolidateAlerts, severityRank, countBySeverity, deriveOperationAlerts, riskScore, type OperationAlertFacts } from './cockpit';
import type { ConsolidatedAlert } from './types';

const facts = (over: Partial<OperationAlertFacts> = {}): OperationAlertFacts => ({
  phase: 'realisation',
  status: 'active',
  endDate: null,
  today: '2026-08-22',
  margeNegative: false,
  budgetOverrun: false,
  recettesRealiseesZero: false,
  ...over,
});

const a = (source: string, severity: ConsolidatedAlert['severity'], labelKey: string): ConsolidatedAlert => ({
  source,
  severity,
  labelKey: labelKey as ConsolidatedAlert['labelKey'],
});

describe('M21 — priorisation des alertes (RG-M21-02)', () => {
  it('severityRank : danger < échéance < info', () => {
    expect(severityRank('danger')).toBeLessThan(severityRank('echeance'));
    expect(severityRank('echeance')).toBeLessThan(severityRank('info'));
  });

  it('trie danger > échéance > info', () => {
    const input = [
      a('m4', 'info', 'x'),
      a('m7', 'danger', 'y'),
      a('m2', 'echeance', 'z'),
    ];
    expect(consolidateAlerts(input).map((x) => x.severity)).toEqual(['danger', 'echeance', 'info']);
  });

  it('tri stable à sévérité égale (ordre d’agrégation conservé)', () => {
    const input = [
      a('m4', 'danger', 'first'),
      a('m7', 'danger', 'second'),
      a('m2', 'info', 'last'),
    ];
    expect(consolidateAlerts(input).map((x) => x.labelKey)).toEqual(['first', 'second', 'last']);
  });

  it('countBySeverity', () => {
    const input = [a('m4', 'danger', 'a'), a('m7', 'danger', 'b'), a('m2', 'echeance', 'c')];
    expect(countBySeverity(input, 'danger')).toBe(2);
    expect(countBySeverity(input, 'echeance')).toBe(1);
    expect(countBySeverity(input, 'info')).toBe(0);
  });

  it('liste vide → vide', () => {
    expect(consolidateAlerts([])).toEqual([]);
  });
});

describe('M21 — dérivation des alertes d’opération', () => {
  it('marge négative → danger ; dépassement BAC → danger', () => {
    const a = deriveOperationAlerts(facts({ margeNegative: true, budgetOverrun: true }));
    expect(a.map((x) => x.labelKey)).toEqual(['alerts.marginNegative', 'alerts.budgetOverrun']);
    expect(a.every((x) => x.severity === 'danger')).toBe(true);
  });

  it('aucune recette en phase réalisation → échéance ; ignorée en amont', () => {
    expect(deriveOperationAlerts(facts({ recettesRealiseesZero: true })).some((x) => x.labelKey === 'alerts.noRevenue')).toBe(true);
    expect(deriveOperationAlerts(facts({ phase: 'amont', recettesRealiseesZero: true })).length).toBe(0);
  });

  it('livraison dépassée & active → échéance', () => {
    expect(deriveOperationAlerts(facts({ endDate: '2026-01-01' })).some((x) => x.labelKey === 'alerts.deadlinePassed')).toBe(true);
    expect(deriveOperationAlerts(facts({ endDate: '2026-01-01', status: 'closed' })).length).toBe(0);
  });

  it('riskScore : danger pèse plus que échéance', () => {
    const danger = deriveOperationAlerts(facts({ margeNegative: true }));
    const echeance = deriveOperationAlerts(facts({ endDate: '2026-01-01' }));
    expect(riskScore(danger)).toBeGreaterThan(riskScore(echeance));
    expect(riskScore([])).toBe(0);
  });
});
