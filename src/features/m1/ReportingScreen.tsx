import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, FileDown } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Modal, Panel, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { useData, useOperation, useBilan, useReports } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { isReadOnlyForRole } from '../../domain/m1/rules';
import { can } from '../../domain/m1/permissions';
import {
  REPORT_TYPES,
  compareReports,
  reportToMarkdown,
  deriveOperationAlerts,
  countBySeverity,
  type ReportType,
  type ReportData,
  type ReportSnapshot,
} from '../../domain/m21';
import { bilanToAlertFacts } from './alerts';

const TYPE_KEY: Record<ReportType, MessageKey> = {
  hebdo: 'reporting.type.hebdo',
  mensuel: 'reporting.type.mensuel',
  deep_dive: 'reporting.type.deep_dive',
};

/** Signe + valeur formatée d'un écart monétaire (unités majeures). */
function deltaMoney(n: number): string {
  const s = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(n));
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}`;
}

export function ReportingScreen({ id }: { id: string }) {
  const { reporting, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: bilan } = useBilan(id);
  const { data: loaded, loading } = useReports(id);

  const [rows, setRows] = useState<ReportSnapshot[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const [exportMd, setExportMd] = useState<string | null>(null);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.read') && !readOnly; // reporting : lecture large, génération par tout rôle éditeur d'opération

  /** Construit le cliché courant à partir des indicateurs déjà calculés (RG-M21-01). */
  function currentData(): ReportData {
    const today = new Date().toISOString().slice(0, 10);
    const alerts = op ? deriveOperationAlerts(bilanToAlertFacts(op, bilan, today)) : [];
    return {
      coutTotal: bilan ? bilan.summary.coutTotal.toMajorNumber() : 0,
      recettes: bilan ? bilan.summary.recettes.toMajorNumber() : 0,
      recettesRealisees: bilan ? bilan.summary.recettesRealisees.toMajorNumber() : 0,
      marge: bilan ? bilan.summary.marge.toMajorNumber() : 0,
      tauxMarge: bilan ? bilan.summary.tauxMarge : 0,
      tri: bilan ? bilan.tri : null,
      progress: op?.progress ?? 0,
      alertsDanger: countBySeverity(alerts, 'danger'),
      alertsEcheance: countBySeverity(alerts, 'echeance'),
    };
  }

  async function generate(type: ReportType) {
    const period = new Date().toISOString().slice(0, 10);
    const rec = await reporting.generate(id, { type, period, data: currentData() });
    setRows((r) => [rec, ...r]);
    toast.push(t('reporting.generated'), 'success');
  }
  async function remove(rid: string) {
    await reporting.remove(rid);
    setRows((r) => r.filter((x) => x.id !== rid));
    toast.push(t('reporting.removed'), 'info');
  }
  function openExport(snap: ReportSnapshot) {
    setExportMd(reportToMarkdown({ operationName: op?.name ?? '', currency }, snap));
  }
  async function copyExport() {
    if (exportMd && navigator.clipboard) {
      await navigator.clipboard.writeText(exportMd);
      toast.push(t('reporting.export.copied'), 'success');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('reporting.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((ty) => (
              <Button key={ty} variant={ty === 'deep_dive' ? 'primary' : 'glass'} size="sm" onClick={() => generate(ty)}>
                <Plus size={16} />
                {t(TYPE_KEY[ty])}
              </Button>
            ))}
          </div>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      {loading ? (
        <Card><div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 120 }} />)}</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('reporting.title')} description={t('reporting.empty')} /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((snap, i) => {
            const prev = rows[i + 1]; // rows triés du + récent au + ancien
            const delta = prev ? compareReports(prev.data, snap.data) : null;
            const deltaCell = (n: number) => (
              <span style={{ color: n >= 0 ? 'var(--ax-text-2)' : 'var(--ax-danger)' }}>{deltaMoney(n)}</span>
            );
            const metricRows: TableRowData[] = [
              { cells: [t('reporting.metric.marge'), <span className="mono">{new Intl.NumberFormat(locale).format(Math.round(snap.data.marge))}</span>, ...(delta ? [<span className="mono">{deltaCell(delta.marge)}</span>] : [])] },
              { cells: [t('reporting.metric.recettesRealisees'), <span className="mono">{new Intl.NumberFormat(locale).format(Math.round(snap.data.recettesRealisees))}</span>, ...(delta ? [<span className="mono">{deltaCell(delta.recettesRealisees)}</span>] : [])] },
              { cells: [t('reporting.metric.progress'), <span className="mono">{formatPercent(snap.data.progress, locale, 0)}</span>, ...(delta ? [<span className="mono" style={{ color: delta.progress >= 0 ? 'var(--ax-text-2)' : 'var(--ax-danger)' }}>{deltaMoney(Math.round(delta.progress * 100))} pts</span>] : [])] },
              { cells: [t('reporting.metric.alerts'), <span className="mono">{snap.data.alertsDanger} / {snap.data.alertsEcheance}</span>, ...(delta ? [<span className="text-ink-3">—</span>] : [])] },
            ];
            return (
              <Panel
                key={snap.id}
                title={
                  <span className="flex items-center gap-2">
                    <Badge tone="accent">{t(TYPE_KEY[snap.type])}</Badge>
                    <span className="text-[12px] font-normal text-ink-3">{t('reporting.generatedAt', { date: formatDate(snap.generatedAt.slice(0, 10), locale) })}</span>
                  </span>
                }
                actions={
                  <>
                    <Button variant="glass" size="sm" onClick={() => openExport(snap)}><FileDown size={14} />{t('reporting.export')}</Button>
                    {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('reporting.removed')} onClick={() => remove(snap.id)}><Trash2 size={15} /></Button>}
                  </>
                }
                bodyPadded={false}
              >
                <DataTable
                  template={delta ? '1.4fr 1fr 1fr' : '1.4fr 1fr'}
                  columns={
                    delta
                      ? [{ label: t('reporting.col.metric') }, { label: t('reporting.col.value'), align: 'right' }, { label: t('reporting.vsPrevious'), align: 'right' }]
                      : [{ label: t('reporting.col.metric') }, { label: t('reporting.col.value'), align: 'right' }]
                  }
                  rows={metricRows}
                />
              </Panel>
            );
          })}
        </div>
      )}

      <div className="text-[12px] text-ink-3">{t('reporting.subtitle')}</div>

      <Modal
        open={exportMd !== null}
        title={t('reporting.export.title')}
        onClose={() => setExportMd(null)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setExportMd(null)}>{t('common.close')}</Button>
            <Button variant="primary" size="sm" onClick={copyExport}>{t('reporting.export.copy')}</Button>
          </>
        }
      >
        <Textarea id="export-md" label={t('reporting.export.title')} value={exportMd ?? ''} readOnly rows={16} />
      </Modal>
    </div>
  );
}

