import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { utilityLabel, connectionStatusLabel, CONNECTION_STATUS_TONE } from './labels';
import { useData, useOperation, useConnections } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import { connectedCount, connectionsCostTotal, nextConnectionStatus, UTILITY_TYPES, type Connection, type UtilityType } from '../../domain/m18';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function RaccordementsScreen({ id }: { id: string }) {
  const { connections, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useConnections(id);

  const [rows, setRows] = useState<Connection[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ utility: UtilityType; concessionaire: string; reference: string; cost: string; requested: string }>({
    utility: 'electricite', concessionaire: '', reference: '', cost: '', requested: today(),
  });

  const total = connectionsCostTotal(rows, currency);

  async function add() {
    if (!draft.concessionaire.trim()) return;
    const rec = await connections.add(id, {
      utility: draft.utility, concessionaire: draft.concessionaire, reference: draft.reference,
      cost: Number(draft.cost.replace(/[^\d]/g, '')) || 0, requestedAt: draft.requested || today(),
    });
    setRows((r) => [...r, rec]);
    setDraft({ utility: 'electricite', concessionaire: '', reference: '', cost: '', requested: today() });
    setAdding(false);
    toast.push(t('cx.added'), 'success');
  }
  async function advance(c: Connection) {
    const next = nextConnectionStatus(c.status);
    if (!next) return;
    const rec = await connections.setStatus(c.id, next);
    setRows((r) => r.map((x) => (x.id === c.id ? rec : x)));
  }
  async function remove(cid: string) {
    await connections.remove(cid);
    setRows((r) => r.filter((x) => x.id !== cid));
    toast.push(t('cx.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((c) => {
    const next = nextConnectionStatus(c.status);
    return {
      cells: [
        <span className="font-medium">{utilityLabel(c.utility)}</span>,
        <span className="text-ink-2">{c.concessionaire}</span>,
        <span className="mono text-[13px] text-ink-3">{c.reference}</span>,
        <span className="mono">{formatAmount(c.cost, locale)}</span>,
        <Badge tone={CONNECTION_STATUS_TONE[c.status]}>{connectionStatusLabel(c.status)}</Badge>,
        <span className="flex justify-end gap-1">
          {canEdit && next && <Button variant="glass" size="sm" onClick={() => advance(c)}>{t('cx.advance')}<ArrowRight size={14} /></Button>}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('cx.removed')} onClick={() => remove(c.id)}><Trash2 size={15} /></Button>}
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
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('cx.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('cx.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('cx.kpi.count'), value: rows.length },
          { label: t('cx.kpi.connected'), value: connectedCount(rows) },
          { label: t('cx.kpi.cost'), value: <MoneyView amount={total.toMajorNumber()} currency={currency} /> },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="cx-util" label={t('cx.field.utility')} value={draft.utility} onChange={(e) => setDraft((d) => ({ ...d, utility: e.target.value as UtilityType }))}>
              {UTILITY_TYPES.map((u) => <option key={u} value={u}>{utilityLabel(u)}</option>)}
            </Select>
            <Field id="cx-conc" label={t('cx.field.concessionaire')} value={draft.concessionaire} onChange={(e) => setDraft((d) => ({ ...d, concessionaire: e.target.value }))} />
            <Field id="cx-ref" label={t('cx.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
            <Field id="cx-cost" label={t('cx.field.cost')} inputMode="numeric" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="cx-req" label={t('cx.field.requested')} type="date" value={draft.requested} onChange={(e) => setDraft((d) => ({ ...d, requested: e.target.value }))} />
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
        <Card><EmptyState title={t('cx.title')} description={t('cx.empty')} /></Card>
      ) : (
        <Panel title={t('cx.title')} meta={total.format(locale)} bodyPadded={false}>
          <DataTable
            template="1fr 1.4fr 1.2fr 1fr 1fr auto"
            columns={[
              { label: t('cx.col.utility') },
              { label: t('cx.col.concessionaire') },
              { label: t('cx.col.reference') },
              { label: t('cx.col.cost'), align: 'right' },
              { label: t('cx.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('cx.subtitle')}</div>
    </div>
  );
}
