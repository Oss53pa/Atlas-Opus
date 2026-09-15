import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Sprout, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Skeleton, useToast, type TableRowData } from '../../ui';
import { pgesStatusLabel, PGES_STATUS_TONE } from './labels';
import { useData, useOperation, usePgesActions } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  openCount, overdueCount, completionRate, isOverdue, sortByPriority, canTransitionPges,
  PGES_STATUSES, type PgesAction, type PgesStatus,
} from '../../domain/pgesAction';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function PgesScreen({ id }: { id: string }) {
  const { pgesActions, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = usePgesActions(id);

  const [rows, setRows] = useState<PgesAction[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ action: '', responsable: '', echeance: '', indicateur: '' });

  async function add() {
    if (!draft.action.trim() || !draft.responsable.trim()) return;
    const input = { action: draft.action, responsable: draft.responsable, echeance: draft.echeance || null, indicateur: draft.indicateur || null };
    const reset = () => { setDraft({ action: '', responsable: '', echeance: '', indicateur: '' }); setAdding(false); };
    // Offline-first (F3) : action E&S relevée sur site (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'pgesActions', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, action: draft.action, responsable: draft.responsable, echeance: draft.echeance || null, indicateur: draft.indicateur || null, status: 'ouvert' }]);
      reset();
      toast.push(t('pges.added.offline'), 'info');
      return;
    }
    const rec = await pgesActions.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('pges.added'), 'success');
  }
  async function setStatus(aid: string, status: PgesStatus) {
    const rec = await pgesActions.setStatus(aid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('pges.status.changed'), 'success');
  }
  async function remove(aid: string) {
    await pgesActions.remove(aid);
    setRows((r) => r.filter((x) => x.id !== aid));
    toast.push(t('pges.removed'), 'info');
  }

  const sorted = sortByPriority(rows, now);

  const tableRows: TableRowData[] = sorted.map((a) => {
    const late = isOverdue(a, now);
    return {
      cells: [
        <span>
          <span className="block font-medium">{a.action}</span>
          <span className="block text-[12px] text-ink-3">{a.responsable}{a.indicateur ? ` · ${a.indicateur}` : ''}</span>
        </span>,
        <span className="flex items-center gap-2">
          <span className="mono text-[12px] text-ink-3">{a.echeance ? formatDate(a.echeance, locale) : '—'}</span>
          {late && <Badge tone="danger"><AlertTriangle size={11} className="mb-0.5 inline" /> {t('pges.overdue')}</Badge>}
        </span>,
        <Badge tone={PGES_STATUS_TONE[a.status]}>{pgesStatusLabel(a.status)}</Badge>,
        <span className="flex flex-wrap justify-end gap-1">
          {canEdit && PGES_STATUSES.filter((s) => canTransitionPges(a.status, s)).map((s) => (
            <Button key={s} variant="glass" size="sm" onClick={() => setStatus(a.id, s)}>{pgesStatusLabel(s)}</Button>
          ))}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('pges.removed')} onClick={() => remove(a.id)}><Trash2 size={15} /></Button>}
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
            <div className="text-[13px] text-ink-3"><Sprout size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('pges.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('pges.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('pges.kpi.total'), value: rows.length },
          { label: t('pges.kpi.open'), value: openCount(rows) },
          { label: t('pges.kpi.overdue'), value: overdueCount(rows, now), accent: overdueCount(rows, now) > 0 },
          { label: t('pges.kpi.completion'), value: `${Math.round(completionRate(rows) * 100)} %` },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="pg-action" label={t('pges.field.action')} value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} />
            <Field id="pg-resp" label={t('pges.field.responsable')} value={draft.responsable} onChange={(e) => setDraft((d) => ({ ...d, responsable: e.target.value }))} />
            <Field id="pg-ech" label={t('pges.field.echeance')} type="date" value={draft.echeance} onChange={(e) => setDraft((d) => ({ ...d, echeance: e.target.value }))} />
            <Field id="pg-ind" label={t('pges.field.indicateur')} value={draft.indicateur} onChange={(e) => setDraft((d) => ({ ...d, indicateur: e.target.value }))} />
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
        <Card><EmptyState title={t('pges.title')} description={t('pges.empty')} /></Card>
      ) : (
        <Panel title={t('pges.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1.2fr 1fr auto"
            columns={[
              { label: t('pges.col.action') },
              { label: t('pges.col.echeance') },
              { label: t('pges.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('pges.subtitle')}</div>
    </div>
  );
}
