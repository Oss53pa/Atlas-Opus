import { describe, it, expect } from 'vitest';
import { Money } from '../money/Money';
import {
  bilanSummary,
  cpi,
  spi,
  eac,
  etc,
  vac,
  amountNet,
  penaliteRetard,
  type BilanLine,
} from './bilan';
import { tri, npv } from './tri';
import { echeancierVefa, interetsIntercalaires, appelDeFonds, deblocageAutorise } from './vefa';

const X = 'XOF';
const m = (v: string) => Money.of(v, X);

describe('Bilan §6', () => {
  const lines: BilanLine[] = [
    { kind: 'cost', amount: m('1000') },
    { kind: 'cost', amount: m('500') },
    { kind: 'revenue', amount: m('2000') },
  ];
  it('coût / recettes / marge / taux', () => {
    const s = bilanSummary(lines, X);
    expect(s.coutTotal.equals(m('1500'))).toBe(true);
    expect(s.recettes.equals(m('2000'))).toBe(true);
    expect(s.marge.equals(m('500'))).toBe(true);
    expect(s.tauxMarge).toBeCloseTo(0.3333, 3);
  });
  it('taux nul si coût nul', () => {
    expect(bilanSummary([{ kind: 'revenue', amount: m('10') }], X).tauxMarge).toBe(0);
  });
});

describe('EVM §6', () => {
  it('CPI / SPI / EAC / ETC / VAC', () => {
    expect(cpi(m('600'), m('500'))).toBeCloseTo(1.2, 6);
    expect(spi(m('600'), m('500'))).toBeCloseTo(1.2, 6);
    expect(eac(m('1000'), 1.25).equals(m('800'))).toBe(true);
    expect(etc(m('800'), m('500')).equals(m('300'))).toBe(true);
    expect(vac(m('1000'), m('800')).equals(m('200'))).toBe(true);
  });
});

describe('Paiements §6', () => {
  it('amount_net', () => {
    expect(amountNet(m('1000'), m('50'), m('100')).equals(m('850'))).toBe(true);
  });
  it('pénalité de retard plafonnée', () => {
    expect(penaliteRetard(m('1000'), 0.01, 10).equals(m('100'))).toBe(true);
    expect(penaliteRetard(m('1000'), 0.01, 10, m('50')).equals(m('50'))).toBe(true);
  });
});

describe('TRI §6', () => {
  it('annule la VAN sur une série connue', () => {
    const r = tri([-1000, 600, 600]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.1306, 3);
    expect(npv(r!, [-1000, 600, 600])).toBeCloseTo(0, 4);
  });
  it('null si flux de même signe', () => {
    expect(tri([100, 200, 300])).toBeNull();
  });
});

describe('VEFA §6', () => {
  it('appel de fonds = prix × pourcentage', () => {
    expect(appelDeFonds(m('100000000'), 0.35).equals(m('35000000'))).toBe(true);
  });
  it('échéancier : cumul final = prix, incréments somment au prix', () => {
    const prix = m('100000000');
    const ech = echeancierVefa(prix, [
      { key: 'fondations', pct: 0.35 },
      { key: 'hors_eau', pct: 0.7 },
      { key: 'livraison', pct: 1.0 },
    ]);
    expect(ech[ech.length - 1].cumul.equals(prix)).toBe(true);
    const sommeIncr = ech.reduce((acc, e) => acc.add(e.increment), Money.zero(X));
    expect(sommeIncr.equals(prix)).toBe(true);
    expect(ech[0].increment.equals(m('35000000'))).toBe(true);
  });
  it('intérêts intercalaires = capital × taux × durée', () => {
    expect(interetsIntercalaires(m('1000000'), 0.08, 2).equals(m('160000'))).toBe(true);
  });
  it('déblocage conditionné à l’avancement', () => {
    expect(deblocageAutorise(0.7, 0.6)).toBe(true);
    expect(deblocageAutorise(0.5, 0.6)).toBe(false);
  });
});
