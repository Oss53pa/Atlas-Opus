import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Money as MoneyView, Skeleton, type TableRowData } from '../../ui';
import { decompteStatusLabel, DECOMPTE_TONE, changeOriginLabel, changeStatusLabel, CHANGE_STATUS_TONE } from './labels';
import { useOperation, useContracts, useDecomptes, useChangeOrders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import { Money, sumMoney } from '../../domain/money/Money';
import { cumulativeAvenantAmount } from '../../domain/m14';

export function MarcheDetailScreen({ id, cid }: { id: string; cid: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: contracts, loading: lc } = useContracts(id);
  const { data: decomptes } = useDecomptes(id);
  const { data: changeOrders } = useChangeOrders(id);
  const c = contracts?.find((x) => x.id === cid) ?? null;
  const currency = op?.currency ?? 'XOF';

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

      <div className="text-[12px] text-ink-3">{t('marche.subtitle')}</div>
    </div>
  );
}
