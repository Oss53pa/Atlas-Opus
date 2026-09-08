import { useEffect, useState } from 'react';
import { ChevronLeft, AlertTriangle, Plus } from 'lucide-react';
import { Badge, Banner, Button, DataTable, Field, KpiRow, Panel, Money as MoneyView, Skeleton, useToast, type TableRowData } from '../../ui';
import { decompteStatusLabel, DECOMPTE_TONE, changeOriginLabel, changeStatusLabel, CHANGE_STATUS_TONE } from './labels';
import { useData, useOperation, useContracts, useDecomptes, useChangeOrders, useRevisions } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import { Money, sumMoney } from '../../domain/money/Money';
import { cumulativeAvenantAmount } from '../../domain/m14';
import { revisionCoefficient, reviseAmount } from '../../domain/f6';
import { can } from '../../domain/m1/permissions';

export function MarcheDetailScreen({ id, cid }: { id: string; cid: string }) {
  const { navigate } = useNav();
  const { revisions, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: contracts, loading: lc } = useContracts(id);
  const { data: decomptes } = useDecomptes(id);
  const { data: changeOrders } = useChangeOrders(id);
  const { data: revs, refetch: refetchRevs } = useRevisions(id);
  const c = contracts?.find((x) => x.id === cid) ?? null;
  const currency = op?.currency ?? 'XOF';

  const [revDraft, setRevDraft] = useState({ a0: '', weight: '', index: '', index0: '' });
  useEffect(() => { if (syncedAt) refetchRevs(); }, [syncedAt, refetchRevs]);

  if (lc) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!c) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'payments', id })}>{t('common.back')}</Button>}>{t('marche.notFound')}</Banner>;

  const dec = (decomptes ?? []).filter((d) => d.contractId === c.id).sort((a, b) => a.number - b.number);
  const netCumule = sumMoney(dec.filter((d) => d.status === 'paid' || d.status === 'mandated').map((d) => Money.of(d.amountNet, currency)), currency);
  const cos = (changeOrders ?? []).filter((x) => x.contractId === c.id);
  const avenants = cumulativeAvenantAmount(cos, currency);

  const decRows: TableRowData[] = dec.map((d) => ({
    cells: [
      <span className="mono text-[13px]">#{d.number}</span>,
      <span className="mono">{formatAmount(d.amountGross, locale)}</span>,
      <span className="mono">{formatAmount(d.amountNet, locale)}</span>,
      <Badge tone={DECOMPTE_TONE[d.status]}>{decompteStatusLabel(d.status)}</Badge>,
      <span className="flex justify-end"><Button variant="glass" size="sm" onClick={() => navigate({ name: 'situation', id, did: d.id })}>{t('common.detail')}</Button></span>,
    ],
  }));
  const coRows: TableRowData[] = cos.map((x) => ({
    cells: [
      <Badge>{changeOriginLabel(x.origin)}</Badge>,
      <span className="font-medium">{x.description}</span>,
      <span className="mono" style={x.impactCost.isNegative() ? { color: 'var(--ax-accent)' } : undefined}>{x.impactAnalyzed ? `${x.impactCost.isNegative() ? '' : '+'}${x.impactCost.format(locale)}` : '—'}</span>,
      <Badge tone={CHANGE_STATUS_TONE[x.status]}>{changeStatusLabel(x.status)}</Badge>,
    ],
  }));

  // Révision de prix (F6) : coefficient a0 + Σ aᵢ·Iᵢ/Iᵢ₀ ; aperçu live via Money.ts.
  const num = (s: string) => Number(s.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const a0 = num(revDraft.a0);
  const index0 = num(revDraft.index0);
  const terms = index0 > 0 ? [{ weight: num(revDraft.weight), index: num(revDraft.index), index0 }] : [];
  const coeff = revisionCoefficient(a0, terms);
  const revised = reviseAmount(Money.of(c.amount, currency), a0, terms);
  const canRevise = can(session.role, 'payment.edit');
  const contractRevs = (revs ?? []).filter((r) => r.contractId === c.id);

  async function saveRevision() {
    if (!c) return;
    const input = { contractId: c.id, baseAmount: c.amount, a0, terms, coefficient: coeff, revisedAmount: revised.toMajorNumber() };
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'priceRevisions', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null, createdAt: new Date().toISOString(), financial: false,
      });
      toast.push(t('marche.rev.added.offline'), 'info');
    } else {
      await revisions.add(id, input);
      refetchRevs();
      toast.push(t('marche.rev.added'), 'success');
    }
    setRevDraft({ a0: '', weight: '', index: '', index0: '' });
  }

  const revRows: TableRowData[] = contractRevs.map((r) => ({
    cells: [
      <span className="mono text-[12px]">{r.coefficient.toFixed(4)}</span>,
      <span className="mono">{formatAmount(r.baseAmount, locale)}</span>,
      <span className="mono" style={{ color: 'var(--ax-accent)' }}>{formatAmount(r.revisedAmount, locale)}</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'payments', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="mono text-[13px] font-medium">{c.reference}</span>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{c.contractor}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('marche.kpi.amount'), value: <MoneyView amount={c.amount} currency={currency} /> },
          { label: t('marche.kpi.paid'), value: <MoneyView amount={netCumule.toMajorNumber()} currency={currency} /> },
          { label: t('marche.kpi.avenants'), value: <MoneyView amount={avenants.toMajorNumber()} currency={currency} />, accent: !avenants.isZero() },
        ]}
      />

      <Panel title={t('marche.decomptes')} bodyPadded={false}>
        {dec.length === 0 ? <div className="p-4 text-[13px] text-ink-3">{t('payments.empty.decomptes')}</div> : (
          <DataTable
            template="60px 1fr 1fr 1fr auto"
            columns={[{ label: '#' }, { label: t('payments.field.gross'), align: 'right' }, { label: t('payments.col.net'), align: 'right' }, { label: t('doc.col.status') }, { label: '' }]}
            rows={decRows}
          />
        )}
      </Panel>

      {cos.length > 0 && (
        <Panel title={t('marche.avenants')} bodyPadded={false}>
          <DataTable
            template="1fr 2fr 1.2fr 1fr"
            columns={[{ label: t('change.col.origin') }, { label: t('change.col.description') }, { label: t('change.col.cost'), align: 'right' }, { label: t('change.col.status') }]}
            rows={coRows}
          />
        </Panel>
      )}

      <Panel title={t('marche.rev.title')} meta={t('marche.rev.meta')}>
        {canRevise && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field id="rev-a0" label={t('marche.rev.a0')} inputMode="decimal" value={revDraft.a0} onChange={(e) => setRevDraft((d) => ({ ...d, a0: e.target.value }))} placeholder="0,15" />
            <Field id="rev-w" label={t('marche.rev.weight')} inputMode="decimal" value={revDraft.weight} onChange={(e) => setRevDraft((d) => ({ ...d, weight: e.target.value }))} placeholder="0,85" />
            <Field id="rev-i" label={t('marche.rev.index')} inputMode="decimal" value={revDraft.index} onChange={(e) => setRevDraft((d) => ({ ...d, index: e.target.value }))} placeholder="130" />
            <Field id="rev-i0" label={t('marche.rev.index0')} inputMode="decimal" value={revDraft.index0} onChange={(e) => setRevDraft((d) => ({ ...d, index0: e.target.value }))} placeholder="100" />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-ink-2">
            {t('marche.rev.coefficient')} <span className="mono font-medium">{coeff.toFixed(4)}</span>
            <span className="mx-2 text-ink-3">→</span>
            {t('marche.rev.revised')} <span className="mono font-medium" style={{ color: 'var(--ax-accent)' }}>{revised.format(locale)}</span>
            <span className="ml-2 text-[12px] text-ink-3">({formatPercent(coeff - 1, locale, 2)})</span>
          </div>
          {canRevise && <Button variant="primary" size="sm" onClick={saveRevision}><Plus size={16} />{t('marche.rev.save')}</Button>}
        </div>
        {revRows.length > 0 && (
          <div className="mt-3">
            <DataTable
              template="1fr 1.4fr 1.4fr"
              columns={[{ label: t('marche.rev.coefficient') }, { label: t('marche.rev.base'), align: 'right' }, { label: t('marche.rev.revised'), align: 'right' }]}
              rows={revRows}
            />
          </div>
        )}
      </Panel>

      <div className="text-[12px] text-ink-3">{t('marche.subtitle')}</div>
    </div>
  );
}
