import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { docDisciplineLabel, docStatusLabel, DOC_STATUS_TONE } from './labels';
import { useData, useOperation, useDocuments } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { approvedCount, pendingVisaCount, canVisa, DOC_DISCIPLINES, type Document, type DocDiscipline, type DocStatus } from '../../domain/ged';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function ConceptionScreen({ id }: { id: string }) {
  const { documents, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useDocuments(id);

  const [rows, setRows] = useState<Document[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ reference: string; title: string; discipline: DocDiscipline; indice: string }>({
    reference: '', title: '', discipline: 'architecture', indice: 'A',
  });

  async function add() {
    if (!draft.reference.trim() || !draft.title.trim()) return;
    const rec = await documents.add(id, draft);
    setRows((r) => [...r, rec]);
    setDraft({ reference: '', title: '', discipline: 'architecture', indice: 'A' });
    setAdding(false);
    toast.push(t('doc.added'), 'success');
  }
  async function setStatus(did: string, status: DocStatus) {
    const rec = await documents.setStatus(did, status);
    setRows((r) => r.map((x) => (x.id === did ? rec : x)));
  }
  async function remove(did: string) {
    await documents.remove(did);
    setRows((r) => r.filter((x) => x.id !== did));
    toast.push(t('doc.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((d) => ({
    onClick: () => navigate({ name: 'docVisa', id, did: d.id }),
    cells: [
      <span className="mono text-[13px] font-medium">{d.reference}</span>,
      <span>{d.title}</span>,
      <span className="text-ink-2">{docDisciplineLabel(d.discipline)}</span>,
      <span className="mono">{d.indice}</span>,
      <Badge tone={DOC_STATUS_TONE[d.status]}>{docStatusLabel(d.status)}</Badge>,
      <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {canEdit && d.status === 'en_cours' && (
          <Button variant="glass" size="sm" onClick={() => setStatus(d.id, 'diffuse')}>{t('doc.action.diffuse')}</Button>
        )}
        {canEdit && canVisa(d.status) && (
          <>
            <Button variant="glass" size="sm" onClick={() => setStatus(d.id, 'vise_a')}>{t('doc.action.vise_a')}</Button>
            <Button variant="glass" size="sm" onClick={() => setStatus(d.id, 'vise_b')}>{t('doc.action.vise_b')}</Button>
            <Button variant="glass" size="sm" onClick={() => setStatus(d.id, 'vise_c')}>{t('doc.action.vise_c')}</Button>
          </>
        )}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('doc.removed')} onClick={() => remove(d.id)}><Trash2 size={15} /></Button>}
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
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('doc.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('doc.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('doc.kpi.count'), value: rows.length },
          { label: t('doc.kpi.approved'), value: approvedCount(rows) },
          { label: t('doc.kpi.pending'), value: pendingVisaCount(rows), accent: pendingVisaCount(rows) > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="dc-ref" label={t('doc.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} placeholder="STR-EXE-118" />
            <Field id="dc-title" label={t('doc.field.title')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <Select id="dc-disc" label={t('doc.field.discipline')} value={draft.discipline} onChange={(e) => setDraft((d) => ({ ...d, discipline: e.target.value as DocDiscipline }))}>
              {DOC_DISCIPLINES.map((c) => <option key={c} value={c}>{docDisciplineLabel(c)}</option>)}
            </Select>
            <Field id="dc-ind" label={t('doc.field.indice')} value={draft.indice} onChange={(e) => setDraft((d) => ({ ...d, indice: e.target.value }))} />
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
        <Card><EmptyState title={t('doc.title')} description={t('doc.empty')} /></Card>
      ) : (
        <Panel title={t('doc.title')} bodyPadded={false}>
          <DataTable
            template="1.2fr 2fr 1fr 70px 1fr auto"
            columns={[
              { label: t('doc.col.reference') },
              { label: t('doc.col.title') },
              { label: t('doc.col.discipline') },
              { label: t('doc.col.indice') },
              { label: t('doc.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('doc.subtitle')}</div>
    </div>
  );
}
