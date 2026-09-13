import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Scale } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { disputeStatusLabel, DISPUTE_STATUS_TONE } from './labels';
import { useData, useOperation, useDisputes } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import {
  activeCount, totalAtStake, canTransitionDispute,
  DISPUTE_STATUSES, type Dispute, type DisputeStatus,
} from '../../domain/litige';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function LitigesScreen({ id }: { id: string }) {
  const { disputes, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useDisputes(id);

  const [rows, setRows] = useState<Dispute[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ counterpart: '', object: '', amount: '', fileRef: '' });

  async function add() {
    if (!draft.counterpart.trim() || !draft.object.trim()) return;
    const input = {
      counterpart: draft.counterpart, object: draft.object,
      amountAtStake: Number(draft.amount.replace(/[^\d]/g, '')) || 0, fileRef: draft.fileRef || null,
    };
    const reset = () => { setDraft({ counterpart: '', object: '', amount: '', fileRef: '' }); setAdding(false); };
    // Offline-first (F3) : un litige est un suivi (non écriture), créé « ouvert ».
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'disputes', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, status: 'ouvert' }]);
      reset();
      toast.push(t('litige.added.offline'), 'info');
      return;
    }
    const rec = await disputes.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('litige.added'), 'success');
  }
  async function setStatus(did: string, status: DisputeStatus) {
    const rec = await disputes.setStatus(did, status);
    setRows((r) => r.map((x) => (x.id === did ? rec : x)));
  }
  async function remove(did: string) {
    await disputes.remove(did);
    setRows((r) => r.filter((x) => x.id !== did));
    toast.push(t('litige.removed'), 'info');
  }

  const stake = totalAtStake(rows, currency);
  const tableRows: TableRowData[] = rows.map((d) => ({
    cells: [
      <span>
        <span className="block font-medium">{d.counterpart}</span>
        <span className="block text-[12px] text-ink-3">{d.object}</span>
      </span>,
      <span className="mono">{formatAmount(d.amountAtStake, locale)}</span>,
      <span className="mono text-[12px] text-ink-3">{d.fileRef ?? '—'}</span>,
      <Badge tone={DISPUTE_STATUS_TONE[d.status]}>{disputeStatusLabel(d.status)}</Badge>,
      <span className="flex justify-end gap-1">
        {canEdit && DISPUTE_STATUSES.filter((s) => canTransitionDispute(d.status, s)).map((s) => (
          <Button key={s} variant="glass" size="sm" onClick={() => setStatus(d.id, s)}>{disputeStatusLabel(s)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('litige.removed')} onClick={() => remove(d.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Scale size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('litige.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('litige.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('litige.kpi.active'), value: activeCount(rows) },
          { label: t('litige.kpi.stake'), value: <MoneyView amount={stake.toMajorNumber()} currency={currency} /> },
          { label: t('litige.kpi.total'), value: rows.length },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="lt-cp" label={t('litige.field.counterpart')} value={draft.counterpart} onChange={(e) => setDraft((d) => ({ ...d, counterpart: e.target.value }))} />
            <Field id="lt-amount" label={t('litige.field.amount')} inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="lt-ref" label={t('litige.field.fileRef')} value={draft.fileRef} onChange={(e) => setDraft((d) => ({ ...d, fileRef: e.target.value }))} />
            <Textarea id="lt-obj" label={t('litige.field.object')} value={draft.object} onChange={(e) => setDraft((d) => ({ ...d, object: e.target.value }))} />
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
        <Card><EmptyState title={t('litige.title')} description={t('litige.empty')} /></Card>
      ) : (
        <Panel title={t('litige.register')} meta={stake.format(locale)} bodyPadded={false}>
          <DataTable
            template="1.6fr 1fr 1fr 1fr auto"
            columns={[
              { label: t('litige.col.counterpart') },
              { label: t('litige.col.amount'), align: 'right' },
              { label: t('litige.col.fileRef') },
              { label: t('litige.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('litige.subtitle')}</div>
    </div>
  );
}
