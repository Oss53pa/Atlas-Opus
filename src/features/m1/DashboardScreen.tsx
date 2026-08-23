import { Plus, FolderOpen, ShieldCheck, AlertTriangle, ChevronRight } from 'lucide-react';
import { Banner, Button, Card, EmptyState, KpiRow, Panel, FactList, Money as MoneyView, Skeleton, DataTable, type Fact } from '../../ui';
import { PhaseBadge } from './PhaseBadge';
import { useAggregatedMarge, useOperations, usePortfolioRisk } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { PHASES, type Operation, type Phase } from '../../domain/m1/types';
import { riskScore, countBySeverity } from '../../domain/m21';
import { phaseLabel } from './labels';

function mainCurrencyTotal(ops: Operation[]): { currency: string; total: Money } {
  const byCur = new Map<string, number>();
  for (const o of ops) byCur.set(o.currency, (byCur.get(o.currency) ?? 0) + o.budgetBac);
  const main = [...byCur.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['XOF', 0];
  const currency = main[0];
  let total = Money.zero(currency);
  for (const o of ops) if (o.currency === currency) total = total.add(Money.of(o.budgetBac, currency));
  return { currency, total };
}

export function DashboardScreen() {
  const { data: ops, loading, error, refetch } = useOperations({});
  const { byCurrency: margeByCur, loading: margeLoading } = useAggregatedMarge(ops);
  const { alertsByOp, loading: riskLoading } = usePortfolioRisk(ops);
  const { navigate } = useNav();

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton style={{ height: 40, width: 280 }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 84 }} />
          ))}
        </div>
        <Skeleton style={{ height: 220 }} />
      </div>
    );
  }

  if (error || !ops) {
    return (
      <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={refetch}>{t('common.retry')}</Button>}>
        {t('portfolio.error')}
      </Banner>
    );
  }

  if (ops.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FolderOpen size={32} />}
          title={t('portfolio.empty.title')}
          description={t('portfolio.empty.desc')}
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'create' })}>
              <Plus size={16} />
              {t('portfolio.new')}
            </Button>
          }
        />
      </Card>
    );
  }

  const active = ops.filter((o) => o.status === 'active').length;
  const avgProgress = ops.reduce((s, o) => s + (o.progress ?? 0), 0) / ops.length;
  const { currency, total } = mainCurrencyTotal(ops);
  const marge = margeByCur.get(currency) ?? null;

  const phaseCounts = PHASES.map((p) => ({ phase: p, count: ops.filter((o) => o.phase === p).length })).filter((x) => x.count > 0);
  const maxPhase = Math.max(...phaseCounts.map((x) => x.count), 1);
  const top = [...ops].sort((a, b) => b.budgetBac - a.budgetBac).slice(0, 5);
  const ranked = [...ops]
    .map((o) => ({ op: o, alerts: alertsByOp.get(o.id) ?? [] }))
    .filter((r) => r.alerts.length > 0)
    .sort((a, b) => riskScore(b.alerts) - riskScore(a.alerts))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1">
        <h1 className="text-[26px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('dashboard.title')}</h1>
        <p className="mt-1 text-[13px] text-ink-3">{t('dashboard.subtitle')}</p>
      </div>

      <KpiRow
        items={[
          { label: t('dashboard.kpi.operations'), value: <>{active} <span className="text-[13px] text-ink-3">/ {ops.length}</span></> },
          { label: t('dashboard.kpi.budget'), value: <MoneyView amount={total.toMajorNumber()} currency={currency} /> },
          {
            label: t('dashboard.kpi.marge'),
            value: margeLoading ? '…' : marge ? `${marge.isNegative() ? '' : '+'}${marge.format(locale)}` : '—',
            accent: !!marge && marge.isNegative(),
          },
          { label: t('dashboard.kpi.progress'), value: formatPercent(avgProgress, locale, 0), accent: true },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.55fr_1fr]">
        {/* Répartition par phase */}
        <Panel title={t('dashboard.byPhase')}>
          <ul className="flex flex-col gap-3">
            {phaseCounts.map(({ phase, count }) => (
              <li key={phase} className="flex items-center gap-3">
                <span className="w-[110px] shrink-0">
                  <PhaseBadge phase={phase as Phase} />
                </span>
                <span className="ax-progress flex-1">
                  <span className="ax-progress__bar block" style={{ width: `${(count / maxPhase) * 100}%` }} />
                </span>
                <span className="mono w-[28px] shrink-0 text-right text-[13px]">{count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Classement par risque (M21) */}
        <Panel title={t('dashboard.risk')} bodyPadded={riskLoading || ranked.length === 0}>
          {riskLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div>
          ) : ranked.length === 0 ? (
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--ax-text-secondary)' }}><ShieldCheck size={16} /></span>
              <span className="text-[13px] text-ink-2">{t('dashboard.risk.none')}</span>
            </div>
          ) : (
            <FactList
              items={ranked.map(({ op, alerts }): Fact => {
                const danger = countBySeverity(alerts, 'danger');
                return {
                  label: op.name,
                  sub: t('cockpit.alerts.count', {
                    danger,
                    echeance: countBySeverity(alerts, 'echeance'),
                    info: countBySeverity(alerts, 'info'),
                  }),
                  severity: danger > 0 ? 'danger' : 'accent',
                  onClick: () => navigate({ name: 'cockpit', id: op.id }),
                };
              })}
            />
          )}
        </Panel>
      </div>

      {/* Principales opérations */}
      <Panel
        title={t('dashboard.top')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'portfolio' })}>
            {t('common.viewAll')}
            <ChevronRight size={15} />
          </Button>
        }
        bodyPadded={false}
      >
        <DataTable
          template="1.6fr 1fr 120px 170px"
          columns={[
            { label: t('portfolio.col.name') },
            { label: t('portfolio.col.phase') },
            { label: t('bilan.progress.short') },
            { label: t('dashboard.kpi.budget'), align: 'right' },
          ]}
          rows={top.map((op) => ({
            onClick: () => navigate({ name: 'cockpit', id: op.id }),
            cells: [
              <span className="font-medium">{op.name}</span>,
              phaseLabel(op.phase),
              <span className="ax-progress block" style={{ maxWidth: 90 }}>
                <span className="ax-progress__bar block" style={{ width: `${Math.round((op.progress ?? 0) * 100)}%` }} />
              </span>,
              <MoneyView amount={op.budgetBac} currency={op.currency} className="mono" />,
            ],
          }))}
        />
      </Panel>
    </div>
  );
}
