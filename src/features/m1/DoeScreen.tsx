import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, FolderCheck, Check, RotateCcw } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { doeCategoryLabel } from './labels';
import { useData, useOperation, useDoe } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { formatPercent } from '../../lib/format';
import {
  validatedCount, completeness, missingCategories,
  DOE_CATEGORIES, type DoeDocument, type DoeCategory,
} from '../../domain/doe';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function DoeScreen({ id }: { id: string }) {
  const { doe, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useDoe(id);

  const [rows, setRows] = useState<DoeDocument[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ category: DoeCategory; fileRef: string }>({ category: 'plans_recolement', fileRef: '' });

  async function add() {
    const input = { category: draft.category, fileRef: draft.fileRef || null };
    const reset = () => { setDraft({ category: 'plans_recolement', fileRef: '' }); setAdding(false); };
    // Offline-first (F3) : une pièce du DOE est collectée sur le terrain (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'doeDocuments', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, validated: false }]);
      reset();
      toast.push(t('doe.added.offline'), 'info');
      return;
    }
    const rec = await doe.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('doe.added'), 'success');
  }
  async function setValidated(did: string, validated: boolean) {
    const rec = await doe.setValidated(did, validated);
    setRows((r) => r.map((x) => (x.id === did ? rec : x)));
  }
  async function remove(did: string) {
    await doe.remove(did);
    setRows((r) => r.filter((x) => x.id !== did));
    toast.push(t('doe.removed'), 'info');
  }

  const ratio = completeness(rows);
  const missing = missingCategories(rows);
  const tableRows: TableRowData[] = rows.map((d) => ({
    cells: [
      <span className="font-medium">{doeCategoryLabel(d.category)}</span>,
      <span className="mono text-[12px] text-ink-3">{d.fileRef ?? '—'}</span>,
      <Badge tone={d.validated ? 'success' : 'neutral'}>{t(d.validated ? 'doe.validated' : 'doe.pending')}</Badge>,
      <span className="flex justify-end gap-1">
        {canEdit && (d.validated
          ? <Button variant="ghost" size="sm" onClick={() => setValidated(d.id, false)}><RotateCcw size={14} />{t('doe.invalidate')}</Button>
          : <Button variant="glass" size="sm" onClick={() => setValidated(d.id, true)}><Check size={14} />{t('doe.validate')}</Button>)}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('doe.removed')} onClick={() => remove(d.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><FolderCheck size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('doe.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('doe.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('doe.kpi.docs'), value: rows.length },
          { label: t('doe.kpi.validated'), value: validatedCount(rows) },
          { label: t('doe.kpi.completeness'), value: formatPercent(ratio, undefined, 0), accent: ratio < 1 },
        ]}
      />

      {missing.length > 0 && (
        <Banner tone="info">{t('doe.missing', { list: missing.map(doeCategoryLabel).join(', ') })}</Banner>
      )}

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="doe-cat" label={t('doe.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as DoeCategory }))}>
              {DOE_CATEGORIES.map((c) => <option key={c} value={c}>{doeCategoryLabel(c)}</option>)}
            </Select>
            <Field id="doe-ref" label={t('doe.field.fileRef')} value={draft.fileRef} onChange={(e) => setDraft((d) => ({ ...d, fileRef: e.target.value }))} placeholder="DOE/…" />
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
        <Card><EmptyState title={t('doe.title')} description={t('doe.empty')} /></Card>
      ) : (
        <Panel title={t('doe.register')} meta={formatPercent(ratio, undefined, 0)} bodyPadded={false}>
          <DataTable
            template="1.6fr 1.4fr 1fr auto"
            columns={[
              { label: t('doe.col.category') },
              { label: t('doe.col.fileRef') },
              { label: t('doe.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('doe.subtitle')}</div>
    </div>
  );
}
