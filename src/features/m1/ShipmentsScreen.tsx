import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Truck, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { customsStatusLabel, CUSTOMS_STATUS_TONE } from './labels';
import { useData, useOperation, useShipments } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  receivedCount, atCustomsCount, overdueCount, isEtaOverdue, sortByEta, canTransitionShipment,
  INCOTERMS, CUSTOMS_STATUSES, type Shipment, type Incoterm, type CustomsStatus,
} from '../../domain/shipment';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function ShipmentsScreen({ id }: { id: string }) {
  const { shipments, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useShipments(id);

  const [rows, setRows] = useState<Shipment[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ reference: string; incoterm: Incoterm; eta: string }>({ reference: '', incoterm: 'CIF', eta: '' });

  async function add() {
    if (!draft.reference.trim()) return;
    const input = { reference: draft.reference, poId: null, incoterm: draft.incoterm, eta: draft.eta || null };
    const reset = () => { setDraft({ reference: '', incoterm: 'CIF', eta: '' }); setAdding(false); };
    // Offline-first (F3) : expédition enregistrée sur le terrain (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'shipments', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, poId: null, reference: draft.reference, incoterm: draft.incoterm, customsStatus: 'en_attente', eta: draft.eta || null, receivedAt: null }]);
      reset();
      toast.push(t('ship.added.offline'), 'info');
      return;
    }
    const rec = await shipments.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('ship.added'), 'success');
  }
  async function setStatus(sid: string, status: CustomsStatus) {
    const rec = await shipments.setStatus(sid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('ship.status.changed'), 'success');
  }
  async function remove(sid: string) {
    await shipments.remove(sid);
    setRows((r) => r.filter((x) => x.id !== sid));
    toast.push(t('ship.removed'), 'info');
  }

  const sorted = sortByEta(rows);

  const tableRows: TableRowData[] = sorted.map((s) => {
    const late = isEtaOverdue(s, now);
    return {
      cells: [
        <span>
          <span className="block font-medium">{s.reference}</span>
          <span className="block text-[12px] text-ink-3">{s.incoterm ?? '—'}</span>
        </span>,
        <span className="flex items-center gap-2">
          <span className="mono text-[12px] text-ink-3">{s.receivedAt ? t('ship.received_on', { d: formatDate(s.receivedAt, locale) }) : s.eta ? formatDate(s.eta, locale) : '—'}</span>
          {late && <Badge tone="danger"><AlertTriangle size={11} className="mb-0.5 inline" /> {t('ship.overdue')}</Badge>}
        </span>,
        <Badge tone={CUSTOMS_STATUS_TONE[s.customsStatus]}>{customsStatusLabel(s.customsStatus)}</Badge>,
        <span className="flex flex-wrap justify-end gap-1">
          {canEdit && CUSTOMS_STATUSES.filter((st) => canTransitionShipment(s.customsStatus, st)).map((st) => (
            <Button key={st} variant="glass" size="sm" onClick={() => setStatus(s.id, st)}>{customsStatusLabel(st)}</Button>
          ))}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('ship.removed')} onClick={() => remove(s.id)}><Trash2 size={15} /></Button>}
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
            <div className="text-[13px] text-ink-3"><Truck size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('ship.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('ship.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('ship.kpi.total'), value: rows.length },
          { label: t('ship.kpi.customs'), value: atCustomsCount(rows), accent: atCustomsCount(rows) > 0 },
          { label: t('ship.kpi.overdue'), value: overdueCount(rows, now), accent: overdueCount(rows, now) > 0 },
          { label: t('ship.kpi.received'), value: receivedCount(rows) },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="sh-ref" label={t('ship.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
            <Select id="sh-inco" label={t('ship.field.incoterm')} value={draft.incoterm} onChange={(e) => setDraft((d) => ({ ...d, incoterm: e.target.value as Incoterm }))}>
              {INCOTERMS.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
            <Field id="sh-eta" label={t('ship.field.eta')} type="date" value={draft.eta} onChange={(e) => setDraft((d) => ({ ...d, eta: e.target.value }))} />
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
        <Card><EmptyState title={t('ship.title')} description={t('ship.empty')} /></Card>
      ) : (
        <Panel title={t('ship.register')} bodyPadded={false}>
          <DataTable
            template="1.6fr 1.4fr 1.2fr auto"
            columns={[
              { label: t('ship.col.shipment') },
              { label: t('ship.col.eta') },
              { label: t('ship.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('ship.subtitle')}</div>
    </div>
  );
}
