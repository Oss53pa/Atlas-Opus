import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import { vat, retenueSource, retenueGarantie, fiscalContext, computePayment, revisionCoefficient, reviseAmount } from './fiscal';

const XOF = 'XOF';
const m = (major: number) => Money.of(major, XOF);

describe('F6 — TVA & retenues (Money.ts)', () => {
  it('TVA = base × taux (UEMOA 18 %)', () => {
    expect(vat(m(100_000_000), 0.18).toMajorNumber()).toBe(18_000_000);
  });
  it('retenue à la source = base × taux', () => {
    expect(retenueSource(m(100_000_000), 0.05).toMajorNumber()).toBe(5_000_000);
  });
  it('retenue de garantie = brut × taux', () => {
    expect(retenueGarantie(m(100_000_000), 0.05).toMajorNumber()).toBe(5_000_000);
  });
});

describe('F6 — contexte fiscal (country_config, jamais codé en dur)', () => {
  it('CI (UEMOA) : TVA 18 %, précompte travaux 5 %', () => {
    const ctx = fiscalContext('CI', 'travaux', 0.05);
    expect(ctx).toEqual({ vatRate: 0.18, whtRate: 0.05, retentionRate: 0.05 });
  });
  it('CM (CEMAC) : TVA 19,25 %', () => {
    expect(fiscalContext('CM', 'services', 0.05).vatRate).toBe(0.1925);
  });
  it('pays inconnu → taux nuls (dégradé sûr)', () => {
    expect(fiscalContext('ZZ', 'travaux', 0.05)).toEqual({ vatRate: 0, whtRate: 0, retentionRate: 0.05 });
  });
});

describe('F6 — net à payer (§7)', () => {
  it('chaîne complète : base + TVA − source − garantie − avance − pénalités', () => {
    // brut 100M, TVA 18 %, WHT 5 %, garantie 5 %, avance 10M, pénalités 2M.
    const b = computePayment({
      brut: m(100_000_000), vatRate: 0.18, whtRate: 0.05, retentionRate: 0.05,
      avanceRemboursee: m(10_000_000), penalites: m(2_000_000),
    });
    expect(b.baseHT.toMajorNumber()).toBe(100_000_000);
    expect(b.tva.toMajorNumber()).toBe(18_000_000);
    expect(b.retenueSource.toMajorNumber()).toBe(5_000_000);
    expect(b.retenueGarantie.toMajorNumber()).toBe(5_000_000);
    // 100 + 18 − 5 − 5 − 10 − 2 = 96 M
    expect(b.netAPayer.toMajorNumber()).toBe(96_000_000);
  });

  it('avance/pénalités par défaut à zéro ; déterministe', () => {
    const b = computePayment({ brut: m(50_000_000), vatRate: 0.18, whtRate: 0.05, retentionRate: 0.05 });
    // 50 + 9 − 2.5 − 2.5 = 54 M
    expect(b.netAPayer.toMajorNumber()).toBe(54_000_000);
    expect(computePayment({ brut: m(50_000_000), vatRate: 0.18, whtRate: 0.05, retentionRate: 0.05 })).toEqual(b);
  });
});

describe('F6 — révision de prix (v4.1)', () => {
  it('coefficient = a0 + Σ a_i·I/I0', () => {
    // 0.15 + 0.85 × 130/100 = 0.15 + 1.105 = 1.255
    expect(revisionCoefficient(0.15, [{ weight: 0.85, index: 130, index0: 100 }])).toBeCloseTo(1.255, 6);
  });
  it('montant révisé = base × coefficient', () => {
    expect(reviseAmount(m(100_000_000), 0.15, [{ weight: 0.85, index: 130, index0: 100 }]).toMajorNumber()).toBe(125_500_000);
  });
  it('indice de référence nul → terme ignoré (garde-fou)', () => {
    expect(revisionCoefficient(1, [{ weight: 0.5, index: 120, index0: 0 }])).toBe(1);
  });
});
