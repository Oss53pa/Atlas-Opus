import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Progress, Skeleton, useToast, type TableRowData } from '../../ui';
import { useData, useOperation, useSiteReports } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate, formatPercent } from '../../lib/format';
import { latestProgress, totalBlockers, type SiteReport } from '../../domain/m13';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function PilotageScreen({ id }: { id: string }) {
  const { siteReports, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useSiteReports(id);

  const [rows, setRows] = useState<SiteReport[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'planning.edit') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: today(), author: '', progress: '', summary: '', blockers: '0' });

  async function add() {
    if (!draft.author.trim()) return;
    const rec = await siteReports.add(id, {
      date: draft.date || today(), author: draft.author,
      progress: Math.min(100, Number(draft.progress.replace(/[^\d]/g, '')) || 0) / 100,
      summary: draft.summary, blockers: Number(draft.blockers.replace(/[^\d]/g, '')) || 0,
    });
    setRows((r) => [rec, ...r]);
    setDraft({ date: today(), author: '', progress: '', summary: '', blockers: '0' });
    setAdding(false);
    toast.push(t('site.added'), 'success');
  }
  async function remove(rid: string) {
    await siteReports.remove(rid);
    setRows((r) => r.filter((x) => x.id !== rid));
    toast.push(t('site.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((r) => ({
    cells: [
      <span className="mono text-[13px]">#{r.number}</span>,
      <span className="mono text-ink-3">{formatDate(r.date, locale)}</span>,
      <span className="text-ink-2">{r.author}</span>,
      <span className="flex items-center gap-2">
        <span className="ax-progress" style={{ width: 64 }}><span className="ax-progress__bar block" style={{ width: `${Math.round(r.progress * 100)}%` }} /></span>
        <span className="mono text-[12px] text-ink-3">{formatPercent(r.progress, locale, 0)}</span>
      </span>,
      r.blockers > 0 ? <Badge tone="warning">{r.blockers}</Badge> : <span className="text-ink-3">—</span>,
      <span>{r.summary || '—'}</span>,
      <span className="flex justify-end">
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('site.removed')} onClick={() => remove(r.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('site.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('site.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('site.kpi.count'), value: rows.length },
          { label: t('site.kpi.progress'), value: formatPercent(latestProgress(rows), locale, 0), accent: true },
          { label: t('site.kpi.blockers'), value: totalBlockers(rows), accent: totalBlockers(rows) > 0 },
        ]}
      />

      {rows.length > 0 && (
        <Panel title={t('site.kpi.progress')}>
          <Progress value={latestProgress(rows)} label={t('bilan.progress', { pct: formatPercent(latestProgress(rows), locale, 0) })} />
        </Panel>
      )}

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="cr-date" label={t('site.field.date')} type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            <Field id="cr-author" label={t('site.field.author')} value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />
            <Field id="cr-progress" label={t('site.field.progress')} inputMode="numeric" value={draft.progress} onChange={(e) => setDraft((d) => ({ ...d, progress: e.target.value.replace(/[^\d]/g, '') }))} placeholder="62" />
            <Field id="cr-blockers" label={t('site.field.blockers')} inputMode="numeric" value={draft.blockers} onChange={(e) => setDraft((d) => ({ ...d, blockers: e.target.value.replace(/[^\d]/g, '') }))} />
            <div className="sm:col-span-2">
              <Field id="cr-summary" label={t('site.field.summary')} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('site.title')} description={t('site.empty')} /></Card>
      ) : (
        <Panel title={t('site.title')} bodyPadded={false}>
          <DataTable
            template="60px 1fr 1.3fr 1.3fr 90px 2fr auto"
            columns={[
              { label: t('site.col.number') },
              { label: t('site.col.date') },
              { label: t('site.col.author') },
              { label: t('site.col.progress') },
              { label: t('site.col.blockers') },
              { label: t('site.col.summary') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('site.subtitle')}</div>
    </div>
  );
}
