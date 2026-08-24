import { ChevronLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Skeleton, EmptyState, type TableRowData } from '../../ui';
import { reserveSeverityLabel, reserveStatusLabel, RESERVE_SEVERITY_TONE, RESERVE_STATUS_TONE } from './labels';
import { useOperation, useReserves } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { openReservesCount, majorOpenCount, clearedCount, canPronounceReception } from '../../domain/m19';

/**
 * Handoff 49 — Réserves & levées (M19). Registre des réserves de réception et
 * suivi de leur levée. La réception ne peut être prononcée tant qu'une réserve
 * majeure reste ouverte (RG-M19-01, `canPronounceReception`). Lecture seule ;
 * l'édition reste dans l'écran Réception & GPA.
 */
export function ReservesScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: reserves, loading } = useReserves(id);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = reserves ?? [];
  const open = openReservesCount(list);
  const majorOpen = majorOpenCount(list);
  const cleared = clearedCount(list);
  const gate = canPronounceReception(list);

  // Réserves ouvertes en tête, majeures d'abord, puis levées.
  const ordered = [...list].sort((a, b) => {
    const oa = a.status === 'ouverte' ? 0 : 1;
    const ob = b.status === 'ouverte' ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const sa = a.severity === 'majeure' ? 0 : 1;
    const sb = b.severity === 'majeure' ? 0 : 1;
    return sa - sb;
  });

  const rows: TableRowData[] = ordered.map((r) => ({
    cells: [
      <span>
        <span className="block font-medium">{r.label}</span>
        <span className="block text-[12px] text-ink-3">{r.location}</span>
      </span>,
      <Badge tone={RESERVE_SEVERITY_TONE[r.severity]}>{reserveSeverityLabel(r.severity)}</Badge>,
      <span className="mono">{formatDate(r.raisedAt, locale)}</span>,
      <span className="mono">{r.clearedAt ? formatDate(r.clearedAt, locale) : '—'}</span>,
      <Badge tone={RESERVE_STATUS_TONE[r.status]}>{reserveStatusLabel(r.status)}</Badge>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'reception', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('reserves.title')}</h1>
        </div>
      </div>

      {gate.ok ? (
        <Banner tone="success" icon={<CheckCircle2 size={16} />}>{t('reserves.canPronounce')}</Banner>
      ) : (
        <Banner tone="warning" icon={<AlertTriangle size={16} />}>{t('reserves.blocked', { n: majorOpen })}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('reserves.kpi.total'), value: list.length },
          { label: t('reserves.kpi.open'), value: open, accent: open > 0 },
          { label: t('reserves.kpi.major'), value: majorOpen, accent: majorOpen > 0 },
          { label: t('reserves.kpi.cleared'), value: cleared },
        ]}
      />

      <Panel title={t('reserves.list')} meta="RG-M19-01" bodyPadded={false}>
        <DataTable
          template="2fr 1fr 1fr 1fr auto"
          columns={[
            { label: t('reserves.col.label') },
            { label: t('reserves.col.severity') },
            { label: t('reserves.col.raised') },
            { label: t('reserves.col.cleared') },
            { label: t('reserves.col.status') },
          ]}
          rows={rows}
          empty={<EmptyState title={t('reserves.title')} description={t('reserves.empty')} />}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('reserves.subtitle')}</div>
    </div>
  );
}
