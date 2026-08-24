import { ChevronLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, FactList, KpiRow, Panel, Money as MoneyView, Skeleton, type Fact } from '../../ui';
import { decompteStatusLabel, DECOMPTE_TONE } from './labels';
import { useData, useOperation, useDecomptes, useContracts } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { nextDecompteStatus } from '../../domain/payments/decompte';
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
  const retention = d.amountGross - d.amountNet;
  const next = nextDecompteStatus(d.status);

  async function advance() {
    if (!d || !next) return;
    await payments.setDecompteStatus(d.id, next);
    refetch();
  }

  const facts: Fact[] = [
    { label: t('payments.field.gross'), value: <MoneyView amount={d.amountGross} currency={currency} /> },
    { label: t('situation.retention'), value: <span className="mono">− {Money.of(retention, currency).format(locale)}</span>, sub: t('situation.retentionRate', { pct: formatPercent(d.retentionRate, locale, 0) }) },
    { label: t('payments.col.net'), value: <MoneyView amount={d.amountNet} currency={currency} />, severity: 'accent' },
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
          { label: t('payments.field.gross'), value: <MoneyView amount={d.amountGross} currency={currency} /> },
          { label: t('situation.retention'), value: Money.of(retention, currency).format(locale), accent: retention > 0 },
          { label: t('payments.col.net'), value: <MoneyView amount={d.amountNet} currency={currency} /> },
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
