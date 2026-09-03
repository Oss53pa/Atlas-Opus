// Garde de transition sur machine à états linéaire (miroir des machines du
// domaine : m8/tender.ts, payments/decompte.ts). Le service_role pouvant écrire
// n'importe quoi, la transition est validée ICI avant l'UPDATE.
import { HttpError } from './http.ts';

/** Statut suivant d'une séquence linéaire, ou null au terminal. */
export function nextStatus<S extends string>(seq: readonly S[], from: S): S | null {
  const i = seq.indexOf(from);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
}

/**
 * Valide un passage `from → to` sur une séquence linéaire (une seule marche en
 * avant). Si `to` est omis, renvoie le suivant. 409 si la transition est illégale.
 */
export function guardLinear<S extends string>(seq: readonly S[], from: S, to?: S): S {
  const expected = nextStatus(seq, from);
  if (!expected) throw new HttpError(409, `terminal_state:${from}`);
  if (to !== undefined && to !== expected) throw new HttpError(409, `illegal_transition:${from}->${to}`);
  return expected;
}
