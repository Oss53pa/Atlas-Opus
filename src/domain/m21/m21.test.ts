import { describe, it, expect } from 'vitest';
import { consolidateAlerts, severityRank, countBySeverity } from './cockpit';
import type { ConsolidatedAlert } from './types';

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
