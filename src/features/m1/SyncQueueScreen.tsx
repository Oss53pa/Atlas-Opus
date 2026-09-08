import { ChevronLeft, RefreshCw, X, RotateCcw } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, KpiRow, Panel, type TableRowData } from '../../ui';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import type { MessageKey } from '../../i18n';
import type { SyncStatus } from '../../domain/f3';

const STATUS_TONE: Record<SyncStatus, 'info' | 'neutral' | 'success' | 'warning' | 'danger'> = {
  queued: 'info', inflight: 'neutral', synced: 'success', retrying: 'warning', conflict: 'danger', rejected: 'danger',
};

/**
 * Écran « File de synchronisation » (F3). Vue détaillée des mutations hors-ligne :
 * statut, tentatives, erreur ; ré-essai et abandon unitaires, synchro globale.
 * Complète la bannière (compteurs) par une gestion fine, tenant-level.
 */
export function SyncQueueScreen() {
  const { navigate } = useNav();
  const { online, queue, pendingCount, conflictCount, rejectedCount, canSync, flush, retry, discard, discardResolved } = useOffline();

  const failed = conflictCount + rejectedCount;
  const ordered = [...queue].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const rows: TableRowData[] = ordered.map((m) => {
    const canRetry = m.status === 'conflict' || m.status === 'rejected';
    return {
      cells: [
        <span className="mono text-[13px]">{m.entity}</span>,
        <span className="text-ink-2">{t(`sync.op.${m.op}` as MessageKey)}</span>,
        <Badge tone={STATUS_TONE[m.status]}>{t(`sync.status.${m.status}` as MessageKey)}</Badge>,
        <span className="mono text-[12px] text-ink-3">{m.attempts}</span>,
        <span className="text-[12px] text-ink-3">{m.lastError ?? '—'}</span>,
        <span className="mono text-[12px] text-ink-3">{formatDate(m.createdAt.slice(0, 10), locale)}</span>,
        <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canRetry && (
            <Button variant="ghost" size="sm" icon aria-label={t('sync.action.retry')} onClick={() => retry(m.id)}><RotateCcw size={15} /></Button>
          )}
          <Button variant="ghost" size="sm" icon aria-label={t('sync.action.discard')} onClick={() => discard(m.id)}><X size={15} /></Button>
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{t('sync.context', { n: queue.length })}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('sync.title')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {failed > 0 && <Button variant="glass" size="sm" onClick={() => discardResolved()}><X size={14} />{t('sync.action.discardResolved')}</Button>}
          {online && pendingCount > 0 && canSync && (
            <Button variant="primary" size="sm" onClick={() => void flush()}><RefreshCw size={14} />{t('sync.action.syncAll')}</Button>
          )}
        </div>
      </div>

      {!online && <Banner tone="info">{t('etats.offline')}</Banner>}

      <KpiRow
        items={[
          { label: t('sync.kpi.pending'), value: pendingCount, accent: pendingCount > 0 },
          { label: t('sync.kpi.conflict'), value: conflictCount, accent: conflictCount > 0 },
          { label: t('sync.kpi.rejected'), value: rejectedCount, accent: rejectedCount > 0 },
        ]}
      />

      {queue.length === 0 ? (
        <Card><EmptyState title={t('sync.title')} description={t('sync.empty')} /></Card>
      ) : (
        <Panel title={t('sync.title')} bodyPadded={false}>
          <DataTable
            template="1.2fr 0.9fr 1fr 70px 1.6fr 1fr auto"
            columns={[
              { label: t('sync.col.entity') },
              { label: t('sync.col.op') },
              { label: t('sync.col.status') },
              { label: t('sync.col.attempts') },
              { label: t('sync.col.error') },
              { label: t('sync.col.date') },
              { label: '' },
            ]}
            rows={rows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('sync.subtitle')}</div>
    </div>
  );
}
