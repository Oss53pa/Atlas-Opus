import { describe, it, expect } from 'vitest';
import { canTransitionRisk } from './m20/risks';
import { canTransitionSale } from './m6/commercialisation';
import { canTransitionDocument } from './ged/documents';
import { canTransitionOffer } from './m9/analysis';
import { canTransitionDrawdown } from './m5/financing';

// Machines à états ajoutées pour le gate « machines à états gardées ».
describe('Machines à états — transitions légales vs illégales', () => {
  it('risque : ouvert→maîtrisé légal, réouverture clos→ouvert, saut clos→maîtrisé illégal', () => {
    expect(canTransitionRisk('ouvert', 'maitrise')).toBe(true);
    expect(canTransitionRisk('clos', 'ouvert')).toBe(true);
    expect(canTransitionRisk('clos', 'maitrise')).toBe(false);
    expect(canTransitionRisk('ouvert', 'ouvert')).toBe(false); // idempotence gérée en amont
  });

  it('vente : draft→active→soldée, saut draft→soldée illégal, soldée terminal', () => {
    expect(canTransitionSale('draft', 'active')).toBe(true);
    expect(canTransitionSale('active', 'soldee')).toBe(true);
    expect(canTransitionSale('draft', 'soldee')).toBe(false);
    expect(canTransitionSale('soldee', 'active')).toBe(false);
  });

  it('document : en_cours→diffusé→visa, saut en_cours→visa illégal, reprise visa→en_cours', () => {
    expect(canTransitionDocument('en_cours', 'diffuse')).toBe(true);
    expect(canTransitionDocument('diffuse', 'vise_a')).toBe(true);
    expect(canTransitionDocument('en_cours', 'vise_a')).toBe(false);
    expect(canTransitionDocument('vise_c', 'en_cours')).toBe(true);
  });

  it('offre : reçue→conforme→retenue, saut reçue→retenue illégal, retenue terminal', () => {
    expect(canTransitionOffer('recu', 'conforme')).toBe(true);
    expect(canTransitionOffer('conforme', 'retenu')).toBe(true);
    expect(canTransitionOffer('recu', 'retenu')).toBe(false);
    expect(canTransitionOffer('retenu', 'ecarte')).toBe(false);
  });

  it('tranche : planifié→demandé→débloqué, saut planifié→débloqué illégal', () => {
    expect(canTransitionDrawdown('planifie', 'demande')).toBe(true);
    expect(canTransitionDrawdown('demande', 'debloque')).toBe(true);
    expect(canTransitionDrawdown('planifie', 'debloque')).toBe(false);
    expect(canTransitionDrawdown('debloque', 'demande')).toBe(false);
  });
});
