import { useEffect, useState } from 'react';
import { ChevronLeft, UserRound } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, KpiRow, Money as MoneyView, Panel, Select, Skeleton, type TableRowData } from '../../ui';
import { saleStatusLabel, SALE_STATUS_TONE, unitStatusLabel } from './labels';
import { useOperation, useReceipts, useSales, useUnits } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { buyerStatement, type StageCallStatus } from '../../domain/m6';

const STATUS_TONE: Record<StageCallStatus, 'success' | 'accent' | 'neutral'> = {
  appele: 'success', appelable: 'accent', a_venir: 'neutral',
};

/**
 * M6 — Portail acquéreur (transposé d'Advancity). Relevé **en lecture seule**
 * d'une vente : échéancier VEFA au regard de l'avancement validé du chantier,
 * ce qui a été appelé, ce qui a été encaissé, ce qui reste dû. Destiné à être
 * partagé avec l'acquéreur — aucune donnée des autres ventes n'y figure.
 */
export function PortailScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: sales, loading } = useSales(id);
  const { data: units } = useUnits(id);

  const [saleId, setSaleId] = useState('');
  const active = (sales ?? []).filter((s) => s.status !== 'resiliee');
  const sale = active.find((s) => s.id === saleId) ?? active[0] ?? null;
  const { data: receipts } = useReceipts(sale?.id ?? '');
  useEffect(() => { if (!saleId && active[0]) setSaleId(active[0].id); }, [saleId, active]);

  const currency = op?.currency ?? 'XOF';
  const avancement = op?.progress ?? 0;
  const unit = units?.find((u) => u.id === sale?.unitId) ?? null;

  const header = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
      <div>
        <div className="text-[13px] text-ink-3"><UserRound size={12} className="mb-0.5 inline" /> {op?.name}</div>
        <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('portail.title')}</h1>
      </div>
    </div>
  );

  if (loading) return <div className="flex flex-col gap-4">{header}<Skeleton style={{ height: 200 }} /></div>;
  if (!sale) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card><EmptyState title={t('portail.title')} description={t('portail.noSale')} /></Card>
      </div>
    );
  }

  const statement = buyerStatement(sale.amount, sale.schedule, receipts ?? [], avancement);
  const stageRows: TableRowData[] = statement.stages.map((s) => ({
    cells: [
      <span className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[s.status]}>{formatPercent(s.pct, locale, 0)}</Badge>
        <span>{t(`portail.stage.${s.key}` as MessageKey)}</span>
      </span>,
      <span className="mono"><MoneyView amount={s.increment.toMajorNumber()} currency={currency} /></span>,
      <span className="mono text-ink-3"><MoneyView amount={s.cumul.toMajorNumber()} currency={currency} /></span>,
      <span className="text-[12px]">{t(`portail.status.${s.status}` as MessageKey)}</span>,
    ],
  }));

  const receiptRows: TableRowData[] = (receipts ?? []).map((r) => ({
    cells: [
      <span className="mono text-[13px]">{r.reference ?? '—'}</span>,
      <span className="text-ink-2">{t(`receipt.method.${r.method}` as MessageKey)}</span>,
      <span className="mono"><MoneyView amount={r.amount.toMajorNumber()} currency={currency} /></span>,
      <Badge tone={r.status === 'settled' ? 'success' : 'warning'}>{t(`receipt.status.${r.status}` as MessageKey)}</Badge>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Banner tone="info">{t('portail.readonly')}</Banner>

      <Panel title={t('portail.sale')} meta="M6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select id="pt-sale" label={t('portail.field.sale')} value={sale.id} onChange={(e) => setSaleId(e.target.value)}>
            {active.map((s) => <option key={s.id} value={s.id}>{s.counterpart}</option>)}
          </Select>
          <div className="flex flex-col justify-center gap-1 text-[13px]">
            <span className="flex items-center gap-2">
              <span className="font-medium">{sale.counterpart}</span>
              <Badge tone={SALE_STATUS_TONE[sale.status]}>{saleStatusLabel(sale.status)}</Badge>
            </span>
            <span className="text-ink-3">
              {unit ? `${unit.typology} · ${unit.area} m² · ${unitStatusLabel(unit.status)}` : t('portail.noUnit')}
            </span>
          </div>
        </div>
      </Panel>

      <KpiRow
        items={[
          { label: t('portail.kpi.price'), value: <MoneyView amount={sale.amount.toMajorNumber()} currency={currency} /> },
          { label: t('portail.kpi.called'), value: <MoneyView amount={statement.appele.toMajorNumber()} currency={currency} />, sub: t('portail.kpi.calledSub', { pct: formatPercent(avancement, locale, 0) }) },
          { label: t('portail.kpi.paid'), value: <MoneyView amount={statement.encaisse.toMajorNumber()} currency={currency} /> },
          statement.reste.isNegative()
            // Encaissé au-delà de l'appelé : c'est une avance de l'acquéreur, pas une dette.
            ? { label: t('portail.kpi.advance'), value: <MoneyView amount={statement.reste.negate().toMajorNumber()} currency={currency} /> }
            : { label: t('portail.kpi.due'), value: <MoneyView amount={statement.reste.toMajorNumber()} currency={currency} />, accent: statement.reste.isPositive() },
        ]}
      />

      {statement.reste.isPositive() && (
        <Banner tone="warning">
          {t('portail.dueNotice')} <MoneyView amount={statement.reste.toMajorNumber()} currency={currency} />
        </Banner>
      )}
      {statement.reste.isNegative() && (
        <Banner tone="info">
          {t('portail.advanceNotice')} <MoneyView amount={statement.reste.negate().toMajorNumber()} currency={currency} />
        </Banner>
      )}

      <Panel title={t('portail.schedule')} meta={t('portail.scheduleMeta')} bodyPadded={false}>
        <DataTable
          template="2fr 1fr 1fr 1fr"
          columns={[
            { label: t('portail.col.stage') },
            { label: t('portail.col.increment'), align: 'right' },
            { label: t('portail.col.cumul'), align: 'right' },
            { label: t('portail.col.status') },
          ]}
          rows={stageRows}
        />
      </Panel>

      <Panel title={t('portail.receipts')} bodyPadded={false}>
        {receiptRows.length === 0 ? (
          <div className="p-4 text-[13px] text-ink-3">{t('portail.noReceipt')}</div>
        ) : (
          <DataTable
            template="1.2fr 1fr 1fr 1fr"
            columns={[
              { label: t('portail.col.reference') },
              { label: t('portail.col.method') },
              { label: t('portail.col.amount'), align: 'right' },
              { label: t('portail.col.receiptStatus') },
            ]}
            rows={receiptRows}
          />
        )}
      </Panel>

      <div className="text-[12px] text-ink-3">{t('portail.subtitle')}</div>
    </div>
  );
}
