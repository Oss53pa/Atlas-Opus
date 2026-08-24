import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Skeleton, type TableRowData } from '../../ui';
import { useOperation, useReports } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { compareReports, type ReportType, type ReportDelta } from '../../domain/m21';

const TYPE_KEY: Record<ReportType, MessageKey> = {
  hebdo: 'reporting.type.hebdo',
  mensuel: 'reporting.type.mensuel',
  deep_dive: 'reporting.type.deep_dive',
};

const int = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n));
function deltaText(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)))}`;
}

/**
 * Handoff 37 — Arrêté de bilan (M4/M21). Détail d'un cliché figé : indicateurs
 * financiers gelés à la date d'arrêté et comparaison au précédent (RG-M21-03).
 * Lecture seule : le cliché est immuable une fois généré (RG-M21-01).
 */
export function ArreteBilanScreen({ id, rid }: { id: string; rid: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: reports, loading } = useReports(id);

  const currency = op?.currency ?? 'XOF';

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const rows = reports ?? [];
  const idx = rows.findIndex((r) => r.id === rid);
  const snap = idx >= 0 ? rows[idx] : null;
  if (!snap) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'reporting', id })}>{t('common.back')}</Button>}>{t('arrete.notFound')}</Banner>;

  const prev = rows[idx + 1]; // rows triés du + récent au + ancien
  const delta: ReportDelta | null = prev ? compareReports(prev.data, snap.data) : null;
  const d = snap.data;

  const deltaCell = (n: number, unit?: string) => (
    <span className="mono" style={{ color: n >= 0 ? 'var(--ax-text-2)' : 'var(--ax-danger)' }}>{deltaText(n)}{unit ?? ''}</span>
  );

  const metricRows: TableRowData[] = [
    { cells: [t('bilan.cost'), <span className="mono">{int(d.coutTotal)}</span>, ...(delta ? [deltaCell(delta.coutTotal)] : [])] },
    { cells: [t('bilan.revenue'), <span className="mono">{int(d.recettes)}</span>, ...(delta ? [deltaCell(delta.recettes)] : [])] },
    { cells: [t('reporting.metric.recettesRealisees'), <span className="mono">{int(d.recettesRealisees)}</span>, ...(delta ? [deltaCell(delta.recettesRealisees)] : [])] },
    { cells: [t('bilan.margin'), <span className="mono" style={d.marge < 0 ? { color: 'var(--ax-danger)' } : undefined}>{int(d.marge)}</span>, ...(delta ? [deltaCell(delta.marge)] : [])] },
    { cells: [t('arrete.tauxMarge'), <span className="mono">{formatPercent(d.tauxMarge, locale)}</span>, ...(delta ? [<span className="text-ink-3">—</span>] : [])] },
    { cells: [t('arrete.tri'), <span className="mono">{d.tri != null ? formatPercent(d.tri, locale) : '—'}</span>, ...(delta ? [<span className="text-ink-3">—</span>] : [])] },
    { cells: [t('reporting.metric.progress'), <span className="mono">{formatPercent(d.progress, locale, 0)}</span>, ...(delta ? [deltaCell(Math.round(delta.progress * 100), ' pts')] : [])] },
    { cells: [t('reporting.metric.alerts'), <span className="mono">{d.alertsDanger} / {d.alertsEcheance}</span>, ...(delta ? [<span className="text-ink-3">—</span>] : [])] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'reporting', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="accent">{t(TYPE_KEY[snap.type])}</Badge>
            <span className="text-[12px] text-ink-3">{t('arrete.at', { date: formatDate(snap.generatedAt.slice(0, 10), locale) })}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('arrete.title')}</h1>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('bilan.cost'), value: `${int(d.coutTotal)} ${currency}` },
          { label: t('bilan.margin'), value: `${d.marge < 0 ? '' : '+'}${int(d.marge)}`, accent: d.marge < 0 },
          { label: t('arrete.tauxMarge'), value: formatPercent(d.tauxMarge, locale) },
          { label: t('arrete.tri'), value: d.tri != null ? formatPercent(d.tri, locale) : '—' },
        ]}
      />

      <Panel title={t('arrete.frozen')} bodyPadded={false}>
        <DataTable
          template={delta ? '1.4fr 1fr 1fr' : '1.4fr 1fr'}
          columns={
            delta
              ? [{ label: t('reporting.col.metric') }, { label: t('reporting.col.value'), align: 'right' }, { label: t('arrete.vsPrevious'), align: 'right' }]
              : [{ label: t('reporting.col.metric') }, { label: t('reporting.col.value'), align: 'right' }]
          }
          rows={metricRows}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('arrete.subtitle')}</div>
    </div>
  );
}
