import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, KpiRow, Panel, Progress, Skeleton } from '../../ui';
import { useOperation, useSiteReports } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';

export function SiteReportDetailScreen({ id, crid }: { id: string; crid: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: rows, loading } = useSiteReports(id);
  const r = rows?.find((x) => x.id === crid) ?? null;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!r) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'pilotage', id })}>{t('common.back')}</Button>}>{t('site.notFound')}</Banner>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'pilotage', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="mono text-[13px] font-medium">CR #{r.number}</span>
            <span className="mono text-[12px] text-ink-3">{formatDate(r.date, locale)}</span>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('site.detail.title', { n: r.number })}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('site.col.author'), value: r.author },
          { label: t('site.col.progress'), value: formatPercent(r.progress, locale, 0), accent: true },
          { label: t('site.col.blockers'), value: r.blockers, accent: r.blockers > 0 },
        ]}
      />

      <Panel title={t('site.col.progress')}>
        <Progress value={r.progress} label={t('bilan.progress', { pct: formatPercent(r.progress, locale, 0) })} />
      </Panel>

      <Panel title={t('site.col.summary')}>
        <p className="text-[14px] text-ink-2">{r.summary || '—'}</p>
        {r.blockers > 0 && (
          <div className="mt-3"><Badge tone="warning">{t('site.detail.blockers', { n: r.blockers })}</Badge></div>
        )}
      </Panel>
    </div>
  );
}
