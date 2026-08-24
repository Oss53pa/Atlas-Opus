import { useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ListChecks,
  ArrowRight,
  Activity,
  Wallet,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Badge, Banner, Button, KpiRow, Panel, FactList, Progress, Skeleton, type Fact, type FactSeverity } from '../../ui';
import { PhaseBadge } from './PhaseBadge';
import { TransitionDialog } from './TransitionDialog';
import { countryLabel, opTypeLabel, phaseLabel, statusLabel, STATUS_TONE } from './labels';
import { useOperation, useBilan } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { nextPhase } from '../../domain/m1/stateMachine';
import { countBySeverity, deriveOperationAlerts, type AlertSeverity } from '../../domain/m21';
import { planTresorerie } from '../../domain/finance/bilan';
import { Money } from '../../domain/money/Money';
import { bilanToAlertFacts } from './alerts';

/** Barre de sévérité (handoff) par sévérité d'alerte consolidée. */
const ALERT_BAR: Record<AlertSeverity, FactSeverity> = {
  danger: 'danger',
  echeance: 'accent',
  info: 'neutral',
};

export function OperationCockpit({ id }: { id: string }) {
  const { data: op, loading, error, refetch } = useOperation(id);
  const { data: bilan, loading: bilanLoading } = useBilan(id);
  const { navigate } = useNav();
  const [transitionOpen, setTransitionOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
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

  if (error || !op) {
    return (
      <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={refetch}>{t('common.retry')}</Button>}>
        {t('portfolio.error')}
      </Banner>
    );
  }

  const target = nextPhase(op.phase);
  const alerts = deriveOperationAlerts(bilanToAlertFacts(op, bilan, new Date().toISOString().slice(0, 10)));

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'portfolio' })}>
              <ChevronLeft size={18} />
            </Button>
            <PhaseBadge phase={op.phase} />
            <Badge>{opTypeLabel(op.opType)}</Badge>
            <Badge tone={STATUS_TONE[op.status]}>{statusLabel(op.status)}</Badge>
          </div>
          <h1 className="text-[28px] font-medium leading-tight sm:text-[34px]">{op.name}</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {countryLabel(op.countryCode)} · {op.currency} · {formatDate(op.startDate, locale)} → {formatDate(op.endDate, locale)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" size="sm" onClick={() => navigate({ name: 'bilan', id: op.id })}>
            <Wallet size={16} />
            {t('bilan.edit')}
          </Button>
          <Button variant="glass" size="sm" onClick={() => navigate({ name: 'program', id: op.id })}>
            <ListChecks size={16} />
            {t('cockpit.openProgram')}
          </Button>
          <Button variant="primary" size="sm" disabled={!target} onClick={() => setTransitionOpen(true)}>
            {target ? t('cockpit.transition.next', { phase: phaseLabel(target) }) : t('cockpit.transition.terminal')}
            {target && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>

      {/* KPI bilan — calculés via Money.ts (alimentés par M4) ; rangée handoff */}
      {bilanLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 84 }} />)}
        </div>
      ) : bilan ? (
        <KpiRow
          items={[
            { label: t('bilan.cost'), value: bilan.summary.coutTotal.format(locale) },
            {
              label: t('bilan.revenue'),
              value: bilan.summary.recettes.format(locale),
              sub: t('bilan.revenueRealized', { amount: bilan.summary.recettesRealisees.format(locale) }),
            },
            {
              label: t('bilan.margin'),
              value: `${bilan.summary.marge.isNegative() ? '' : '+'}${bilan.summary.marge.format(locale)}`,
              sub: `${t('bilan.marginRate')} ${formatPercent(bilan.summary.tauxMarge, locale)}`,
              accent: bilan.summary.marge.isNegative(),
            },
            { label: t('bilan.tri'), value: bilan.tri != null ? formatPercent(bilan.tri, locale) : '—', accent: true },
          ]}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.55fr_1fr]">
        {/* Bilan + courbes (placeholder M4/M12) */}
        <Panel title={t('cockpit.bilan')} meta={t('cockpit.bilan.subtitle')}>
          <Progress value={op.progress ?? 0} label={t('bilan.progress', { pct: formatPercent(op.progress ?? 0, locale, 0) })} />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlaceholderWidget icon={<Activity size={16} />} title={t('cockpit.scurve')} />
            {bilan && bilan.cashflow.length > 0 ? (
              <TreasuryWidget flows={bilan.cashflow} currency={op.currency} />
            ) : (
              <PlaceholderWidget icon={<Wallet size={16} />} title={t('cockpit.cashflow')} />
            )}
          </div>
        </Panel>

        {/* Alertes consolidées & priorisées (RG-M21-02) */}
        <Panel
          title={t('cockpit.risks')}
          meta={
            alerts.length > 0
              ? t('cockpit.alerts.count', {
                  danger: countBySeverity(alerts, 'danger'),
                  echeance: countBySeverity(alerts, 'echeance'),
                  info: countBySeverity(alerts, 'info'),
                })
              : undefined
          }
          bodyPadded={alerts.length === 0}
        >
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--ax-text-secondary)' }}><ShieldCheck size={16} /></span>
              <span className="text-[13px] text-ink-2">{t('alerts.none')}</span>
            </div>
          ) : (
            <FactList
              items={alerts.map((al): Fact => ({
                label: t(al.labelKey),
                severity: ALERT_BAR[al.severity],
              }))}
            />
          )}
        </Panel>
      </div>

      <TransitionDialog op={op} open={transitionOpen} onClose={() => setTransitionOpen(false)} onDone={refetch} />
    </div>
  );
}

/** Plan de trésorerie : courbe cumulée + point bas (besoin de financement). */
function TreasuryWidget({ flows, currency }: { flows: number[]; currency: string }) {
  const { cumule, besoinMax, pointBasIndex } = planTresorerie(flows);
  const max = Math.max(...cumule.map((v) => Math.abs(v)), 1);
  return (
    <div className="rounded-md p-3" style={{ background: 'var(--ax-glass-subtle)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
        <span className="flex items-center gap-2"><Wallet size={16} className="text-ink-3" />{t('cockpit.cashflow')}</span>
        <span className="text-[11px]" style={{ color: besoinMax < 0 ? 'var(--ax-danger)' : 'var(--ax-success)' }}>
          {t('cockpit.treasury.need')} {Money.of(Math.abs(besoinMax), currency).format(locale)}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-1" style={{ height: 56 }} aria-hidden="true">
        {cumule.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm"
            title={Money.of(v, currency).format(locale)}
            style={{
              height: `${Math.max(6, (Math.abs(v) / max) * 100)}%`,
              background:
                i === pointBasIndex
                  ? 'var(--ax-danger)'
                  : v < 0
                    ? 'color-mix(in srgb, var(--ax-danger) 45%, transparent)'
                    : 'color-mix(in srgb, var(--ax-accent) 40%, transparent)',
            }}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-ink-3">{t('cockpit.treasury.pointBas')}</div>
    </div>
  );
}

function PlaceholderWidget({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="rounded-md p-3" style={{ background: 'var(--ax-glass-subtle)' }}>
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        <span className="text-ink-3">{icon}</span>
        {title}
      </div>
      <div className="mt-3 flex items-end gap-1" style={{ height: 56 }} aria-hidden="true">
        {[40, 55, 48, 70, 62, 85, 78].map((h, i) => (
          <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: 'color-mix(in srgb, var(--ax-accent) 30%, transparent)' }} />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-ink-3">{t('cockpit.placeholder')}</div>
    </div>
  );
}
