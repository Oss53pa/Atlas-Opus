import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Money as MoneyView, Select, Skeleton, StatCard, useToast } from '../../ui';
import {
  unitStatusLabel,
  UNIT_STATUS_TONE,
  saleKindLabel,
  saleStatusLabel,
  SALE_STATUS_TONE,
  receiptStatusLabel,
  RECEIPT_STATUS_TONE,
} from './labels';
import { useData, useOperation, useUnits, useSales, useReceipts } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { Money } from '../../domain/money/Money';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';
import {
  UNIT_STATUSES,
  SALE_KINDS,
  RECEIPT_METHODS,
  canTransitionUnit,
  evaluateUnitTransition,
  recettesEncaissees,
  type Unit,
  type UnitStatus,
  type Sale,
  type SaleKind,
  type Receipt,
  type ReceiptMethod,
} from '../../domain/m6';

export function CommercialisationScreen({ id }: { id: string }) {
  const { commercialisation, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const unitsQ = useUnits(id);
  const salesQ = useSales(id);

  const [units, setUnits] = useState<Unit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { if (unitsQ.data) setUnits(unitsQ.data); }, [unitsQ.data]);
  useEffect(() => { if (salesQ.data) setSales(salesQ.data); }, [salesQ.data]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'stakeholder.edit') && !readOnly;

  const [settledBySale, setSettledBySale] = useState<Record<string, number>>({});
  const totalRevenue = Object.values(settledBySale).reduce((a, b) => a + b, 0);
  const soldCount = units.filter((u) => u.status === 'vendu' || u.status === 'loue').length;

  // ── Unités ──
  const [addingUnit, setAddingUnit] = useState(false);
  const [unitDraft, setUnitDraft] = useState({ typology: '', areaText: '', priceText: '' });
  async function addUnit() {
    if (!unitDraft.typology.trim()) return;
    const rec = await commercialisation.addUnit(id, {
      typology: unitDraft.typology.trim(),
      area: Number(unitDraft.areaText.replace(/[^\d]/g, '')) || 0,
      price: Money.of(Number(unitDraft.priceText.replace(/[^\d]/g, '')) || 0, currency),
    });
    setUnits((u) => [...u, rec]);
    setUnitDraft({ typology: '', areaText: '', priceText: '' });
    setAddingUnit(false);
    toast.push(t('com.units.added'), 'success');
  }
  async function advanceUnit(u: Unit, to: UnitStatus) {
    const hasActiveReservation = sales.some((s) => s.unitId === u.id && s.status === 'active');
    const decision = evaluateUnitTransition(u.status, to, { hasActiveReservation });
    if (!decision.ok) {
      toast.push(decision.code === 'reservation_required' ? t('com.sales.empty') : t('com.units.empty'), 'danger');
      return;
    }
    const rec = await commercialisation.setUnitStatus(u.id, decision.to);
    setUnits((us) => us.map((x) => (x.id === u.id ? rec : x)));
  }
  async function removeUnit(uid: string) {
    await commercialisation.removeUnit(uid);
    setUnits((us) => us.filter((x) => x.id !== uid));
    toast.push(t('com.units.removed'), 'info');
  }

  // ── Ventes ──
  const [addingSale, setAddingSale] = useState(false);
  const [saleDraft, setSaleDraft] = useState<{ kind: SaleKind; unitId: string; counterpart: string; amountText: string }>({
    kind: 'reservation', unitId: '', counterpart: '', amountText: '',
  });
  async function addSale() {
    if (!saleDraft.counterpart.trim()) return;
    const rec = await commercialisation.addSale(id, {
      kind: saleDraft.kind,
      unitId: saleDraft.unitId || null,
      counterpart: saleDraft.counterpart.trim(),
      amount: Money.of(Number(saleDraft.amountText.replace(/[^\d]/g, '')) || 0, currency),
    });
    setSales((s) => [...s, rec]);
    setSaleDraft({ kind: 'reservation', unitId: '', counterpart: '', amountText: '' });
    setAddingSale(false);
    toast.push(t('com.sales.added'), 'success');
  }
  async function removeSale(sid: string) {
    await commercialisation.removeSale(sid);
    setSales((s) => s.filter((x) => x.id !== sid));
    setSettledBySale((m) => { const n = { ...m }; delete n[sid]; return n; });
    toast.push(t('com.sales.removed'), 'info');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-medium">{t('com.title')}</h1>
        </div>
      </div>

      {readOnly && <Banner tone="warning">{t('com.readonly')}</Banner>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t('com.kpi.units')}>{units.length}</StatCard>
        <StatCard label={t('com.kpi.sold')}>{soldCount}</StatCard>
        <StatCard label={t('com.kpi.revenue')}><MoneyView amount={totalRevenue} currency={currency} /></StatCard>
      </div>

      {/* ── Inventaire ── */}
      <Card tone="strong">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-medium">{t('com.units.title')}</h2>
          {canEdit && <Button variant="primary" size="sm" onClick={() => setAddingUnit((a) => !a)}><Plus size={16} />{t('com.units.add')}</Button>}
        </div>
        {addingUnit && canEdit && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="un-typo" label={t('unit.field.typology')} value={unitDraft.typology} onChange={(e) => setUnitDraft((d) => ({ ...d, typology: e.target.value }))} />
            <Field id="un-area" label={t('unit.field.area')} inputMode="numeric" value={unitDraft.areaText} onChange={(e) => setUnitDraft((d) => ({ ...d, areaText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="un-price" label={t('unit.field.price')} inputMode="numeric" value={unitDraft.priceText} onChange={(e) => setUnitDraft((d) => ({ ...d, priceText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingUnit(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addUnit}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        {unitsQ.loading ? (
          <div className="mt-3 flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 44 }} />)}</div>
        ) : units.length === 0 ? (
          <div className="mt-3"><EmptyState title={t('com.units.empty')} /></div>
        ) : (
          <ul className="mt-2 flex flex-col">
            {units.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-3" style={{ borderTop: '1px solid var(--ax-border)' }}>
                <span className="min-w-[160px] flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{u.typology}</span>
                    <Badge tone={UNIT_STATUS_TONE[u.status]}>{unitStatusLabel(u.status)}</Badge>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">{u.area} m² · <MoneyView amount={u.price.toMajorNumber()} currency={currency} /></span>
                </span>
                {canEdit && (
                  <span className="flex items-center gap-1.5">
                    {UNIT_STATUSES.filter((s) => canTransitionUnit(u.status, s)).map((s) => (
                      <Button key={s} variant="glass" size="sm" onClick={() => advanceUnit(u, s)}>{unitStatusLabel(s)}</Button>
                    ))}
                    <Button variant="ghost" size="sm" icon aria-label={t('com.units.removed')} onClick={() => removeUnit(u.id)}><Trash2 size={15} /></Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Ventes & baux ── */}
      <Card tone="strong">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-medium">{t('com.sales.title')}</h2>
          {canEdit && <Button variant="primary" size="sm" onClick={() => setAddingSale((a) => !a)}><Plus size={16} />{t('com.sales.add')}</Button>}
        </div>
        {addingSale && canEdit && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select id="sa-kind" label={t('sale.field.kind')} value={saleDraft.kind} onChange={(e) => setSaleDraft((d) => ({ ...d, kind: e.target.value as SaleKind }))}>
              {SALE_KINDS.map((k) => <option key={k} value={k}>{saleKindLabel(k)}</option>)}
            </Select>
            <Select id="sa-unit" label={t('sale.field.unit')} value={saleDraft.unitId} onChange={(e) => setSaleDraft((d) => ({ ...d, unitId: e.target.value }))}>
              <option value="">—</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.typology}</option>)}
            </Select>
            <Field id="sa-cp" label={t('sale.field.counterpart')} value={saleDraft.counterpart} onChange={(e) => setSaleDraft((d) => ({ ...d, counterpart: e.target.value }))} />
            <Field id="sa-amt" label={t('sale.field.amount')} inputMode="numeric" value={saleDraft.amountText} onChange={(e) => setSaleDraft((d) => ({ ...d, amountText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <div className="sm:col-span-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingSale(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addSale}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        {salesQ.loading ? (
          <div className="mt-3 flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 64 }} />)}</div>
        ) : sales.length === 0 ? (
          <div className="mt-3"><EmptyState title={t('com.sales.empty')} /></div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {sales.map((s) => (
              <SaleCard key={s.id} sale={s} currency={currency} canEdit={canEdit}
                onRemove={() => removeSale(s.id)}
                onSettledChange={(total) => setSettledBySale((m) => ({ ...m, [s.id]: total }))} />
            ))}
          </div>
        )}
      </Card>

      <div className="text-[12px] text-ink-3">{t('com.subtitle')}</div>
    </div>
  );
}

function SaleCard({
  sale, currency, canEdit, onRemove, onSettledChange,
}: {
  sale: Sale; currency: string; canEdit: boolean; onRemove: () => void; onSettledChange: (total: number) => void;
}) {
  const { commercialisation } = useData();
  const { data: loaded, loading } = useReceipts(sale.id);
  const [rows, setRows] = useState<Receipt[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const settled = recettesEncaissees(rows, currency);
  useEffect(() => { onSettledChange(settled.toMajorNumber()); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ amountText: string; method: ReceiptMethod }>({ amountText: '', method: 'virement' });

  async function addReceipt() {
    const rec = await commercialisation.addReceipt(sale.id, {
      amount: Money.of(Number(draft.amountText.replace(/[^\d]/g, '')) || 0, currency),
      method: draft.method,
    });
    setRows((r) => [...r, rec]);
    setDraft({ amountText: '', method: 'virement' });
    setAdding(false);
  }
  async function settle(rid: string) {
    const rec = await commercialisation.setReceiptStatus(rid, 'settled');
    setRows((r) => r.map((x) => (x.id === rid ? rec : x)));
  }
  async function removeReceipt(rid: string) {
    await commercialisation.removeReceipt(rid);
    setRows((r) => r.filter((x) => x.id !== rid));
  }

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--ax-glass-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium">{sale.counterpart}</span>
            <Badge>{saleKindLabel(sale.kind)}</Badge>
            <Badge tone={SALE_STATUS_TONE[sale.status]}>{saleStatusLabel(sale.status)}</Badge>
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            <MoneyView amount={sale.amount.toMajorNumber()} currency={currency} /> · {t('com.kpi.revenue')} <MoneyView amount={settled.toMajorNumber()} currency={currency} />
          </div>
        </div>
        {canEdit && (
          <Button variant="ghost" size="sm" icon aria-label={t('com.sales.removed')} onClick={onRemove}><Trash2 size={15} /></Button>
        )}
      </div>

      <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--ax-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-2">{t('com.receipts')}</span>
          {canEdit && <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={14} />{t('com.receipt.add')}</Button>}
        </div>
        {adding && canEdit && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field id={`re-amt-${sale.id}`} label={t('receipt.field.amount')} inputMode="numeric" value={draft.amountText} onChange={(e) => setDraft((d) => ({ ...d, amountText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Select id={`re-meth-${sale.id}`} label={t('receipt.field.method')} value={draft.method} onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as ReceiptMethod }))}>
              {RECEIPT_METHODS.map((mth) => <option key={mth} value={mth}>{t(mth === 'virement' ? 'receipt.method.virement' : 'receipt.method.mobile_money')}</option>)}
            </Select>
            <div className="flex items-end gap-2">
              <Button variant="primary" size="sm" onClick={addReceipt}>{t('common.add')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        {loading ? (
          <Skeleton className="mt-2" style={{ height: 28 }} />
        ) : rows.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <MoneyView amount={r.amount.toMajorNumber()} currency={currency} className="font-medium" />
                <Badge tone={RECEIPT_STATUS_TONE[r.status]}>{receiptStatusLabel(r.status)}</Badge>
                {canEdit && r.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => settle(r.id)}>{t('com.receipt.settle')}</Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" icon aria-label={t('com.sales.removed')} onClick={() => removeReceipt(r.id)}><Trash2 size={13} /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
