/**
 * Pont couche données → faits d'alerte M21 (RG-M21-01 : agrégation, pas de
 * recalcul). Convertit une opération + son résumé de bilan en `OperationAlertFacts`.
 */
import type { OperationAlertFacts } from '../../domain/m21';
import type { BilanView } from '../../data/repo';
import type { Operation } from '../../domain/m1/types';

export function bilanToAlertFacts(op: Operation, bilan: BilanView | null, today: string): OperationAlertFacts {
  return {
    phase: op.phase,
    status: op.status,
    endDate: op.endDate,
    today,
    margeNegative: bilan ? bilan.summary.marge.isNegative() : false,
    budgetOverrun: bilan ? bilan.summary.coutTotal.gt(bilan.bac) && !bilan.bac.isZero() : false,
    recettesRealiseesZero: bilan ? bilan.summary.recettesRealisees.isZero() : false,
  };
}
