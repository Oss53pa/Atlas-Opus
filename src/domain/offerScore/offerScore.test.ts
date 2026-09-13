import { describe, it, expect } from 'vitest';
import { weightedFor, offerTotal, rankOffers, scoreOf } from './offerScore';
import type { OfferScore } from './types';

const sc = (over: Partial<OfferScore> = {}): OfferScore => ({
  id: 's', tenantId: 't', operationId: 'op', offerId: 'o1', criteriaId: 'c1', rawScore: 80, weightedScore: 32, ...over,
});

describe('offerScore — notation & classement', () => {
  it('weightedFor = brute × poids', () => {
    expect(weightedFor(80, 0.4)).toBeCloseTo(32);
    expect(weightedFor(100, 0.15)).toBeCloseTo(15);
  });

  it('offerTotal somme les notes pondérées', () => {
    expect(offerTotal([sc({ weightedScore: 32 }), sc({ weightedScore: 28 })])).toBeCloseTo(60);
    expect(offerTotal([])).toBe(0);
  });

  it('scoreOf retrouve la note d\'un couple offre/critère', () => {
    const scores = [sc({ offerId: 'o1', criteriaId: 'c1' }), sc({ offerId: 'o1', criteriaId: 'c2', rawScore: 70 })];
    expect(scoreOf(scores, 'o1', 'c2')?.rawScore).toBe(70);
    expect(scoreOf(scores, 'o2', 'c1')).toBeUndefined();
  });

  it('rankOffers classe par note pondérée décroissante, offres sans note à 0', () => {
    const offers = [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }];
    const scores = [
      sc({ offerId: 'o1', weightedScore: 30 }), sc({ offerId: 'o1', criteriaId: 'c2', weightedScore: 25 }), // total 55
      sc({ offerId: 'o2', weightedScore: 82 }), // total 82
    ];
    const rank = rankOffers(offers, scores);
    expect(rank.map((r) => r.offer.id)).toEqual(['o2', 'o1', 'o3']);
    expect(rank[0]).toMatchObject({ total: 82, rank: 1 });
    expect(rank[1]).toMatchObject({ total: 55, scored: 2, rank: 2 });
    expect(rank[2]).toMatchObject({ total: 0, scored: 0, rank: 3 }); // o3 non noté
  });

  it('rankOffers ne mute pas la liste d\'offres', () => {
    const offers = [{ id: 'a' }, { id: 'b' }];
    rankOffers(offers, [sc({ offerId: 'b', weightedScore: 99 })]);
    expect(offers.map((o) => o.id)).toEqual(['a', 'b']);
  });
});
