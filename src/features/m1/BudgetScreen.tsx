import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Wallet } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Skeleton, useToast, type TableRowData } from '../../ui';
import { syscohadaClassLabel } from './labels';
import { useData, useOperation, useBudgetLines } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import { totalBudget, budgetByClass, lineShare, syscohadaClass, type BudgetLine } from '../../domain/budgetLine';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function BudgetScreen({ id }: { id: string }) {
  const { budgetLines, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useBudgetLines(id);
  const currency = op?.currency ?? 'XOF';

  const [rows, setRows] = useState<BudgetLine[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ syscohadaAccount: '', label: '', amountBac: '' });

  const total = useMemo(() => totalBudget(rows, currency), [rows, currency]);
  const byClass = useMemo(() => budgetByClass(rows, currency), [rows, currency]);

  async function add() {
    const amount = Number(draft.amountBac);
    if (!draft.syscohadaAccount.trim() || !draft.label.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const input = { syscohadaAccount: draft.syscohadaAccount, label: draft.label, amountBac: amount };
    const reset = () => { setDraft({ syscohadaAccount: '', label: '', amountBac: '' }); setAdding(false); };
    // Offline-first (F3) : écriture financière autorisée en brouillon hors-ligne.
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'budgetLines', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: true,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input }]);
      reset();
      toast.push(t('budget.added.offline'), 'info');
      return;
    }
    const rec = await budgetLines.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('budget.added'), 'success');
  }
  async function remove(bid: string) {
    await budgetLines.remove(bid);
    setRows((r) => r.filter((x) => x.id !== bid));
    toast.push(t('budget.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((b) => ({
    cells: [
      <span>
        <span className="block font-medium">{b.label}</span>
        <span className="block mono text-[12px] text-ink-3">{b.syscohadaAccount} · {syscohadaClassLabel(syscohadaClass(b.syscohadaAccount))}</span>
      </span>,
      <span className="mono text-[13px]">{formatAmount(b.amountBac, locale)}</span>,
      <span className="mono text-[12px] text-ink-3">{formatPercent(lineShare(b, rows, currency), locale)}</span>,
      <span className="flex justify-end">
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('budget.removed')} onClick={() => remove(b.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Wallet size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('budget.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('budget.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('budget.kpi.total'), value: <span className="mono">{total.format(locale)}</span>, accent: true },
          { label: t('budget.kpi.lines'), value: rows.length },
          { label: t('budget.kpi.classes'), value: Object.keys(byClass).length },
        ]}
      />

      {Object.keys(byClass).length > 0 && (
        <Panel title={t('budget.byclass')}>
          <div className="flex flex-col gap-2">
            {Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b)).map(([cls, money]) => (
              <div key={cls} className="flex items-center justify-between gap-2 text-[13px]">
                <span><Badge tone="neutral">{cls}</Badge> <span className="text-ink-2">{syscohadaClassLabel(cls)}</span></span>
                <span className="mono text-ink-3">{money.format(locale)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="bd-acc" label={t('budget.field.account')} value={draft.syscohadaAccount} onChange={(e) => setDraft((d) => ({ ...d, syscohadaAccount: e.target.value }))} placeholder="2313" />
            <Field id="bd-label" label={t('budget.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <Field id="bd-amt" label={t('budget.field.amount')} type="number" inputMode="numeric" value={draft.amountBac} onChange={(e) => setDraft((d) => ({ ...d, amountBac: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('budget.title')} description={t('budget.empty')} /></Card>
      ) : (
        <Panel title={t('budget.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1.2fr 0.8fr auto"
            columns={[
              { label: t('budget.col.line') },
              { label: t('budget.col.amount') },
              { label: t('budget.col.share') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('budget.subtitle')}</div>
    </div>
  );
}
