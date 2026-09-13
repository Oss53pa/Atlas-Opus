import { useEffect, useState } from 'react';
import { ChevronLeft, Flag, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Skeleton, useToast, type TableRowData } from '../../ui';
import { useData, useOperation, useBaselines, useTasks } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  snapshotOf, activeBaseline, endVariance, taskVariances, slippedCount,
  type Baseline,
} from '../../domain/baseline';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

/** Écart en jours signé, en clair : « +30 j » (retard) / « −5 j » (avance). */
function varianceLabel(days: number): string {
  const sign = days > 0 ? '+' : days < 0 ? '−' : '';
  return `${sign}${Math.abs(days)} j`;
}

export function BaselinesScreen({ id }: { id: string }) {
  const { baselines, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useBaselines(id);
  const { data: tasks } = useTasks(id);

  const [rows, setRows] = useState<Baseline[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const currentTasks = tasks ?? [];

  const [capturing, setCapturing] = useState(false);
  const [label, setLabel] = useState('');

  const active = activeBaseline(rows);
  const variance = active ? endVariance(active, currentTasks) : null;
  const slipped = active ? slippedCount(active, currentTasks) : 0;
  const variances = active ? taskVariances(active, currentTasks) : [];

  async function captureBaseline() {
    if (!label.trim() || currentTasks.length === 0) return;
    const snapshot = snapshotOf(currentTasks);
    const input = { label, snapshot };
    const reset = () => { setLabel(''); setCapturing(false); };
    // Offline-first (F3) : repère figé sur le terrain (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'baselines', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [
        ...r.map((b) => ({ ...b, isActive: false })),
        { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, label, snapshot, isActive: true, createdAt: new Date().toISOString() },
      ]);
      reset();
      toast.push(t('baseline.captured.offline'), 'info');
      return;
    }
    const rec = await baselines.add(id, input);
    setRows((r) => [rec, ...r.map((b) => ({ ...b, isActive: false }))]);
    reset();
    toast.push(t('baseline.captured'), 'success');
  }

  async function setActive(bid: string) {
    const rec = await baselines.setActive(bid);
    setRows((r) => r.map((b) => ({ ...b, isActive: b.id === rec.id })));
    toast.push(t('baseline.activated'), 'success');
  }
  async function remove(bid: string) {
    await baselines.remove(bid);
    setRows((r) => r.filter((x) => x.id !== bid));
    toast.push(t('baseline.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((b) => ({
    cells: [
      <span>
        <span className="block font-medium">{b.label}</span>
        <span className="block text-[12px] text-ink-3">{formatDate(b.createdAt, locale)}</span>
      </span>,
      <span className="mono text-[13px]">{t('baseline.tasks.n', { n: b.snapshot.length })}</span>,
      <span>{b.isActive ? <Badge tone="success">{t('baseline.active')}</Badge> : <Badge tone="neutral">{t('baseline.archived')}</Badge>}</span>,
      <span className="flex justify-end gap-1">
        {canEdit && !b.isActive && <Button variant="ghost" size="sm" icon aria-label={t('baseline.activate')} onClick={() => setActive(b.id)}><CheckCircle2 size={15} /></Button>}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('baseline.removed')} onClick={() => remove(b.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Flag size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('baseline.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setCapturing((c) => !c)}><Camera size={16} />{t('baseline.capture')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('baseline.kpi.count'), value: rows.length },
          { label: t('baseline.kpi.active'), value: active ? active.label : '—' },
          { label: t('baseline.kpi.variance'), value: variance === null ? '—' : varianceLabel(variance), accent: (variance ?? 0) > 0 },
          { label: t('baseline.kpi.slipped'), value: slipped, accent: slipped > 0 },
        ]}
      />

      {capturing && canEdit && (
        <Panel>
          {currentTasks.length === 0 ? (
            <Banner tone="warning">{t('baseline.notasks')}</Banner>
          ) : (
            <>
              <Field id="bl-label" label={t('baseline.field.label')} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('baseline.field.placeholder')} />
              <div className="mt-2 text-[12px] text-ink-3">{t('baseline.capture.hint', { n: currentTasks.length })}</div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCapturing(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" size="sm" onClick={captureBaseline}>{t('baseline.capture')}</Button>
              </div>
            </>
          )}
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('baseline.title')} description={t('baseline.empty')} /></Card>
      ) : (
        <Panel title={t('baseline.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr 1fr auto"
            columns={[
              { label: t('baseline.col.label') },
              { label: t('baseline.col.tasks') },
              { label: t('baseline.col.state') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      {active && variances.length > 0 && (
        <Panel title={t('baseline.variance.title')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr"
            columns={[{ label: t('baseline.variance.task') }, { label: t('baseline.variance.days') }]}
            rows={variances.slice(0, 8).map((v) => ({
              cells: [
                <span className="text-[13px]">{v.name}</span>,
                <span className="flex justify-start"><Badge tone={v.days > 0 ? 'danger' : v.days < 0 ? 'success' : 'neutral'}>{varianceLabel(v.days)}</Badge></span>,
              ],
            }))}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('baseline.subtitle')}</div>
    </div>
  );
}
