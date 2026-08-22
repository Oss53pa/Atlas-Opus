/**
 * M14 — Règles de gestion RG-M14-01 à 06 (réf Spec M14 §5), pures et testables.
 * Tout calcul monétaire via Money.ts ; aucun flottant sur les montants.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import type { Role } from '../m1/types';
import type { AvenantPropagation, ChangeApprovalRule, ChangeOrder } from './types';

/**
 * Rang d'autorité d'arbitrage : owner (comité) domine moa_director.
 * Sert à vérifier qu'un arbitre satisfait le rôle requis par le seuil (RG-M14-03).
 */
const ARBITRATION_RANK: Partial<Record<Role, number>> = {
  moa_director: 1,
  owner: 2,
};

/** Un rôle `actual` satisfait-il le rôle `required` d'arbitrage ? (owner ≥ moa_director) */
export function roleSatisfies(actual: Role, required: Role): boolean {
  const a = ARBITRATION_RANK[actual] ?? 0;
  const r = ARBITRATION_RANK[required] ?? 0;
  return a >= r;
}

/**
 * RG-M14-03 — Niveau d'approbation en fonction de |impact_cost| vs seuils.
 * Renvoie le rôle requis pour le plus haut seuil atteint ; à défaut, moa_director.
 * Les règles peuvent être fournies dans un ordre quelconque.
 */
export function requiredRoleFor(impactCost: Money, rules: ChangeApprovalRule[]): Role {
  const abs = impactCost.abs();
  const applicable = rules
    .filter((r) => abs.gte(r.thresholdAmount))
    .sort((a, b) => a.thresholdAmount.compare(b.thresholdAmount));
  const top = applicable[applicable.length - 1];
  return top ? top.requiredRole : 'moa_director';
}

/**
 * RG-M14-06 — Cumul des avenants (change orders convertis) d'un marché.
 * Somme signée des impacts coût des CO au statut « converted ».
 */
export function cumulativeAvenantAmount(orders: ChangeOrder[], currency: Currency): Money {
  return sumMoney(
    orders.filter((o) => o.status === 'converted').map((o) => o.impactCost),
    currency,
  );
}

/** Montant plafond d'avenants autorisé = montant initial × capRate (ex. 0.30 en public). */
export function avenantCap(initialAmount: Money, capRate: number): Money {
  return initialAmount.percentage(capRate);
}

/**
 * RG-M14-06 — Le cumul (avec le CO envisagé) dépasse-t-il le plafond ?
 * Comparaison en valeur absolue du cumul vs plafond ; déclenche une alerte (jamais un blocage dur).
 */
export function exceedsCap(cumulative: Money, initialAmount: Money, capRate: number): boolean {
  return cumulative.abs().gt(avenantCap(initialAmount, capRate));
}

/** Référence d'avenant déterministe à partir du marché et du rang du CO. */
export function buildAvenantRef(contractReference: string, sequence: number): string {
  return `${contractReference}-AV${String(sequence).padStart(2, '0')}`;
}

/**
 * RG-M14-05 — Charge utile de propagation d'une conversion :
 * ajuste le montant (M4/M8) et décale le planning (M12) si impact_days ≠ 0.
 * Ne s'applique qu'à un CO converti et rattaché à un marché (RG-M14-01).
 */
export function buildAvenantPropagation(order: ChangeOrder, avenantRef: string): AvenantPropagation | null {
  if (order.status !== 'converted' || !order.contractId) return null;
  return {
    contractId: order.contractId,
    amountDelta: order.impactCost,
    daysDelta: order.impactDays,
    avenantRef,
  };
}

/**
 * RG-M14-01 — Aucune modif coût/délai d'un marché n'est applicable
 * tant que le CO n'est pas approuvé puis converti.
 */
export function canApplyToContract(order: Pick<ChangeOrder, 'status'>): boolean {
  return order.status === 'converted';
}

/**
 * RG-M14-01 / 02 — Construit une nouvelle demande : statut « requested »,
 * impact nul non instruit, devise = devise de l'opération.
 * id/now injectés pour la testabilité (aucun effet de bord).
 */
export function buildNewChangeOrder(
  input: { contractId: string; origin: ChangeOrder['origin']; description: string },
  currency: Currency,
  ids: { id: string; tenantId: string; operationId: string; now: string },
): ChangeOrder {
  return {
    id: ids.id,
    tenantId: ids.tenantId,
    operationId: ids.operationId,
    contractId: input.contractId,
    origin: input.origin,
    description: input.description.trim(),
    impactCost: Money.zero(currency),
    impactDays: 0,
    impactQuality: null,
    impactAnalyzed: false,
    status: 'requested',
    avenantRef: null,
    decidedBy: null,
    rejectionReason: null,
    createdAt: ids.now,
    updatedAt: ids.now,
  };
}
