import { describe, expect, it } from 'vitest';
import { Money } from '../money/Money';
import {
  activeOpportunities, canConvert, chargeAuM2, chargeFonciereAdmissible, constructibilityRatio,
  margeDeNegociation, scoreOpportunity, suggestedDecision,
} from './landOpportunity';
import type { LandOpportunity } from './types';

const X = 'XOF';
const opp = (over: Partial<LandOpportunity> = {}): LandOpportunity => ({
  id: 'o1', tenantId: 't', reference: 'OPP-01', name: 'Parcelle Cocody', propertyType: 'terrain_nu',
  countryCode: 'CI', city: 'Abidjan', totalSurface: 2000, buildableSurface: 4000,
  priceAsked: 400_000_000, estimatedValue: 500_000_000, status: 'negociation', decision: 'pending',
  probability: 0.6, discoveryDate: '2026-01-10', decisionDeadline: null, notes: null, operationId: null, ...over,
});

describe('M2 amont — charge foncière', () => {
  it('retranche coûts et marge cible du chiffre d’affaires', () => {
    const r = chargeFonciereAdmissible({
      caPrevisionnel: Money.of(3_000_000_000, X),
      coutsConstruction: Money.of(1_800_000_000, X),
      autresCouts: Money.of(400_000_000, X),
      margeCibleRate: 0.12,
    });
    expect(r.margeCible.toMajorString()).toBe('360000000.00');
    expect(r.chargeAdmissible.toMajorString()).toBe('440000000.00');
  });

  it('devient négative quand l’opération ne dégage pas la marge cible', () => {
    const r = chargeFonciereAdmissible({
      caPrevisionnel: Money.of(1_000_000_000, X), coutsConstruction: Money.of(950_000_000, X),
      autresCouts: Money.of(100_000_000, X), margeCibleRate: 0.1,
    });
    expect(r.chargeAdmissible.isNegative()).toBe(true);
  });

  it('ramène la charge au m² constructible, au centime exact', () => {
    expect(chargeAuM2(Money.of(440_000_000, X), 4000)?.toMajorString()).toBe('110000.00');
    expect(chargeAuM2(Money.of(100_000_000, X), 3)?.toMajorString()).toBe('33333333.33');
    expect(chargeAuM2(Money.of(440_000_000, X), 0)).toBeNull();
  });

  it('signe la marge de négociation', () => {
    expect(margeDeNegociation(Money.of(440_000_000, X), Money.of(400_000_000, X)).toMajorString()).toBe('40000000.00');
    expect(margeDeNegociation(Money.of(300_000_000, X), Money.of(400_000_000, X)).isNegative()).toBe(true);
  });
});

describe('M2 amont — scoring & arbitrage', () => {
  it('calcule le ratio de constructibilité', () => {
    expect(constructibilityRatio(opp())).toBe(2);
    expect(constructibilityRatio(opp({ totalSurface: 0 }))).toBe(0);
  });

  it('pondère plus-value, constructibilité, probabilité et cycle', () => {
    // 0,4×0,25 + 0,25×(2/3) + 0,25×0,6 + 0,1×0,8 = 0,4967 → 50
    expect(scoreOpportunity(opp())).toBe(50);
    expect(scoreOpportunity(opp({ status: 'abandonnee' }))).toBe(42);
  });

  it('suggère une décision selon le score', () => {
    expect(suggestedDecision(75)).toBe('go');
    expect(suggestedDecision(45)).toBe('conditional_go');
    expect(suggestedDecision(30)).toBe('postponed');
    expect(suggestedDecision(10)).toBe('no_go');
  });

  it('ne convertit qu’une fois, sur décision favorable', () => {
    expect(canConvert(opp({ decision: 'go' }))).toBe(true);
    expect(canConvert(opp({ decision: 'no_go' }))).toBe(false);
    expect(canConvert(opp({ decision: 'go', operationId: 'op-1' }))).toBe(false);
  });

  it('isole les opportunités encore à l’étude', () => {
    const l = [opp(), opp({ id: 'b', status: 'acquise' }), opp({ id: 'c', status: 'abandonnee' })];
    expect(activeOpportunities(l).map((o) => o.id)).toEqual(['o1']);
  });
});
