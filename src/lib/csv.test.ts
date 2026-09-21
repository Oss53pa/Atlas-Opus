import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('export CSV', () => {
  it('sépare par point-virgule et termine les lignes en CRLF (Excel FR)', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a;b\r\n1;x');
  });

  it('échappe séparateurs, guillemets et retours à la ligne', () => {
    expect(toCsv(['n'], [['Dupont; fils'], ['dit "Jo"'], ['l1\nl2']])).toBe('n\r\n"Dupont; fils"\r\n"dit ""Jo"""\r\n"l1\nl2"');
  });

  it('rend les valeurs absentes en cellule vide', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe('a;b;c\r\n;;0');
  });
});
