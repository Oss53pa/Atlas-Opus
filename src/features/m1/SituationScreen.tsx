import { ChevronLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, FactList, KpiRow, Panel, Money as MoneyView, Skeleton, type Fact } from '../../ui';
import { decompteStatusLabel, DECOMPTE_TONE } from './labels';
import { useData, useOperation, useDecomptes, useContracts } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { nextDecompteStatus } from '../../domain/payments/decompte';
import { computePayment, fiscalContext } from '../../domain/f6';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function SituationScreen({ id, did }: { id: string; did: string }) {
  const { payments, session } = useData();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: decomptes, loading, refetch } = useDecomptes(id);
  const { data: contracts } = useContracts(id);
  const d = decomptes?.find((x) => x.id === did) ?? null;
  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'payment.edit') && !readOnly;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!d) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'payments', id })}>{t('common.back')}</Button>}>{t('situation.notFound')}</Banner>;

  const contract = contracts?.find((c) => c.id === d.contractId);
  const next = nextDecompteStatus(d.status);

  // Fiscalité F6 : TVA + retenues (source + garantie) selon le pays de l'opération.
  // La retenue à la source suit la nature « travaux » d'une situation de travaux.
  const ctx = fiscalContext(op?.countryCode ?? '', 'travaux', d.retentionRate);
  const pay = computePayment({ brut: Money.of(d.amountGross, currency), vatRate: ctx.vatRate, whtRate: ctx.whtRate, retentionRate: d.retentionRate });

  async function advance() {
    if (!d || !next) return;
    await payments.setDecompteStatus(d.id, next);
    refetch();
  }

  const facts: Fact[] = [
    { label: t('situation.baseHT'), value: <MoneyView amount={pay.baseHT.toMajorNumber()} currency={currency} /> },
    { label: t('situation.tva'), value: <span className="mono">+ {pay.tva.format(locale)}</span>, sub: t('situation.retentionRate', { pct: formatPercent(ctx.vatRate, locale, 2) }) },
    { label: t('situation.retenueSource'), value: <span className="mono">− {pay.retenueSource.format(locale)}</span>, sub: t('situation.retentionRate', { pct: formatPercent(ctx.whtRate, locale, 2) }) },
    { label: t('situation.retention'), value: <span className="mono">− {pay.retenueGarantie.format(locale)}</span>, sub: t('situation.retentionRate', { pct: formatPercent(d.retentionRate, locale, 0) }) },
    { label: t('situation.netAPayer'), value: <MoneyView amount={pay.netAPayer.toMajorNumber()} currency={currency} />, severity: 'accent' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'payments', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={DECOMPTE_TONE[d.status]}>{decompteStatusLabel(d.status)}</Badge>
            <span className="text-[13px] text-ink-3">{contract ? `${contract.reference} · ${contract.contractor}` : op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('situation.title', { n: d.number })}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('situation.baseHT'), value: <MoneyView amount={pay.baseHT.toMajorNumber()} currency={currency} /> },
          { label: t('situation.tva'), value: pay.tva.format(locale) },
          { label: t('situation.netAPayer'), value: <MoneyView amount={pay.netAPayer.toMajorNumber()} currency={currency} />, accent: true },
        ]}
      />

      <Panel
        title={t('situation.breakdown')}
        actions={canEdit && next && <Button variant="primary" size="sm" onClick={advance}>{t('payments.advance')}<ArrowRight size={14} /></Button>}
        bodyPadded={false}
      >
        <FactList items={facts} />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('situation.subtitle')}</div>
    </div>
  );
}
