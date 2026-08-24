import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { docCategoryLabel, libraryStatusLabel, LIBRARY_STATUS_TONE } from './labels';
import { useData, useOperation, useLibrary } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { publishedCount, distinctCategories, nextLibraryStatus, DOC_CATEGORIES, type LibraryDoc, type DocCategory } from '../../domain/m22';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function DocumentsScreen({ id }: { id: string }) {
  const { library, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useLibrary(id);

  const [rows, setRows] = useState<LibraryDoc[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; category: DocCategory; reference: string }>({ name: '', category: 'contrat', reference: '' });

  async function add() {
    if (!draft.name.trim()) return;
    const rec = await library.add(id, draft);
    setRows((r) => [rec, ...r]);
    setDraft({ name: '', category: 'contrat', reference: '' });
    setAdding(false);
    toast.push(t('lib.added'), 'success');
  }
  async function advance(d: LibraryDoc) {
    const next = nextLibraryStatus(d.status);
    if (!next) return;
    const rec = await library.setStatus(d.id, next);
    setRows((r) => r.map((x) => (x.id === d.id ? rec : x)));
  }
  async function remove(did: string) {
    await library.remove(did);
    setRows((r) => r.filter((x) => x.id !== did));
    toast.push(t('lib.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((d) => {
    const next = nextLibraryStatus(d.status);
    return {
      cells: [
        <span>
          <span className="block font-medium">{d.name}</span>
          <span className="block text-[12px] text-ink-3">{d.reference || '—'} · {formatDate(d.updatedAt.slice(0, 10), locale)}</span>
        </span>,
        <span className="text-ink-2">{docCategoryLabel(d.category)}</span>,
        <span className="mono">v{d.version}</span>,
        <Badge tone={LIBRARY_STATUS_TONE[d.status]}>{libraryStatusLabel(d.status)}</Badge>,
        <span className="flex justify-end gap-1">
          {canEdit && next && (
            <Button variant="glass" size="sm" onClick={() => advance(d)}>{t(d.status === 'brouillon' ? 'lib.action.publie' : 'lib.action.archive')}</Button>
          )}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('lib.removed')} onClick={() => remove(d.id)}><Trash2 size={15} /></Button>}
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
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('lib.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('lib.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('lib.kpi.count'), value: rows.length },
          { label: t('lib.kpi.published'), value: publishedCount(rows) },
          { label: t('lib.kpi.categories'), value: distinctCategories(rows) },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="lb-name" label={t('lib.field.name')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Select id="lb-cat" label={t('lib.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as DocCategory }))}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{docCategoryLabel(c)}</option>)}
            </Select>
            <div className="sm:col-span-2">
              <Field id="lb-ref" label={t('lib.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
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
        <Card><EmptyState title={t('lib.title')} description={t('lib.empty')} /></Card>
      ) : (
        <Panel title={t('lib.title')} bodyPadded={false}>
          <DataTable
            template="2.2fr 1.2fr 80px 1fr auto"
            columns={[
              { label: t('lib.col.name') },
              { label: t('lib.col.category') },
              { label: t('lib.col.version') },
              { label: t('lib.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('lib.subtitle')}</div>
    </div>
  );
}
