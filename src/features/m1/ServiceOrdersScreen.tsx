import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, FileSignature, PauseCircle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { serviceOrderTypeLabel, serviceOrderStatusLabel, SO_STATUS_TONE } from './labels';
import { useData, useOperation, useServiceOrders } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  notifiedCount, draftCount, worksStopped, canTransitionServiceOrder,
  SERVICE_ORDER_TYPES, SERVICE_ORDER_STATUSES, type ServiceOrder, type ServiceOrderType, type ServiceOrderStatus,
} from '../../domain/serviceOrder';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function ServiceOrdersScreen({ id }: { id: string }) {
  const { serviceOrders, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useServiceOrders(id);

  const [rows, setRows] = useState<ServiceOrder[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ type: ServiceOrderType; reference: string; content: string }>({ type: 'notification', reference: '', content: '' });

  async function add() {
    if (!draft.reference.trim() || !draft.content.trim()) return;
    const input = { type: draft.type, reference: draft.reference, content: draft.content, contractId: null };
    const reset = () => { setDraft({ type: 'notification', reference: '', content: '' }); setAdding(false); };
    // Offline-first (F3) : OS rédigé sur le terrain (non écriture), créé « projet ».
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'serviceOrders', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, contractId: null, type: draft.type, reference: draft.reference, content: draft.content, status: 'projet', createdAt: new Date().toISOString() }]);
      reset();
      toast.push(t('so.added.offline'), 'info');
      return;
    }
    const rec = await serviceOrders.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('so.added'), 'success');
  }
  async function setStatus(sid: string, status: ServiceOrderStatus) {
    const rec = await serviceOrders.setStatus(sid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('so.status.changed'), 'success');
  }
  async function remove(sid: string) {
    await serviceOrders.remove(sid);
    setRows((r) => r.filter((x) => x.id !== sid));
    toast.push(t('so.removed'), 'info');
  }

  const stopped = worksStopped(rows);

  const tableRows: TableRowData[] = rows.map((s) => ({
    cells: [
      <span>
        <span className="block font-medium">{s.reference}</span>
        <span className="block text-[12px] text-ink-3">{serviceOrderTypeLabel(s.type)} · {formatDate(s.createdAt, locale)}</span>
      </span>,
      <span className="text-[13px] text-ink-2">{s.content}</span>,
      <Badge tone={SO_STATUS_TONE[s.status]}>{serviceOrderStatusLabel(s.status)}</Badge>,
      <span className="flex flex-wrap justify-end gap-1">
        {canEdit && SERVICE_ORDER_STATUSES.filter((st) => canTransitionServiceOrder(s.status, st)).map((st) => (
          <Button key={st} variant="glass" size="sm" onClick={() => setStatus(s.id, st)}>{serviceOrderStatusLabel(st)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('so.removed')} onClick={() => remove(s.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><FileSignature size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('so.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('so.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}
      {stopped && <Banner tone="warning"><PauseCircle size={14} className="mb-0.5 mr-1 inline" />{t('so.works_stopped')}</Banner>}

      <KpiRow
        items={[
          { label: t('so.kpi.total'), value: rows.length },
          { label: t('so.kpi.notified'), value: notifiedCount(rows) },
          { label: t('so.kpi.draft'), value: draftCount(rows), accent: draftCount(rows) > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="so-type" label={t('so.field.type')} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ServiceOrderType }))}>
              {SERVICE_ORDER_TYPES.map((k) => <option key={k} value={k}>{serviceOrderTypeLabel(k)}</option>)}
            </Select>
            <Field id="so-ref" label={t('so.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
          </div>
          <div className="mt-3">
            <Textarea id="so-content" label={t('so.field.content')} value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} rows={3} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('so.title')} description={t('so.empty')} /></Card>
      ) : (
        <Panel title={t('so.register')} bodyPadded={false}>
          <DataTable
            template="1.6fr 2fr 1fr auto"
            columns={[
              { label: t('so.col.os') },
              { label: t('so.col.content') },
              { label: t('so.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('so.subtitle')}</div>
    </div>
  );
}
