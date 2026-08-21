/**
 * Financement & VEFA (réf CLAUDE.md §6).
 * appel_de_fonds[stade]  = prix_vente × pourcentage_reglementaire[stade]
 * interets_intercalaires = capital_decaisse × taux × duree
 * deblocage_tranche      = conditionne a l'avancement valide
 */
import { Money } from '../money/Money';

export interface StadeVefa {
  key: string;
  /** Pourcentage réglementaire cumulé autorisé à ce stade (0..1). */
  pct: number;
}

export interface AppelDeFonds {
  key: string;
  cumulPct: number;
  /** Montant cumulé appelable à ce stade. */
  cumul: Money;
  /** Incrément par rapport au stade précédent. */
  increment: Money;
}

/** Montant d'un appel de fonds = prix de vente × pourcentage. */
export function appelDeFonds(prixVente: Money, pct: number): Money {
  return prixVente.mulRate(pct);
}

/**
 * Échéancier VEFA : pour chaque stade, montant cumulé appelable et incrément.
 * Le dernier incrément absorbe l'arrondi pour que le cumul final == prix × pct final.
 */
export function echeancierVefa(prixVente: Money, stades: StadeVefa[]): AppelDeFonds[] {
  let prevCumul = Money.zero(prixVente.currency, prixVente.scale);
  return stades.map((s) => {
    const cumul = appelDeFonds(prixVente, s.pct);
    const increment = cumul.subtract(prevCumul);
    prevCumul = cumul;
    return { key: s.key, cumulPct: s.pct, cumul, increment };
  });
}

/** Intérêts intercalaires = capital décaissé × taux annuel × durée (années). */
export function interetsIntercalaires(capitalDecaisse: Money, tauxAnnuel: number, dureeAnnees: number): Money {
  return capitalDecaisse.mulRate(tauxAnnuel * dureeAnnees);
}

/** Déblocage d'une tranche autorisé si l'avancement validé atteint le seuil. */
export function deblocageAutorise(avancementValide: number, seuilTranche: number): boolean {
  return avancementValide >= seuilTranche;
}
