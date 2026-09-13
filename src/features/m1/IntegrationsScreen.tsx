import { ChevronLeft, Plug, RotateCcw, Zap } from 'lucide-react';
import { Badge, Button, DataTable, KpiRow, Panel, Skeleton, EmptyState, useToast, type TableRowData } from '../../ui';
import { useData, useIntegrationEndpoints, useOutbox } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { formatDate } from '../../lib/format';
import { effectiveCircuitState, outboxBacklog, canManualRetry } from '../../domain/f5/contract';
import { can } from '../../domain/m1/permissions';
import type { CircuitState, DeliveryStatus } from '../../domain/f5/types';

const CIRCUIT_TONE: Record<CircuitState, 'success' | 'warning' | 'danger'> = {
  closed: 'success', half_open: 'warning', open: 'danger',
};
const DELIVERY_TONE: Record<DeliveryStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  pending: 'neutral', inflight: 'accent', delivered: 'success', retrying: 'warning', dead: 'danger',
};

/**
 * F5 — Console d'intégration (lecture). Santé des systèmes tiers (disjoncteur,
 * état effectif tenant compte du cooldown) et file outbox (backlog, reprises,
 * lettres mortes). Vue tenant, consolidée. Réf CLAUDE.md §8 (F5) / gate (idempotence,
 * panne tierce gérée). Les reprises manuelles sont pilotées par le worker (cron).
 */
export function IntegrationsScreen() {
  const { navigate } = useNav();
  const { integrations, session } = useData();
  const toast = useToast();
  const { data: endpoints, loading: le, refetch: refetchEndpoints } = useIntegrationEndpoints();
  const { data: outbox, loading: lo, refetch: refetchOutbox } = useOutbox(50);
  const now = new Date().toISOString();
  const systemLabel = (s: string) => t(`f5.system.${s}` as MessageKey);
  const canManage = can(session.role, 'integration.manage');

  async function retry(outboxId: string) {
    try {
      await integrations.retry(outboxId);
      toast.push(t('f5.retry.done'), 'success');
      refetchOutbox();
    } catch {
      toast.push(t('f5.action.error'), 'danger');
    }
  }
  async function resetCircuit(endpointId: string) {
    try {
      await integrations.resetCircuit(endpointId);
      toast.push(t('f5.reset.done'), 'success');
      refetchEndpoints();
    } catch {
      toast.push(t('f5.action.error'), 'danger');
    }
  }

  if (le || lo) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 320 }} /><Skeleton style={{ height: 220 }} /></div>;

  const eps = endpoints ?? [];
  const msgs = outbox ?? [];
  const backlog = outboxBacklog(msgs);
  const openCircuits = eps.filter((e) => effectiveCircuitState(e.circuit, now) === 'open').length;

  const epRows: TableRowData[] = eps.map((e) => {
    const eff = effectiveCircuitState(e.circuit, now);
    return {
      cells: [
        <span className="font-medium">{systemLabel(e.system)}</span>,
        <Badge tone={e.status === 'active' ? 'success' : 'neutral'}>{t(`f5.endpoint.${e.status}` as MessageKey)}</Badge>,
        <Badge tone={CIRCUIT_TONE[eff]}>{t(`f5.circuit.${eff}` as MessageKey)}</Badge>,
        <span className="mono text-[13px] text-ink-3">{e.circuit.failures}</span>,
        <span className="mono text-[12px] text-ink-3">{e.circuit.openedAt ? formatDate(e.circuit.openedAt, undefined) : '—'}</span>,
        <span className="flex justify-end">
          {canManage && eff !== 'closed' && (
            <Button variant="glass" size="sm" onClick={() => resetCircuit(e.id)}><Zap size={14} />{t('f5.reset')}</Button>
          )}
        </span>,
      ],
    };
  });

  const obRows: TableRowData[] = msgs.map((m) => ({
    cells: [
      <span className="font-medium">{systemLabel(m.system)}</span>,
      <span className="text-[13px]">{m.kind}</span>,
      <span className="mono text-[12px] text-ink-3">{m.businessId}</span>,
      <Badge tone={DELIVERY_TONE[m.status]}>{t(`f5.delivery.${m.status}` as MessageKey)}</Badge>,
      <span className="mono text-[13px] text-ink-3">{m.attempts}</span>,
      <span className="text-[12px] text-danger">{m.lastError ?? ''}</span>,
      <span className="flex justify-end">
        {canManage && canManualRetry(m.status) && (
          <Button variant="glass" size="sm" onClick={() => retry(m.id)}><RotateCcw size={14} />{t('f5.retry')}</Button>
        )}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3"><Plug size={12} className="mb-0.5 inline" /> {t('f5.subtitle')}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('f5.title')}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('f5.kpi.systems'), value: eps.filter((e) => e.status === 'active').length, sub: t('f5.kpi.systemsSub', { n: eps.length }) },
          { label: t('f5.kpi.openCircuits'), value: openCircuits, accent: openCircuits > 0 },
          { label: t('f5.kpi.pending'), value: backlog.pending + backlog.retrying, sub: t('f5.kpi.pendingSub') },
          { label: t('f5.kpi.dead'), value: backlog.dead, accent: backlog.dead > 0 },
        ]}
      />

      <Panel title={t('f5.endpoints')} meta={t('f5.endpoints.meta')} bodyPadded={false}>
        <DataTable
          template="1.4fr 0.9fr 1fr 90px 1fr auto"
          columns={[
            { label: t('f5.col.system') },
            { label: t('f5.col.status') },
            { label: t('f5.col.circuit') },
            { label: t('f5.col.failures'), align: 'right' },
            { label: t('f5.col.openedAt') },
            { label: '' },
          ]}
          rows={epRows}
          empty={<EmptyState title={t('f5.title')} description={t('f5.endpoints.empty')} />}
        />
      </Panel>

      <Panel title={t('f5.outbox')} meta={t('f5.outbox.meta')} bodyPadded={false}>
        <DataTable
          template="1.1fr 1.1fr 1fr 1fr 70px 1.3fr auto"
          columns={[
            { label: t('f5.col.system') },
            { label: t('f5.col.kind') },
            { label: t('f5.col.businessId') },
            { label: t('f5.col.delivery') },
            { label: t('f5.col.attempts'), align: 'right' },
            { label: t('f5.col.error') },
            { label: '' },
          ]}
          rows={obRows}
          empty={<EmptyState title={t('f5.outbox')} description={t('f5.outbox.empty')} />}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('f5.note')}</div>
    </div>
  );
}
