/** Décompte — net = brut − retenue (réf CLAUDE.md §6) + machine de statut. */
import { Money } from '../money/Money';
import { DECOMPTE_STATUSES, type DecompteStatus } from './types';

/** Statut suivant dans le flux draft → validated → mandated → paid (ou null). */
export function nextDecompteStatus(s: DecompteStatus): DecompteStatus | null {
  const i = DECOMPTE_STATUSES.indexOf(s);
  return i >= 0 && i < DECOMPTE_STATUSES.length - 1 ? DECOMPTE_STATUSES[i + 1] : null;
}

/** Retenue + net d'un décompte : retenue = brut × taux ; net = brut − retenue. */
export function decompteNet(gross: Money, retentionRate: number): { retention: Money; net: Money } {
  const retention = gross.mulRate(retentionRate);
  return { retention, net: gross.subtract(retention) };
}
