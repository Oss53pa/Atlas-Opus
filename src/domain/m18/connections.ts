/**
 * M18 — Règles concessionnaires & raccordements, pures et testables.
 * Machine de statut, compteurs (raccordés / en cours), cumul des coûts.
 */
import { Money, sumMoney, type Currency } from '../money/Money';
import { CONNECTION_STATUSES, type Connection, type ConnectionStatus } from './types';

const ORDER: ConnectionStatus[] = [...CONNECTION_STATUSES];

/** Statut suivant dans le cycle, ou null si raccordé (terminal). */
export function nextConnectionStatus(from: ConnectionStatus): ConnectionStatus | null {
  const i = ORDER.indexOf(from);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
}

export function isConnected(status: ConnectionStatus): boolean {
  return status === 'raccorde';
}

export function connectedCount(rows: Pick<Connection, 'status'>[]): number {
  return rows.filter((c) => isConnected(c.status)).length;
}

/** Raccordements en cours (ni raccordés, ni au tout début) — demande..payé. */
export function pendingCount(rows: Pick<Connection, 'status'>[]): number {
  return rows.filter((c) => !isConnected(c.status)).length;
}

/** Cumul des coûts de raccordement (via Money.ts). */
export function connectionsCostTotal(rows: Pick<Connection, 'cost'>[], currency: Currency): Money {
  return sumMoney(rows.map((c) => Money.of(c.cost, currency)), currency);
}

export { CONNECTION_STATUSES };
