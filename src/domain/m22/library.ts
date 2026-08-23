/**
 * M22 — Règles de la GED transverse, pures et testables.
 * Cycle brouillon → publié → archivé ; compteurs par statut et par catégorie.
 */
import type { LibraryDoc, LibraryStatus, DocCategory } from './types';

const NEXT: Record<LibraryStatus, LibraryStatus | null> = {
  brouillon: 'publie',
  publie: 'archive',
  archive: null,
};

export function nextLibraryStatus(from: LibraryStatus): LibraryStatus | null {
  return NEXT[from];
}

export function publishedCount(docs: Pick<LibraryDoc, 'status'>[]): number {
  return docs.filter((d) => d.status === 'publie').length;
}

/** Nombre de catégories distinctes présentes. */
export function distinctCategories(docs: Pick<LibraryDoc, 'category'>[]): number {
  return new Set(docs.map((d) => d.category)).size;
}

/** Répartition par catégorie (catégories vides omises). */
export function countByCategory(docs: Pick<LibraryDoc, 'category'>[]): Record<DocCategory, number> {
  const out = {} as Record<DocCategory, number>;
  for (const d of docs) out[d.category] = (out[d.category] ?? 0) + 1;
  return out;
}
