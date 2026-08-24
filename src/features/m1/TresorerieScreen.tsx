import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Skeleton, type TableRowData } from '../../ui';
import { useOperation, useBilan } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { planTresorerie } from '../../domain/finance/bilan';
import { Money } from '../../domain/money/Money';

export function TresorerieScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: bilan, loading } = useBilan(id);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 240 }} /></div>;

  const currency = op?.currency ?? 'XOF';
  const flows = bilan?.cashflow ?? [];
  const { cumule, besoinMax, pointBasIndex } = planTresorerie(flows);
  const max = Math.max(...cumule.map((v) => Math.abs(v)), 1);
  const money = (v: number) => Money.of(v, currency).format(locale);

  const rows: TableRowData[] = flows.map((flux, i) => ({
    cells: [
      <span className="mono">{t('tresorerie.period', { n: i + 1 })}</span>,
      <span className="mono" style={flux < 0 ? { color: 'var(--ax-danger)' } : undefined}>{flux > 0 ? '+' : ''}{money(flux)}</span>,
      <span className="mono" style={cumule[i] < 0 ? { color: 'var(--ax-danger)' } : undefined}>{money(cumule[i])}</span>,
      i === pointBasIndex ? <Badge tone="danger">{t('tresorerie.lowPoint')}</Badge> : <span className="text-ink-3">—</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'bilan', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('tresorerie.title')}</h1>
        </div>
      </div>

      {flows.length === 0 ? (
        <Banner tone="info" icon={<AlertTriangle size={16} />}>{t('tresorerie.empty')}</Banner>
      ) : (
        <>
          <KpiRow
            items={[
              { label: t('tresorerie.kpi.need'), value: money(Math.abs(besoinMax)), accent: besoinMax < 0 },
              { label: t('tresorerie.kpi.lowPoint'), value: pointBasIndex >= 0 ? t('tresorerie.period', { n: pointBasIndex + 1 }) : '—' },
              { label: t('tresorerie.kpi.final'), value: money(cumule[cumule.length - 1] ?? 0), accent: (cumule[cumule.length - 1] ?? 0) < 0 },
            ]}
          />

          <Panel title={t('tresorerie.curve')}>
            <div className="flex items-end gap-1.5" style={{ height: 180 }} aria-hidden="true">
              {cumule.map((v, i) => (
                <span
                  key={i}
                  className="flex-1"
                  title={money(v)}
                  style={{
                    height: `${Math.max(4, (Math.abs(v) / max) * 100)}%`,
                    background: i === pointBasIndex ? 'var(--ax-danger)' : v < 0 ? 'color-mix(in srgb, var(--ax-danger) 45%, transparent)' : 'color-mix(in srgb, var(--ax-accent) 45%, transparent)',
                  }}
                />
              ))}
            </div>
            <div className="mt-2 text-[11px] text-ink-3">{t('tresorerie.curve.help')}</div>
          </Panel>

          <Panel title={t('tresorerie.table')} bodyPadded={false}>
            <DataTable
              template="1fr 1.2fr 1.2fr 1fr"
              columns={[
                { label: t('tresorerie.col.period') },
                { label: t('tresorerie.col.flux'), align: 'right' },
                { label: t('tresorerie.col.cumule'), align: 'right' },
                { label: t('tresorerie.col.mark') },
              ]}
              rows={rows}
            />
          </Panel>
        </>
      )}

      <div className="text-[12px] text-ink-3">{t('tresorerie.subtitle')}</div>
    </div>
  );
}
