/**
 * M11 (handoff) — Règles GED & visa, pures et testables.
 * Un document ne se vise qu'une fois diffusé ; le visa C impose une reprise
 * (nouvel indice). Compteurs pour le pilotage documentaire.
 */
import type { Document, DocStatus } from './types';

/** Le document peut-il être visé (diffusé et pas déjà visé) ? */
export function canVisa(status: DocStatus): boolean {
  return status === 'diffuse';
}

/**
 * Machine documentaire : en_cours → diffusé → visa A/B/C. Un visé se reprend
 * en repassant « en_cours » (nouvel indice, cf. nextIndice). RG-M11.
 */
const DOC_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  en_cours: ['diffuse'],
  diffuse: ['vise_a', 'vise_b', 'vise_c'],
  vise_a: ['en_cours'],
  vise_b: ['en_cours'],
  vise_c: ['en_cours'],
};
export function canTransitionDocument(from: DocStatus, to: DocStatus): boolean {
  return DOC_TRANSITIONS[from].includes(to);
}

/** Le document est-il « bon pour exécution » (visa A ou B) ? */
export function isApproved(status: DocStatus): boolean {
  return status === 'vise_a' || status === 'vise_b';
}

/** Le document est-il refusé (visa C, à reprendre) ? */
export function isRefused(status: DocStatus): boolean {
  return status === 'vise_c';
}

export function approvedCount(docs: Pick<Document, 'status'>[]): number {
  return docs.filter((d) => isApproved(d.status)).length;
}

/** En attente de visa = diffusés non encore visés. */
export function pendingVisaCount(docs: Pick<Document, 'status'>[]): number {
  return docs.filter((d) => d.status === 'diffuse').length;
}

export function refusedCount(docs: Pick<Document, 'status'>[]): number {
  return docs.filter((d) => isRefused(d.status)).length;
}

/** Indice suivant (A → B → C …) pour une reprise après visa C. */
export function nextIndice(indice: string): string {
  const c = indice.trim().toUpperCase().charCodeAt(0);
  if (c >= 65 && c < 90) return String.fromCharCode(c + 1);
  return indice;
}
