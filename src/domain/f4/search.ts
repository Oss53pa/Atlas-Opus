/**
 * Recherche globale (transposé d'Advancity) — appariement pur, indépendant du
 * backend : les écrans lui passent les listes déjà visibles (RLS appliquée en
 * amont), elle ne voit donc jamais plus que l'utilisateur. Insensible à la
 * casse et aux accents (« opéra » trouve « Opéra », « cocody » trouve « Cocody »).
 */

export const SEARCH_KINDS = ['operation', 'opportunity', 'stakeholder', 'contract', 'document', 'rfi'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchItem {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  /** Champs supplémentaires interrogés mais non affichés (référence, e-mail…). */
  keywords?: (string | null | undefined)[];
}

export interface SearchHit extends SearchItem {
  /** 0 = libellé commençant par le terme, 1 = libellé le contenant, 2 = autre champ. */
  rank: number;
}

export const MIN_TERM_LENGTH = 2;

/** Normalisation : minuscules, sans diacritiques, espaces réduits. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Filtre et classe les éléments : d'abord les libellés qui commencent par le
 * terme, puis ceux qui le contiennent, puis les correspondances secondaires.
 * Muette en deçà de deux caractères.
 */
export function search(items: SearchItem[], term: string, limit = 20): SearchHit[] {
  const q = normalize(term);
  if (q.length < MIN_TERM_LENGTH) return [];
  const hits: SearchHit[] = [];
  for (const it of items) {
    const label = normalize(it.label);
    let rank = -1;
    if (label.startsWith(q)) rank = 0;
    else if (label.includes(q)) rank = 1;
    else if ([it.sublabel, ...(it.keywords ?? [])].some((k) => k && normalize(k).includes(q))) rank = 2;
    if (rank >= 0) hits.push({ ...it, rank });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'fr'))
    .slice(0, limit);
}
