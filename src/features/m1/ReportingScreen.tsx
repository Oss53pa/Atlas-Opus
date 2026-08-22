import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, FileDown } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Modal, Skeleton, Textarea, useToast } from '../../ui';
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
            return (
              <Card key={snap.id} tone="strong">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{t(TYPE_KEY[snap.type])}</Badge>
                    <span className="text-[12px] text-ink-3">{t('reporting.generatedAt', { date: formatDate(snap.generatedAt.slice(0, 10), locale) })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="glass" size="sm" onClick={() => openExport(snap)}><FileDown size={14} />{t('reporting.export')}</Button>
                    {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('reporting.removed')} onClick={() => remove(snap.id)}><Trash2 size={15} /></Button>}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-ink-3">
                        <th className="pb-1 text-left font-normal">{t('reporting.col.metric')}</th>
                        <th className="pb-1 text-right font-normal">{t('reporting.col.value')}</th>
                        {delta && <th className="pb-1 text-right font-normal">{t('reporting.vsPrevious')}</th>}
                      </tr>
                    </thead>
                    <tbody className="mono">
                      <MetricRow label={t('reporting.metric.marge')} value={new Intl.NumberFormat(locale).format(Math.round(snap.data.marge))} delta={delta ? deltaMoney(delta.marge) : undefined} deltaPositive={delta ? delta.marge >= 0 : undefined} />
                      <MetricRow label={t('reporting.metric.recettesRealisees')} value={new Intl.NumberFormat(locale).format(Math.round(snap.data.recettesRealisees))} delta={delta ? deltaMoney(delta.recettesRealisees) : undefined} deltaPositive={delta ? delta.recettesRealisees >= 0 : undefined} />
                      <MetricRow label={t('reporting.metric.progress')} value={formatPercent(snap.data.progress, locale, 0)} delta={delta ? deltaMoney(Math.round(delta.progress * 100)) + ' pts' : undefined} deltaPositive={delta ? delta.progress >= 0 : undefined} />
                      <MetricRow label={t('reporting.metric.alerts')} value={`${snap.data.alertsDanger} / ${snap.data.alertsEcheance}`} />
                    </tbody>
                  </table>
                </div>
              </Card>
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

function MetricRow({ label, value, delta, deltaPositive }: { label: string; value: string; delta?: string; deltaPositive?: boolean }) {
  return (
    <tr style={{ borderTop: '1px solid var(--ax-border)' }}>
      <td className="py-1.5 pr-2 text-left" style={{ fontFamily: 'inherit' }}>{label}</td>
      <td className="py-1.5 text-right">{value}</td>
      {delta !== undefined && (
        <td className="py-1.5 text-right" style={{ color: deltaPositive ? 'var(--ax-success)' : 'var(--ax-danger)' }}>{delta}</td>
      )}
    </tr>
  );
}
