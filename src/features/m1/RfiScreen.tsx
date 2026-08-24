import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { rfiStatusLabel, rfiPriorityLabel, RFI_STATUS_TONE, RFI_PRIORITY_TONE } from './labels';
import { useData, useOperation, useRfis } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { openCount, urgentOpenCount, overdueCount, isOverdue, nextRfiStatus, RFI_PRIORITIES, type Rfi, type RfiPriority } from '../../domain/rfi';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function RfiScreen({ id }: { id: string }) {
  const { rfis, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useRfis(id);

  const [rows, setRows] = useState<Rfi[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ number: string; subject: string; question: string; raisedBy: string; priority: RfiPriority; due: string; document: string }>({
    number: '', subject: '', question: '', raisedBy: '', priority: 'normale', due: '', document: '',
  });

  async function add() {
    if (!draft.number.trim() || !draft.subject.trim()) return;
    const rec = await rfis.add(id, {
      number: draft.number, subject: draft.subject, question: draft.question, raisedBy: draft.raisedBy,
      priority: draft.priority, dueDate: draft.due || null, documentRef: draft.document || null,
    });
    setRows((r) => [...r, rec]);
    setDraft({ number: '', subject: '', question: '', raisedBy: '', priority: 'normale', due: '', document: '' });
    setAdding(false);
    toast.push(t('rfi.added'), 'success');
  }
  async function answer(r: Rfi) {
    const a = window.prompt(t('rfi.answer.prompt'), r.answer ?? '') ?? '';
    if (!a.trim()) return;
    const rec = await rfis.setStatus(r.id, 'repondue', a);
    setRows((rs) => rs.map((x) => (x.id === r.id ? rec : x)));
  }
  async function close(r: Rfi) {
    const rec = await rfis.setStatus(r.id, 'cloturee');
    setRows((rs) => rs.map((x) => (x.id === r.id ? rec : x)));
  }
  async function remove(rid: string) {
    await rfis.remove(rid);
    setRows((rs) => rs.filter((x) => x.id !== rid));
    toast.push(t('rfi.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((r) => {
    const next = nextRfiStatus(r.status);
    const overdue = isOverdue(r, now);
    return {
      onClick: () => navigate({ name: 'rfiDetail', id, rid: r.id }),
      cells: [
        <span className="mono text-[13px] font-medium">{r.number}</span>,
        <span>
          <span className="block font-medium">{r.subject}</span>
          <span className="block text-[12px] text-ink-3">{r.raisedBy}{r.documentRef ? ` · ${r.documentRef}` : ''}</span>
        </span>,
        <Badge tone={RFI_PRIORITY_TONE[r.priority]}>{rfiPriorityLabel(r.priority)}</Badge>,
        <span className="mono" style={overdue ? { color: 'var(--ax-danger)' } : { color: 'var(--ax-text-3)' }}>{r.dueDate ? formatDate(r.dueDate, locale) : '—'}</span>,
        <Badge tone={RFI_STATUS_TONE[r.status]}>{rfiStatusLabel(r.status)}</Badge>,
        <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && r.status === 'ouverte' && <Button variant="glass" size="sm" onClick={() => answer(r)}>{t('rfi.action.answer')}</Button>}
          {canEdit && r.status === 'repondue' && next && <Button variant="glass" size="sm" onClick={() => close(r)}>{t('rfi.action.close')}</Button>}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('rfi.removed')} onClick={() => remove(r.id)}><Trash2 size={15} /></Button>}
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
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('rfi.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('rfi.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('rfi.kpi.open'), value: openCount(rows) },
          { label: t('rfi.kpi.urgent'), value: urgentOpenCount(rows), accent: urgentOpenCount(rows) > 0 },
          { label: t('rfi.kpi.overdue'), value: overdueCount(rows, now), accent: overdueCount(rows, now) > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="rf-num" label={t('rfi.field.number')} value={draft.number} onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))} placeholder="RFI-043" />
            <Field id="rf-subj" label={t('rfi.field.subject')} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
            <Field id="rf-by" label={t('rfi.field.raisedBy')} value={draft.raisedBy} onChange={(e) => setDraft((d) => ({ ...d, raisedBy: e.target.value }))} />
            <Select id="rf-prio" label={t('rfi.field.priority')} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as RfiPriority }))}>
              {RFI_PRIORITIES.map((p) => <option key={p} value={p}>{rfiPriorityLabel(p)}</option>)}
            </Select>
            <Field id="rf-due" label={t('rfi.field.due')} type="date" value={draft.due} onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} />
            <Field id="rf-doc" label={t('rfi.field.document')} value={draft.document} onChange={(e) => setDraft((d) => ({ ...d, document: e.target.value }))} placeholder="STR-EXE-118" />
            <div className="sm:col-span-2">
              <Field id="rf-q" label={t('rfi.field.question')} value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
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
        <Card><EmptyState title={t('rfi.title')} description={t('rfi.empty')} /></Card>
      ) : (
        <Panel title={t('rfi.title')} bodyPadded={false}>
          <DataTable
            template="1fr 2.2fr 1fr 1fr 1fr auto"
            columns={[
              { label: t('rfi.col.number') },
              { label: t('rfi.col.subject') },
              { label: t('rfi.col.priority') },
              { label: t('rfi.col.due') },
              { label: t('rfi.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('rfi.subtitle')}</div>
    </div>
  );
}
