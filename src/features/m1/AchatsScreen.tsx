import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Skeleton, useToast, type TableRowData } from '../../ui';
import { purchaseStatusLabel, PURCHASE_STATUS_TONE } from './labels';
import { useData, useOperation, usePurchaseOrders } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import { committedTotal, nextPurchaseStatus, receivedCount, type PurchaseOrder } from '../../domain/m10';
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

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ reference: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });

  const committed = committedTotal(rows, currency);

  async function add() {
    if (!draft.reference.trim() || !draft.supplier.trim()) return;
    const input = {
      reference: draft.reference, supplier: draft.supplier, item: draft.item,
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
      setDraft({ reference: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });
      setAdding(false);
      toast.push(t('purchase.added.offline'), 'info');
      return;
    }
    const rec = await purchasing.add(id, input);
    setRows((r) => [...r, rec]);
    setDraft({ reference: '', supplier: '', item: '', qty: '', unit: 'u', amount: '' });
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
        <Badge tone={PURCHASE_STATUS_TONE[o.status]}>{purchaseStatusLabel(o.status)}</Badge>,
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
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="po-ref" label={t('purchase.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
            <Field id="po-supplier" label={t('purchase.field.supplier')} value={draft.supplier} onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))} />
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

      <div className="text-[12px] text-ink-3">{t('purchase.subtitle')}</div>
    </div>
  );
}
