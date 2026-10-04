import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Progress, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { purchaseStatusLabel, PURCHASE_STATUS_TONE } from './labels';
import { useData, useDeliveries, useOperation, usePurchaseOrders, useSuppliers } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatDate, formatPercent } from '../../lib/format';
import { committedTotal, montantReceptionne, nextPurchaseStatus, receivedCount, receptionRate, type Delivery, type PurchaseOrder } from '../../domain/m10';
import { selectableSuppliers, supplierRating } from '../../domain/supplier';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function AchatsScreen({ id }: { id: string }) {
  const { purchasing, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = usePurchaseOrders(id);

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  // Réconciliation post-synchro : recharge les entités serveur (remplace l'optimiste).
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'tender.edit') && !readOnly;

  const { data: loadedDeliveries, refetch: refetchDeliveries } = useDeliveries(id);
  const { data: suppliers } = useSuppliers();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  useEffect(() => { if (loadedDeliveries) setDeliveries(loadedDeliveries); }, [loadedDeliveries]);
  useEffect(() => { if (syncedAt) refetchDeliveries(); }, [syncedAt, refetchDeliveries]);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ reference: '', supplierId: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });
  const [addingDelivery, setAddingDelivery] = useState(false);
  const emptyDelivery = { purchaseOrderId: '', date: new Date().toISOString().slice(0, 10), rate: '100', conform: true, notes: '' };
  const [deliveryDraft, setDeliveryDraft] = useState(emptyDelivery);

  const committed = committedTotal(rows, currency);
  const received = montantReceptionne(rows, deliveries, currency);
  const selectable = selectableSuppliers(suppliers ?? []);
  /** Bons engagés : seuls eux peuvent faire l'objet d'une réception. */
  const receivableOrders = rows.filter((o) => o.status !== 'brouillon');

  async function add() {
    if (!draft.reference.trim() || (!draft.supplierId && !draft.supplier.trim())) return;
    const chosen = selectable.find((x) => x.id === draft.supplierId);
    const input = {
      reference: draft.reference, supplierId: chosen?.id ?? null, supplier: chosen?.name ?? draft.supplier, item: draft.item,
      quantity: Number(draft.qty.replace(/[^\d]/g, '')) || 0, unit: draft.unit || 'u',
      amount: Number(draft.amount.replace(/[^\d]/g, '')) || 0,
    };
    // Offline-first (F3) : un bon d'achat capturé hors-ligne reste un BROUILLON —
    // engagement de budget = écriture financière, admise en brouillon (§4).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'purchaseOrders', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: true,
      });
      const optimistic: PurchaseOrder = { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, status: 'brouillon' };
      setRows((r) => [...r, optimistic]);
      setDraft({ reference: '', supplierId: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });
      setAdding(false);
      toast.push(t('purchase.added.offline'), 'info');
      return;
    }
    const rec = await purchasing.add(id, input);
    setRows((r) => [...r, rec]);
    setDraft({ reference: '', supplierId: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });
    setAdding(false);
    toast.push(t('purchase.added'), 'success');
  }
  async function advance(o: PurchaseOrder) {
    const next = nextPurchaseStatus(o.status);
    if (!next) return;
    // §4 — engager le bon (hors brouillon) est une écriture financière : en ligne uniquement.
    if (!online) {
      toast.push(t('purchase.offlineBlocked'), 'danger');
      return;
    }
    const rec = await purchasing.setStatus(o.id, next);
    setRows((r) => r.map((x) => (x.id === o.id ? rec : x)));
  }
  async function addDelivery() {
    const poId = deliveryDraft.purchaseOrderId || receivableOrders[0]?.id;
    if (!poId) return;
    const rec = await purchasing.addDelivery(id, {
      purchaseOrderId: poId, date: deliveryDraft.date, receivedRate: (Number(deliveryDraft.rate) || 0) / 100,
      conform: deliveryDraft.conform, notes: deliveryDraft.notes || null,
    });
    setDeliveries((d) => [rec, ...d]);
    setDeliveryDraft(emptyDelivery);
    setAddingDelivery(false);
    toast.push(t('delivery.added'), 'success');
  }
  async function removeDelivery(did: string) {
    await purchasing.removeDelivery(did);
    setDeliveries((d) => d.filter((x) => x.id !== did));
    toast.push(t('delivery.removed'), 'info');
  }

  async function remove(oid: string) {
    await purchasing.remove(oid);
    setRows((r) => r.filter((x) => x.id !== oid));
    toast.push(t('purchase.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((o) => {
    const next = nextPurchaseStatus(o.status);
    return {
      cells: [
        <span className="mono text-[13px]">{o.reference}</span>,
        <span className="font-medium">{o.supplier}</span>,
        <span className="text-ink-2">{o.item}</span>,
        <span className="mono">{formatAmount(o.quantity, locale)} {o.unit}</span>,
        <span className="mono">{formatAmount(o.amount, locale)}</span>,
        <span className="flex flex-col gap-1">
          <Badge tone={PURCHASE_STATUS_TONE[o.status]}>{purchaseStatusLabel(o.status)}</Badge>
          {o.status !== 'brouillon' && <Progress value={receptionRate(o.id, deliveries)} label={t('delivery.received', { pct: formatPercent(receptionRate(o.id, deliveries), locale, 0) })} />}
        </span>,
        <span className="flex justify-end gap-1">
          {canEdit && next && (
            <Button variant="glass" size="sm" onClick={() => advance(o)}>{t('purchase.advance')}<ArrowRight size={14} /></Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" icon aria-label={t('purchase.removed')} onClick={() => remove(o.id)}><Trash2 size={15} /></Button>
          )}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('purchase.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('purchase.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('purchase.kpi.count'), value: rows.length },
          { label: t('purchase.kpi.committed'), value: <MoneyView amount={committed.toMajorNumber()} currency={currency} /> },
          { label: t('purchase.kpi.received'), value: receivedCount(rows) },
          { label: t('purchase.kpi.receivedAmount'), value: <MoneyView amount={received.toMajorNumber()} currency={currency} /> },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="po-ref" label={t('purchase.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
            {selectable.length > 0 ? (
              <Select id="po-supplier" label={t('purchase.field.supplier')} value={draft.supplierId} onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value }))}>
                <option value="">{t('purchase.field.supplierFree')}</option>
                {selectable.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </Select>
            ) : (
              <Field id="po-supplier" label={t('purchase.field.supplier')} value={draft.supplier} onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))} />
            )}
            <Field id="po-item" label={t('purchase.field.item')} value={draft.item} onChange={(e) => setDraft((d) => ({ ...d, item: e.target.value }))} />
            <Field id="po-qty" label={t('purchase.field.qty')} inputMode="numeric" value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="po-unit" label={t('purchase.field.unit')} value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
            <Field id="po-amount" label={t('purchase.field.amount')} inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
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
        <Card><EmptyState title={t('purchase.title')} description={t('purchase.empty')} /></Card>
      ) : (
        <Panel title={t('purchase.title')} meta={committed.format(locale)} bodyPadded={false}>
          <DataTable
            template="1.1fr 1.3fr 1.3fr 0.9fr 1fr 1fr auto"
            columns={[
              { label: t('purchase.col.reference') },
              { label: t('purchase.col.supplier') },
              { label: t('purchase.col.item') },
              { label: t('purchase.col.qty'), align: 'right' },
              { label: t('purchase.col.amount'), align: 'right' },
              { label: t('purchase.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <Panel
        title={t('delivery.title')}
        meta="M10"
        actions={canEdit && receivableOrders.length > 0 ? <Button variant="glass" size="sm" onClick={() => setAddingDelivery((a) => !a)}><Plus size={14} />{t('delivery.add')}</Button> : undefined}
        bodyPadded={false}
      >
        {addingDelivery && canEdit && (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-5">
            <Select id="dl-po" label={t('delivery.field.order')} value={deliveryDraft.purchaseOrderId || receivableOrders[0]?.id} onChange={(e) => setDeliveryDraft((d) => ({ ...d, purchaseOrderId: e.target.value }))}>
              {receivableOrders.map((o) => <option key={o.id} value={o.id}>{o.reference}</option>)}
            </Select>
            <Field id="dl-date" type="date" label={t('delivery.field.date')} value={deliveryDraft.date} onChange={(e) => setDeliveryDraft((d) => ({ ...d, date: e.target.value }))} />
            <Field id="dl-rate" label={t('delivery.field.rate')} inputMode="numeric" value={deliveryDraft.rate} onChange={(e) => setDeliveryDraft((d) => ({ ...d, rate: e.target.value.replace(/[^\d]/g, '') }))} />
            <Field id="dl-notes" label={t('delivery.field.notes')} value={deliveryDraft.notes} onChange={(e) => setDeliveryDraft((d) => ({ ...d, notes: e.target.value }))} />
            <div className="flex items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={deliveryDraft.conform} onChange={(e) => setDeliveryDraft((d) => ({ ...d, conform: e.target.checked }))} />
                {t('delivery.field.conform')}
              </label>
              <Button variant="primary" size="sm" onClick={addDelivery}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        {deliveries.length === 0 ? (
          <div className="p-4 text-[13px] text-ink-3">{t('delivery.empty')}</div>
        ) : (
          <DataTable
            template="1fr 1.2fr 0.8fr 1.6fr auto"
            columns={[
              { label: t('delivery.col.date') },
              { label: t('delivery.col.order') },
              { label: t('delivery.col.rate'), align: 'right' },
              { label: t('delivery.col.notes') },
              { label: '' },
            ]}
            rows={deliveries.map((d) => {
              const order = rows.find((o) => o.id === d.purchaseOrderId);
              return {
                cells: [
                  <span className="mono text-[12px] text-ink-3">{formatDate(d.date, locale)}</span>,
                  <span>
                    <span className="mono block text-[13px]">{order?.reference ?? '—'}</span>
                    <span className="block text-[12px] text-ink-3">{order?.supplier ?? ''}</span>
                  </span>,
                  <span className="flex items-center justify-end gap-2">
                    <span className="mono">{formatPercent(d.receivedRate, locale, 0)}</span>
                    <Badge tone={d.conform ? 'success' : 'danger'}>{t(d.conform ? 'delivery.conform' : 'delivery.nonConform')}</Badge>
                  </span>,
                  <span className="text-[12px] text-ink-2">{d.notes ?? ''}</span>,
                  <span className="flex justify-end">
                    {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('delivery.removed')} onClick={() => removeDelivery(d.id)}><Trash2 size={15} /></Button>}
                  </span>,
                ],
              };
            })}
          />
        )}
      </Panel>

      {(suppliers ?? []).some((sp) => supplierRating(sp.id, rows, deliveries) !== null) && (
        <Panel title={t('supplier.rating.title')} meta={t('supplier.rating.meta')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr auto"
            columns={[
              { label: t('supplier.col.supplier') },
              { label: t('supplier.rating.col'), align: 'right' },
              { label: '' },
            ]}
            rows={(suppliers ?? [])
              .map((sp) => ({ sp, note: supplierRating(sp.id, rows, deliveries) }))
              .filter((x) => x.note !== null)
              .map(({ sp, note }) => ({
                cells: [
                  <span className="font-medium">{sp.name}</span>,
                  <span className="mono">{(note as number).toFixed(1)} / 5</span>,
                  <span />,
                ],
              }))}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('purchase.subtitle')}</div>
    </div>
  );
}
