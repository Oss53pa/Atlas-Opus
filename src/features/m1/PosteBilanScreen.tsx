import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Banner, Button, DataTable, KpiRow, Panel, Skeleton, type TableRowData } from '../../ui';
import { posteLabel } from './labels';
import { useOperation, useBilanLines } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';

export function PosteBilanScreen({ id, poste }: { id: string; poste: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: lines, loading } = useBilanLines(id);
  const currency = op?.currency ?? 'XOF';

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;

  const rows = (lines ?? []).filter((l) => l.poste === poste);
  if (rows.length === 0) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'bilan', id })}>{t('common.back')}</Button>}>{t('poste.notFound')}</Banner>;

  const kind = rows[0].kind;
  const planned = rows.reduce((s, l) => s + l.amountPlanned, 0);
  const actual = rows.reduce((s, l) => s + l.amountActual, 0);
  const ratio = planned > 0 ? actual / planned : 0;
  const money = (v: number) => Money.of(v, currency).format(locale);

  const tableRows: TableRowData[] = rows.map((l) => ({
    cells: [
      <span className="font-medium">{posteLabel(l.poste)}</span>,
      <span className="mono">{formatAmount(l.amountPlanned, locale)}</span>,
      <span className="mono text-ink-3">{formatAmount(l.amountActual, locale)}</span>,
      <span className="mono">{formatPercent(l.amountPlanned > 0 ? l.amountActual / l.amountPlanned : 0, locale, 0)}</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'bilan', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[13px] text-ink-3">{op?.name} · {t(kind === 'cost' ? 'bilan.section.costs' : 'bilan.section.revenues')}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{posteLabel(poste)}</h1>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('bilan.col.planned'), value: money(planned) },
          { label: t('bilan.col.actual'), value: money(actual) },
          { label: t('poste.consumption'), value: formatPercent(ratio, locale, 0), accent: ratio > 1 },
        ]}
      />

      <Panel title={t('poste.lines')} bodyPadded={false}>
        <DataTable
          template="2fr 1.2fr 1.2fr 1fr"
          columns={[
            { label: t('bilan.col.poste') },
            { label: t('bilan.col.planned'), align: 'right' },
            { label: t('bilan.col.actual'), align: 'right' },
            { label: t('poste.consumption'), align: 'right' },
          ]}
          rows={tableRows}
          total={{ cells: [t('bilan.total'), <span className="mono">{formatAmount(planned, locale)}</span>, <span className="mono">{formatAmount(actual, locale)}</span>, <span className="mono">{formatPercent(ratio, locale, 0)}</span>] }}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('poste.subtitle')}</div>
    </div>
  );
}
