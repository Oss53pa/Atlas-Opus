import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { criterionTypeLabel, CRITERION_TYPE_TONE } from './labels';
import { useData, useOperation, useEvaluationCriteria } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { totalWeight, isWeightBalanced, CRITERION_TYPES, type EvaluationCriterion, type CriterionType } from '../../domain/evaluationCriterion';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function CriteresScreen({ id }: { id: string }) {
  const { evaluationCriteria, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useEvaluationCriteria(id);

  const [rows, setRows] = useState<EvaluationCriterion[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ label: string; type: CriterionType; weightPct: string }>({ label: '', type: 'technique', weightPct: '' });

  const total = useMemo(() => totalWeight(rows), [rows]);
  const balanced = useMemo(() => isWeightBalanced(rows), [rows]);

  async function add() {
    const pct = Number(draft.weightPct);
    if (!draft.label.trim() || !Number.isFinite(pct) || pct <= 0 || pct > 100) return;
    const input = { label: draft.label, type: draft.type, weight: pct / 100, contextId: null };
    const reset = () => { setDraft({ label: '', type: 'technique', weightPct: '' }); setAdding(false); };
    // Offline-first (F3) : grille saisie en atelier de dépouillement (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'evaluationCriteria', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, contextId: null, label: draft.label, type: draft.type, weight: pct / 100 }]);
      reset();
      toast.push(t('crit.added.offline'), 'info');
      return;
    }
    const rec = await evaluationCriteria.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('crit.added'), 'success');
  }
  async function remove(cid: string) {
    await evaluationCriteria.remove(cid);
    setRows((r) => r.filter((x) => x.id !== cid));
    toast.push(t('crit.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((c) => ({
    cells: [
      <span className="font-medium">{c.label}</span>,
      <Badge tone={CRITERION_TYPE_TONE[c.type]}>{criterionTypeLabel(c.type)}</Badge>,
      <span className="mono text-[13px]">{formatPercent(c.weight, locale)}</span>,
      <span className="flex justify-end">
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('crit.removed')} onClick={() => remove(c.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><SlidersHorizontal size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('crit.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('crit.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}
      {rows.length > 0 && !balanced && <Banner tone="warning">{t('crit.unbalanced', { n: formatPercent(total, locale) })}</Banner>}

      <KpiRow
        items={[
          { label: t('crit.kpi.count'), value: rows.length },
          { label: t('crit.kpi.total'), value: formatPercent(total, locale), accent: !balanced },
          { label: t('crit.kpi.balanced'), value: t(balanced ? 'common.yes' : 'common.no') },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="cr-label" label={t('crit.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <Select id="cr-type" label={t('crit.field.type')} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as CriterionType }))}>
              {CRITERION_TYPES.map((k) => <option key={k} value={k}>{criterionTypeLabel(k)}</option>)}
            </Select>
            <Field id="cr-weight" label={t('crit.field.weight')} type="number" inputMode="numeric" value={draft.weightPct} onChange={(e) => setDraft((d) => ({ ...d, weightPct: e.target.value }))} placeholder="40" />
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
        <Card><EmptyState title={t('crit.title')} description={t('crit.empty')} /></Card>
      ) : (
        <Panel title={t('crit.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1.2fr 1fr auto"
            columns={[
              { label: t('crit.col.label') },
              { label: t('crit.col.type') },
              { label: t('crit.col.weight') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('crit.subtitle')}</div>
    </div>
  );
}
