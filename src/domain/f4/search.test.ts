import { describe, expect, it } from 'vitest';
import { normalize, search, type SearchItem } from './search';

const items: SearchItem[] = [
  { kind: 'operation', id: 'op-1', label: 'Résidence Les Palmiers', sublabel: 'CI' },
  { kind: 'operation', id: 'op-2', label: 'Palmeraie Plateau', sublabel: 'CI' },
  { kind: 'stakeholder', id: 's-1', label: 'BTP Ivoire SA', sublabel: 'Gros œuvre', keywords: ['devis@btp-ivoire.ci'] },
  { kind: 'contract', id: 'c-1', label: 'M-2026-001', sublabel: 'BTP Ivoire SA' },
];

describe('F4 — recherche globale', () => {
  it('normalise casse et accents', () => {
    expect(normalize('  Résidence   ÉTÉ ')).toBe('residence ete');
  });

  it('reste muette en deçà de deux caractères', () => {
    expect(search(items, 'p')).toEqual([]);
    expect(search(items, '  ')).toEqual([]);
  });

  it('trouve sans tenir compte des accents', () => {
    expect(search(items, 'residence').map((h) => h.id)).toEqual(['op-1']);
  });

  it('classe le préfixe avant l’inclusion, puis les champs secondaires', () => {
    // « palm » : préfixe de « Palmeraie », inclus dans « Résidence Les Palmiers »
    expect(search(items, 'palm').map((h) => h.id)).toEqual(['op-2', 'op-1']);
    // « btp ivoire » : libellé du lot (rang 0) avant la sous-ligne du marché (rang 2)
    expect(search(items, 'btp ivoire').map((h) => [h.id, h.rank])).toEqual([['s-1', 0], ['c-1', 2]]);
  });

  it('interroge les mots-clés non affichés', () => {
    expect(search(items, 'devis@').map((h) => h.id)).toEqual(['s-1']);
  });

  it('borne le nombre de résultats', () => {
    expect(search(items, 'i', 10)).toEqual([]);
    expect(search(items, 'ci', 1)).toHaveLength(1);
  });
});
