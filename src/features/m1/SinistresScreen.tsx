import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Umbrella } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { claimStatusLabel, CLAIM_STATUS_TONE, insuranceTypeLabel } from './labels';
import { useData, useOperation, useClaims, useInsurances } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import {
  pendingCount, totalPending, totalIndemnise, canTransitionClaim,
  CLAIM_STATUSES, type Claim, type ClaimStatus,
} from '../../domain/claim';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function SinistresScreen({ id }: { id: string }) {
  const { claims, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: insurances } = useInsurances(id);
  const { data: loaded, loading, refetch } = useClaims(id);

  const [rows, setRows] = useState<Claim[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ event: '', amount: '', insuranceId: '' });

  const insLabel = (iid: string | null) => {
    const ins = (insurances ?? []).find((i) => i.id === iid);
    return ins ? `${insuranceTypeLabel(ins.type)} · ${ins.insurer}` : '—';
  };

  async function add() {
    if (!draft.event.trim()) return;
    const input = {
      event: draft.event, amount: Number(draft.amount.replace(/[^\d]/g, '')) || 0,
      insuranceId: draft.insuranceId || null,
    };
    const reset = () => { setDraft({ event: '', amount: '', insuranceId: '' }); setAdding(false); };
    // Offline-first (F3) : un sinistre est une déclaration (non écriture), créé « déclaré ».
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'claims', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, status: 'declare' }]);
      reset();
      toast.push(t('claim.added.offline'), 'info');
      return;
    }
    const rec = await claims.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('claim.added'), 'success');
  }
  async function setStatus(cid: string, status: ClaimStatus) {
    const rec = await claims.setStatus(cid, status);
    setRows((r) => r.map((x) => (x.id === cid ? rec : x)));
  }
  async function remove(cid: string) {
    await claims.remove(cid);
    setRows((r) => r.filter((x) => x.id !== cid));
    toast.push(t('claim.removed'), 'info');
  }

  const pending = totalPending(rows, currency);
  const indemnise = totalIndemnise(rows, currency);
  const tableRows: TableRowData[] = rows.map((c) => ({
    cells: [
      <span>
        <span className="block font-medium">{c.event}</span>
        <span className="block text-[12px] text-ink-3">{insLabel(c.insuranceId)}</span>
      </span>,
      <span className="mono">{formatAmount(c.amount, locale)}</span>,
      <Badge tone={CLAIM_STATUS_TONE[c.status]}>{claimStatusLabel(c.status)}</Badge>,
      <span className="flex justify-end gap-1">
        {canEdit && CLAIM_STATUSES.filter((s) => canTransitionClaim(c.status, s)).map((s) => (
          <Button key={s} variant="glass" size="sm" onClick={() => setStatus(c.id, s)}>{claimStatusLabel(s)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('claim.removed')} onClick={() => remove(c.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Umbrella size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('claim.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('claim.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('claim.kpi.pending'), value: pendingCount(rows) },
          { label: t('claim.kpi.pendingAmount'), value: <MoneyView amount={pending.toMajorNumber()} currency={currency} /> },
          { label: t('claim.kpi.indemnise'), value: <MoneyView amount={indemnise.toMajorNumber()} currency={currency} /> },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="cl-amount" label={t('claim.field.amount')} inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Select id="cl-ins" label={t('claim.field.insurance')} value={draft.insuranceId} onChange={(e) => setDraft((d) => ({ ...d, insuranceId: e.target.value }))}>
              <option value="">{t('claim.field.insurance.none')}</option>
              {(insurances ?? []).map((i) => <option key={i.id} value={i.id}>{insuranceTypeLabel(i.type)} · {i.insurer}</option>)}
            </Select>
            <Textarea id="cl-event" label={t('claim.field.event')} value={draft.event} onChange={(e) => setDraft((d) => ({ ...d, event: e.target.value }))} />
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
        <Card><EmptyState title={t('claim.title')} description={t('claim.empty')} /></Card>
      ) : (
        <Panel title={t('claim.register')} meta={pending.format(locale)} bodyPadded={false}>
          <DataTable
            template="2fr 1fr 1fr auto"
            columns={[
              { label: t('claim.col.event') },
              { label: t('claim.col.amount'), align: 'right' },
              { label: t('claim.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('claim.subtitle')}</div>
    </div>
  );
}
