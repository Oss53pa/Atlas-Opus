/**
 * M12 (baselines) — règles pures de capture et de variance de planning.
 * Une variance positive traduit un retard (fin courante postérieure au repère).
 */
import { dayDiff } from '../m12/planning';
import type { Task } from '../m12/types';
import type { Baseline, BaselineTask } from './types';

/** Projette les tâches courantes en lignes de baseline (instantané figé). */
export function snapshotOf(tasks: Pick<Task, 'id' | 'name' | 'startDate' | 'endDate' | 'isMilestone'>[]): BaselineTask[] {
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    isMilestone: t.isMilestone,
  }));
}

/** La baseline active de la liste, ou null si aucune. */
export function activeBaseline(list: Baseline[]): Baseline | null {
  return list.find((b) => b.isActive) ?? null;
}

interface Bounds {
  start: string;
  end: string;
}

/** Bornes (min start → max end) d'un instantané, ou null si non daté. */
function snapshotBounds(snapshot: Pick<BaselineTask, 'startDate' | 'endDate'>[]): Bounds | null {
  const starts = snapshot.map((t) => t.startDate).filter((d): d is string => !!d);
  if (starts.length === 0) return null;
  const ends = snapshot.map((t) => t.endDate ?? t.startDate).filter((d): d is string => !!d);
  const start = starts.reduce((a, b) => (a < b ? a : b));
  const end = ends.reduce((a, b) => (a > b ? a : b), start);
  return { start, end };
}

/**
 * Écart de fin (en jours) entre le planning courant et la baseline : positif =
 * retard, négatif = avance. null si l'une des bornes de fin est indéterminée.
 */
export function endVariance(
  baseline: Pick<Baseline, 'snapshot'>,
  tasks: Pick<Task, 'startDate' | 'endDate'>[],
): number | null {
  const base = snapshotBounds(baseline.snapshot);
  const current = snapshotBounds(tasks);
  if (!base || !current) return null;
  return dayDiff(base.end, current.end);
}

export interface TaskVariance {
  id: string;
  name: string;
  /** Écart de fin en jours (courant − baseline) : positif = retard. */
  days: number;
}

/**
 * Variance de fin par tâche, pour les tâches présentes dans la baseline ET dans
 * le planning courant, toutes deux datées en fin. Triée par retard décroissant.
 */
export function taskVariances(
  baseline: Pick<Baseline, 'snapshot'>,
  tasks: Pick<Task, 'id' | 'endDate'>[],
): TaskVariance[] {
  const currentEnd = new Map(tasks.map((t) => [t.id, t.endDate] as const));
  const out: TaskVariance[] = [];
  for (const b of baseline.snapshot) {
    if (!b.endDate) continue;
    const cur = currentEnd.get(b.id);
    if (!cur) continue;
    out.push({ id: b.id, name: b.name, days: dayDiff(b.endDate, cur) });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** Nombre de tâches en retard (variance de fin strictement positive). */
export function slippedCount(
  baseline: Pick<Baseline, 'snapshot'>,
  tasks: Pick<Task, 'id' | 'endDate'>[],
): number {
  return taskVariances(baseline, tasks).filter((v) => v.days > 0).length;
}
