import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Diamond, Flag } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Skeleton, StatCard, useToast } from '../../ui';
import { useData, useOperation, useTasks } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { barGeometry, timelineBounds } from '../../domain/m12/planning';
import type { Task, TaskInput } from '../../domain/m12/types';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const emptyDraft: TaskInput = { name: '', startDate: '', endDate: '', isMilestone: false, isCritical: false, progress: 0 };

export function PlanningScreen({ id }: { id: string }) {
  const { planning, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useTasks(id);

  const [rows, setRows] = useState<Task[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TaskInput>(emptyDraft);
  const [progressText, setProgressText] = useState('0');

  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'planning.edit') && !readOnly;

  const milestones = rows.filter((r) => r.isMilestone).length;
  const critical = rows.filter((r) => r.isCritical).length;
  const avgProgress = rows.length ? rows.reduce((s, r) => s + r.progress, 0) / rows.length : 0;
  const bounds = timelineBounds(rows);
  const ordered = [...rows].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  async function submit() {
    if (!draft.name.trim()) return;
    const tk = await planning.add(id, {
      ...draft,
      name: draft.name.trim(),
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
      progress: (Number(progressText.replace(/[^\d]/g, '')) || 0) / 100,
    });
    setRows((rs) => [...rs, tk]);
    setDraft(emptyDraft);
    setProgressText('0');
    setAdding(false);
    toast.push(t('planning.added'), 'success');
  }
  async function remove(tid: string) {
    await planning.remove(tid);
    setRows((rs) => rs.filter((r) => r.id !== tid));
    toast.push(t('planning.removed'), 'info');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('planning.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('planning.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('planning.readonly')}</Banner>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('planning.kpi.tasks')}>{rows.length}</StatCard>
        <StatCard label={t('planning.kpi.milestones')}>{milestones}</StatCard>
        <StatCard label={t('planning.kpi.progress')} emphasis>{formatPercent(avgProgress, locale, 0)}</StatCard>
        <StatCard label={t('planning.kpi.critical')}>{critical}</StatCard>
      </div>

      {adding && canEdit && (
        <Card tone="strong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="tk-name" label={t('planning.field.name')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Field id="tk-progress" label={t('planning.field.progress')} inputMode="numeric" value={progressText} onChange={(e) => setProgressText(e.target.value.replace(/[^\d]/g, ''))} />
            <Field id="tk-start" type="date" label={t('planning.field.start')} value={draft.startDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} />
            <Field id="tk-end" type="date" label={t('planning.field.end')} value={draft.endDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={draft.isMilestone ?? false} onChange={(e) => setDraft((d) => ({ ...d, isMilestone: e.target.checked }))} />
              {t('planning.field.milestone')}
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={draft.isCritical ?? false} onChange={(e) => setDraft((d) => ({ ...d, isCritical: e.target.checked }))} />
              {t('planning.field.critical')}
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={submit}>{t('common.create')}</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 34 }} />)}</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('planning.title')} description={t('planning.empty')} /></Card>
      ) : (
        <Card tone="strong">
          {bounds && (
            <div className="mb-3 flex justify-between text-[11px] text-ink-3">
              <span className="mono">{formatDate(bounds.start, locale)}</span>
              <span className="mono">{formatDate(bounds.end, locale)}</span>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {ordered.map((tk) => {
              const g = bounds ? barGeometry(tk.startDate, tk.endDate, bounds) : { leftPct: 0, widthPct: 0 };
              const color = tk.isCritical ? 'var(--ax-accent)' : 'var(--ax-aurora-b)';
              return (
                <li key={tk.id} className="flex items-center gap-3">
                  <span className="flex w-[180px] shrink-0 items-center gap-1.5 truncate text-[13px]">
                    {tk.isMilestone && <Flag size={13} className="shrink-0" style={{ color: 'var(--ax-accent-strong)' }} />}
                    <span className="truncate">{tk.name}</span>
                  </span>
                  <span className="relative h-6 flex-1 overflow-hidden rounded-md" style={{ background: 'var(--ax-glass-subtle)' }}>
                    {tk.isMilestone ? (
                      <span className="absolute top-1/2" style={{ left: `${g.leftPct}%`, transform: 'translate(-50%,-50%)', color: 'var(--ax-accent-strong)' }}>
                        <Diamond size={14} fill="currentColor" />
                      </span>
                    ) : (
                      <span className="absolute top-1 bottom-1 overflow-hidden rounded" style={{ left: `${g.leftPct}%`, width: `${g.widthPct}%`, background: `color-mix(in srgb, ${color} 22%, transparent)`, border: `1px solid ${color}` }}>
                        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.round(tk.progress * 100)}%`, background: color }} />
                      </span>
                    )}
                  </span>
                  <span className="mono hidden w-[44px] text-right text-[12px] text-ink-3 sm:block">{formatPercent(tk.progress, locale, 0)}</span>
                  {tk.isCritical && <Badge tone="accent">{t('planning.badge.critical')}</Badge>}
                  {canEdit && (
                    <Button variant="ghost" size="sm" icon aria-label={t('planning.removed')} onClick={() => remove(tk.id)}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="text-[12px] text-ink-3">{t('planning.subtitle')}</div>
    </div>
  );
}
