import { useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ListChecks,
  ArrowRight,
  Activity,
  Wallet,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Badge, Banner, Button, Card, Progress, Skeleton, StatCard } from '../../ui';
import { PhaseBadge } from './PhaseBadge';
import { TransitionDialog } from './TransitionDialog';
import { countryLabel, opTypeLabel, phaseLabel, statusLabel, STATUS_TONE } from './labels';
import { useOperation, useBilan } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { nextPhase } from '../../domain/m1/stateMachine';
import { consolidateAlerts, countBySeverity, type AlertSeverity, type ConsolidatedAlert } from '../../domain/m21';
import type { BilanView } from '../../data/repo';
import type { Operation } from '../../domain/m1/types';

/** Rendu (icône + tonalité) par sévérité d'alerte consolidée. */
const SEVERITY_STYLE: Record<AlertSeverity, { tone: string; icon: typeof AlertTriangle }> = {
  danger: { tone: 'danger', icon: AlertTriangle },
  echeance: { tone: 'warning', icon: Clock },
  info: { tone: 'info', icon: ShieldCheck },
};

/**
 * Agrège les alertes de l'opération à partir des indicateurs déjà calculés
 * par les modules (RG-M21-01 : aucun recalcul financier ici).
 */
function deriveAlerts(op: Operation, bilan: BilanView | null, today: string): ConsolidatedAlert[] {
  const alerts: ConsolidatedAlert[] = [];
  if (bilan) {
    if (bilan.summary.marge.isNegative()) alerts.push({ source: 'm4', severity: 'danger', labelKey: 'alerts.marginNegative' });
    if (bilan.summary.coutTotal.gt(bilan.bac) && !bilan.bac.isZero())
      alerts.push({ source: 'm4', severity: 'danger', labelKey: 'alerts.budgetOverrun' });
    const revenueExpected = op.phase === 'realisation' || op.phase === 'reception' || op.phase === 'exploitation';
    if (revenueExpected && bilan.summary.recettesRealisees.isZero())
      alerts.push({ source: 'm6', severity: 'echeance', labelKey: 'alerts.noRevenue' });
  }
  if (op.endDate && op.endDate < today && op.status === 'active')
    alerts.push({ source: 'm12', severity: 'echeance', labelKey: 'alerts.deadlinePassed' });
  return consolidateAlerts(alerts);
}

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
  const alerts = deriveAlerts(op, bilan, new Date().toISOString().slice(0, 10));

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
        <div className="flex gap-2">
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

      {/* KPI bilan — calculés via Money.ts (alimentés par M4) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bilanLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 84 }} />)
        ) : (
          <>
            <StatCard label={t('bilan.cost')}>{bilan ? bilan.summary.coutTotal.format(locale) : '—'}</StatCard>
            <StatCard
              label={t('bilan.revenue')}
              hint={bilan ? t('bilan.revenueRealized', { amount: bilan.summary.recettesRealisees.format(locale) }) : undefined}
            >
              {bilan ? bilan.summary.recettes.format(locale) : '—'}
            </StatCard>
            <StatCard
              label={t('bilan.margin')}
              hint={bilan ? `${t('bilan.marginRate')} ${formatPercent(bilan.summary.tauxMarge, locale)}` : undefined}
            >
              {bilan ? (
                <span style={{ color: bilan.summary.marge.isNegative() ? 'var(--ax-danger)' : 'var(--ax-success)' }}>
                  {bilan.summary.marge.isNegative() ? '' : '+'}
                  {bilan.summary.marge.format(locale)}
                </span>
              ) : (
                '—'
              )}
            </StatCard>
            <StatCard label={t('bilan.tri')} emphasis>
              {bilan && bilan.tri != null ? formatPercent(bilan.tri, locale) : '—'}
            </StatCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Bilan + courbes (placeholder M4/M12) */}
        <Card tone="strong" className="md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[18px] font-medium">{t('cockpit.bilan')}</h2>
              <p className="mt-0.5 text-[13px] text-ink-2">{t('cockpit.bilan.subtitle')}</p>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={op.progress ?? 0} label={t('bilan.progress', { pct: formatPercent(op.progress ?? 0, locale, 0) })} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlaceholderWidget icon={<Activity size={16} />} title={t('cockpit.scurve')} />
            <PlaceholderWidget icon={<Wallet size={16} />} title={t('cockpit.cashflow')} />
          </div>
        </Card>

        {/* Alertes consolidées & priorisées (RG-M21-02) */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-medium">{t('cockpit.risks')}</h2>
            {alerts.length > 0 && (
              <span className="text-[11px] text-ink-3">
                {t('cockpit.alerts.count', {
                  danger: countBySeverity(alerts, 'danger'),
                  echeance: countBySeverity(alerts, 'echeance'),
                  info: countBySeverity(alerts, 'info'),
                })}
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
              <span style={{ color: 'var(--ax-success)', marginTop: 1 }}><ShieldCheck size={16} /></span>
              <span className="text-[13px] text-ink-2">{t('alerts.none')}</span>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {alerts.map((al, i) => {
                const { tone, icon: Icon } = SEVERITY_STYLE[al.severity];
                return (
                  <li key={`${al.source}-${i}`} className="flex items-start gap-3 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
                    <span style={{ color: `var(--ax-${tone})`, marginTop: 1 }}>
                      <Icon size={16} />
                    </span>
                    <span className="text-[13px] text-ink-2">{t(al.labelKey)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <TransitionDialog op={op} open={transitionOpen} onClose={() => setTransitionOpen(false)} onDone={refetch} />
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
