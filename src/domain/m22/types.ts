/**
 * M22 — Documents (GED transverse) · types du domaine, pur.
 * Bibliothèque documentaire de l'opération, toutes natures confondues (contrats,
 * administratif, financier, technique, correspondance). Distinct de M11
 * (documents de conception soumis au visa). Table : ao_doc_library.
 */

export const DOC_CATEGORIES = ['contrat', 'administratif', 'financier', 'technique', 'correspondance'] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** Cycle documentaire : brouillon → publié → archivé. */
export const LIBRARY_STATUSES = ['brouillon', 'publie', 'archive'] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export interface LibraryDoc {
  id: string;
  tenantId: string;
  operationId: string;
  name: string;
  category: DocCategory;
  reference: string;
  version: number;
  status: LibraryStatus;
  updatedAt: string;
}

export interface LibraryDocInput {
  name: string;
  category: DocCategory;
  reference: string;
}
