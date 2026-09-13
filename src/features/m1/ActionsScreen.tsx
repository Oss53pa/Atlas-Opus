import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ListChecks, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Skeleton, useToast, type TableRowData } from '../../ui';
import { actionItemStatusLabel, ACTION_STATUS_TONE } from './labels';
import { useData, useOperation, useActionItems } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  openCount, overdueCount, completionRate, isOverdue, sortByPriority,
  canTransitionActionItem, ACTION_ITEM_STATUSES, type ActionItem, type ActionItemStatus,
} from '../../domain/actionItem';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function ActionsScreen({ id }: { id: string }) {
  const { actionItems, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useActionItems(id);

  const [rows, setRows] = useState<ActionItem[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: '', owner: '', dueDate: '' });

  async function add() {
    if (!draft.description.trim() || !draft.owner.trim() || !draft.dueDate) return;
    const input = { description: draft.description, owner: draft.owner, dueDate: draft.dueDate, siteReportId: null };
    const reset = () => { setDraft({ description: '', owner: '', dueDate: '' }); setAdding(false); };
    // Offline-first (F3) : action relevée en réunion de chantier (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'actionItems', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, siteReportId: null, description: draft.description, owner: draft.owner, dueDate: draft.dueDate, status: 'ouvert' }]);
      reset();
      toast.push(t('action.added.offline'), 'info');
      return;
    }
    const rec = await actionItems.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('action.added'), 'success');
  }
  async function setStatus(iid: string, status: ActionItemStatus) {
    const rec = await actionItems.setStatus(iid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('action.status.changed'), 'success');
  }
  async function remove(iid: string) {
    await actionItems.remove(iid);
    setRows((r) => r.filter((x) => x.id !== iid));
    toast.push(t('action.removed'), 'info');
  }

  const sorted = sortByPriority(rows, now);
  const rate = completionRate(rows);

  const tableRows: TableRowData[] = sorted.map((i) => {
    const late = isOverdue(i, now);
    return {
      cells: [
        <span>
          <span className="block font-medium">{i.description}</span>
          <span className="block text-[12px] text-ink-3">{i.owner}</span>
        </span>,
        <span className="flex items-center gap-2">
          <span className="mono text-[12px] text-ink-3">{formatDate(i.dueDate, locale)}</span>
          {late && <Badge tone="danger"><AlertTriangle size={11} className="mb-0.5 inline" /> {t('action.overdue')}</Badge>}
        </span>,
        <Badge tone={ACTION_STATUS_TONE[i.status]}>{actionItemStatusLabel(i.status)}</Badge>,
        <span className="flex flex-wrap justify-end gap-1">
          {canEdit && ACTION_ITEM_STATUSES.filter((s) => canTransitionActionItem(i.status, s)).map((s) => (
            <Button key={s} variant="glass" size="sm" onClick={() => setStatus(i.id, s)}>{actionItemStatusLabel(s)}</Button>
          ))}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('action.removed')} onClick={() => remove(i.id)}><Trash2 size={15} /></Button>}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><ListChecks size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('action.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('action.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('action.kpi.total'), value: rows.length },
          { label: t('action.kpi.open'), value: openCount(rows) },
          { label: t('action.kpi.overdue'), value: overdueCount(rows, now), accent: overdueCount(rows, now) > 0 },
          { label: t('action.kpi.completion'), value: `${Math.round(rate * 100)} %` },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="ai-desc" label={t('action.field.description')} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            <Field id="ai-owner" label={t('action.field.owner')} value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
            <Field id="ai-due" label={t('action.field.due')} type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('action.title')} description={t('action.empty')} /></Card>
      ) : (
        <Panel title={t('action.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1.2fr 1fr auto"
            columns={[
              { label: t('action.col.action') },
              { label: t('action.col.due') },
              { label: t('action.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('action.subtitle')}</div>
    </div>
  );
}
