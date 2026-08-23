import { describe, it, expect } from 'vitest';
import { financialScore, globalScore, rankOffers, isAdmissible, meetsTechnicalThreshold } from './analysis';
import type { Offer } from './types';

const o = (id: string, amount: number, tech: number, status: Offer['status'] = 'conforme'): Offer => ({
  id, tenantId: 't', operationId: 'op', tenderId: 'td', bidder: id, amount, scoreTechnical: tech, status,
});

describe('M9 — notes', () => {
  it('note financière : mieux-disant = 100', () => {
    expect(financialScore(100, 100)).toBe(100);
    expect(financialScore(200, 100)).toBe(50);
    expect(financialScore(0, 100)).toBe(0);
  });
  it('note globale pondérée 60/40', () => {
    expect(globalScore(80, 100)).toBeCloseTo(88, 6); // 0.6*80 + 0.4*100
  });
  it('admissibilité & seuil technique', () => {
    expect(isAdmissible('ecarte')).toBe(false);
    expect(isAdmissible('conforme')).toBe(true);
    expect(meetsTechnicalThreshold(70)).toBe(true);
    expect(meetsTechnicalThreshold(69)).toBe(false);
  });
});

describe('M9 — classement', () => {
  it('classe par note globale décroissante, exclut les écartées', () => {
    const offers = [
      o('A', 120, 90),           // fin = 100/120*100=83.33 ; glob=0.6*90+0.4*83.33=87.33
      o('B', 100, 80),           // fin = 100 ; glob=0.6*80+0.4*100=88
      o('C', 100, 95, 'ecarte'), // exclue
    ];
    const ranked = rankOffers(offers);
    expect(ranked.map((r) => r.offer.id)).toEqual(['B', 'A']);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].scoreGlobal).toBeCloseTo(88, 4);
  });
  it('aucune offre admissible → classement vide', () => {
    expect(rankOffers([o('X', 100, 90, 'ecarte')])).toEqual([]);
  });
});
