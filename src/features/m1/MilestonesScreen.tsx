import { ChevronLeft, Flag } from 'lucide-react';
import { Badge, Button, KpiRow, Panel, ReadField, Skeleton, DataTable, EmptyState, type TableRowData } from '../../ui';
import { useOperation, useTasks } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { timelineBounds } from '../../domain/m12/planning';
import type { Task } from '../../domain/m12/types';

/** Statut d'un jalon dérivé de l'avancement de la tâche. */
type MilestoneState = 'reached' | 'inProgress' | 'upcoming';
function milestoneState(task: Task): MilestoneState {
  if (task.progress >= 1) return 'reached';
  if (task.progress > 0) return 'inProgress';
  return 'upcoming';
}
const STATE_TONE = { reached: 'success', inProgress: 'accent', upcoming: 'neutral' } as const;

/**
 * Handoff 42 — Jalons & baseline (M13/M12). Vue focalisée sur les jalons du
 * planning et la baseline de référence du projet (bornes initiales). Lecture
 * seule : la baseline sert de repère, l'édition reste dans le planning (M12).
 */
export function MilestonesScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useTasks(id);

  const tasks = loaded ?? [];
  const bounds = timelineBounds(tasks);
  const milestones = tasks.filter((tk) => tk.isMilestone).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  const reached = milestones.filter((m) => m.progress >= 1).length;
  const critical = tasks.filter((tk) => tk.isCritical).length;
  const avgProgress = tasks.length ? tasks.reduce((s, tk) => s + tk.progress, 0) / tasks.length : 0;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;

  const stateLabel = (s: MilestoneState) => t(`milestones.state.${s}` as const);

  const rows: TableRowData[] = milestones.map((m) => {
    const st = milestoneState(m);
    return {
      cells: [
        <span className="flex items-center gap-1.5">
          <Flag size={13} className="shrink-0" style={{ color: 'var(--ax-accent-strong)' }} />
          <span className="font-medium">{m.name}</span>
        </span>,
        <span className="mono">{m.startDate ? formatDate(m.startDate, locale) : '—'}</span>,
        <span className="mono">{formatPercent(m.progress, locale, 0)}</span>,
        <span className="flex justify-end gap-1">
          {m.isCritical && <Badge tone="accent">{t('planning.badge.critical')}</Badge>}
          <Badge tone={STATE_TONE[st]}>{stateLabel(st)}</Badge>
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'planning', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('milestones.title')}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('milestones.kpi.count'), value: milestones.length },
          { label: t('milestones.kpi.reached'), value: `${reached} / ${milestones.length}` },
          { label: t('milestones.kpi.critical'), value: critical, accent: critical > 0 },
          { label: t('planning.kpi.progress'), value: formatPercent(avgProgress, locale, 0) },
        ]}
      />

      <Panel title={t('milestones.baseline')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <ReadField label={t('milestones.baseline.start')} value={bounds ? formatDate(bounds.start, locale) : '—'} mono />
          <ReadField label={t('milestones.baseline.end')} value={bounds ? formatDate(bounds.end, locale) : '—'} mono />
          <ReadField label={t('milestones.baseline.days')} value={bounds ? t('milestones.days', { n: bounds.days }) : '—'} mono />
          <ReadField label={t('planning.kpi.progress')} value={formatPercent(avgProgress, locale, 0)} mono />
        </div>
        <p className="mt-3 text-[12px] text-ink-3">{t('milestones.baseline.note')}</p>
      </Panel>

      <Panel title={t('milestones.list')} bodyPadded={false}>
        <DataTable
          template="1.8fr 1fr 80px auto"
          columns={[
            { label: t('milestones.col.name') },
            { label: t('milestones.col.date') },
            { label: t('planning.kpi.progress'), align: 'right' },
            { label: '', align: 'right' },
          ]}
          rows={rows}
          empty={<EmptyState title={t('milestones.title')} description={t('milestones.empty')} />}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('milestones.subtitle')}</div>
    </div>
  );
}
