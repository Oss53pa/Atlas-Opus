import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { studyKindLabel, studyStatusLabel, STUDY_STATUS_TONE } from './labels';
import { useData, useOperation, useStudies } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatDate } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { STUDY_KINDS, type Study, type StudyKind } from '../../domain/m3/types';
import { nextStudyStatus, studiesCostTotal, validatedCount } from '../../domain/m3';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function EtudesScreen({ id }: { id: string }) {
  const { studies, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useStudies(id);

  const [rows, setRows] = useState<Study[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  // Études amont : édition côté MOA/AMO (droit programme).
  const canEdit = can(session.role, 'program.edit') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ kind: StudyKind; provider: string; cost: string; due: string; summary: string }>({
    kind: 'geotechnique', provider: '', cost: '', due: '', summary: '',
  });

  const total = studiesCostTotal(rows, currency);

  async function add() {
    if (!draft.provider.trim()) return;
    const rec = await studies.add(id, {
      kind: draft.kind, provider: draft.provider,
      cost: Number(draft.cost.replace(/[^\d]/g, '')) || 0,
      dueDate: draft.due || null, summary: draft.summary || null,
    });
    setRows((r) => [...r, rec]);
    setDraft({ kind: 'geotechnique', provider: '', cost: '', due: '', summary: '' });
    setAdding(false);
    toast.push(t('study.added'), 'success');
  }
  async function advance(s: Study) {
    const next = nextStudyStatus(s.status);
    if (!next) return;
    const rec = await studies.setStatus(s.id, next);
    setRows((r) => r.map((x) => (x.id === s.id ? rec : x)));
  }
  async function remove(sid: string) {
    await studies.remove(sid);
    setRows((r) => r.filter((x) => x.id !== sid));
    toast.push(t('study.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((s) => {
    const next = nextStudyStatus(s.status);
    return {
      cells: [
        <span className="font-medium">{studyKindLabel(s.kind)}</span>,
        <span className="text-ink-2">{s.provider}</span>,
        <span className="mono text-ink-3">{s.dueDate ? formatDate(s.dueDate, locale) : '—'}</span>,
        <span className="mono">{formatAmount(s.cost, locale)}</span>,
        <Badge tone={STUDY_STATUS_TONE[s.status]}>{studyStatusLabel(s.status)}</Badge>,
        <span className="flex justify-end gap-1">
          {canEdit && next && (
            <Button variant="glass" size="sm" onClick={() => advance(s)}>{t('study.advance')}<ArrowRight size={14} /></Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" icon aria-label={t('study.removed')} onClick={() => remove(s.id)}><Trash2 size={15} /></Button>
          )}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('study.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('study.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('study.kpi.total'), value: rows.length },
          { label: t('study.kpi.validated'), value: validatedCount(rows) },
          { label: t('study.kpi.cost'), value: <MoneyView amount={total.toMajorNumber()} currency={currency} /> },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="st-kind" label={t('study.field.kind')} value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as StudyKind }))}>
              {STUDY_KINDS.map((k) => <option key={k} value={k}>{studyKindLabel(k)}</option>)}
            </Select>
            <Field id="st-provider" label={t('study.field.provider')} value={draft.provider} onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))} />
            <Field id="st-cost" label={t('study.field.cost')} inputMode="numeric" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="st-due" label={t('study.field.due')} type="date" value={draft.due} onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} />
            <div className="sm:col-span-2">
              <Field id="st-summary" label={t('study.field.summary')} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} />
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
        <Card><EmptyState title={t('study.title')} description={t('study.empty')} /></Card>
      ) : (
        <Panel title={t('study.title')} meta={Money.of(total.toMajorNumber(), currency).format(locale)} bodyPadded={false}>
          <DataTable
            template="1.1fr 1.4fr 1fr 1fr 1fr auto"
            columns={[
              { label: t('study.col.kind') },
              { label: t('study.col.provider') },
              { label: t('study.col.due') },
              { label: t('study.col.cost'), align: 'right' },
              { label: t('study.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('study.subtitle')}</div>
    </div>
  );
}
