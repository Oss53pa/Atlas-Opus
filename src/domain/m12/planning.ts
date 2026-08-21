/** Planning — bornes de frise et géométrie des barres (Gantt), TS pur. */
import type { Task } from './types';

const DAY = 86_400_000;

/** Écart en jours entre deux dates ISO (b − a). */
export function dayDiff(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / DAY);
}

export interface TimelineBounds {
  start: string;
  end: string;
  days: number;
}

/** Bornes globales (min start → max end) sur les tâches datées, ou null. */
export function timelineBounds(tasks: Task[]): TimelineBounds | null {
  const starts = tasks.map((t) => t.startDate).filter((d): d is string => !!d);
  const ends = tasks.map((t) => t.endDate ?? t.startDate).filter((d): d is string => !!d);
  if (starts.length === 0) return null;
  const start = starts.reduce((a, b) => (a < b ? a : b));
  const end = ends.reduce((a, b) => (a > b ? a : b), start);
  const days = Math.max(1, dayDiff(start, end));
  return { start, end, days };
}

export interface BarGeometry {
  leftPct: number;
  widthPct: number;
}

/** Position et largeur (%) d'une barre sur la frise. */
export function barGeometry(startIso: string | null, endIso: string | null, bounds: TimelineBounds): BarGeometry {
  if (!startIso) return { leftPct: 0, widthPct: 0 };
  const left = Math.max(0, dayDiff(bounds.start, startIso));
  const span = Math.max(1, dayDiff(startIso, endIso ?? startIso));
  const leftPct = (left / bounds.days) * 100;
  const widthPct = Math.min(100 - leftPct, (span / bounds.days) * 100);
  return { leftPct, widthPct: Math.max(1.5, widthPct) };
}
