import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { guaranteeTypeLabel, guaranteeStatusLabel, GUARANTEE_STATUS_TONE } from './labels';
import { useData, useOperation, useGuarantees } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount, formatDate } from '../../lib/format';
import {
  activeCount, coveredTotal, effectiveStatus, expiringCount,
  canTransitionGuarantee, GUARANTEE_TYPES, GUARANTEE_STATUSES,
  type Guarantee, type GuaranteeType, type GuaranteeStatus,
} from '../../domain/m17';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function CautionsScreen({ id }: { id: string }) {
  const { guarantees, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useGuarantees(id);

  const [rows, setRows] = useState<Guarantee[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'financing.edit') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ type: GuaranteeType; issuer: string; amount: string; from: string; until: string }>({
    type: 'restitution_avance', issuer: '', amount: '', from: now, until: '',
  });

  const covered = coveredTotal(rows, currency, now);

  async function add() {
    if (!draft.issuer.trim()) return;
    const rec = await guarantees.add(id, {
      type: draft.type, issuer: draft.issuer, amount: Number(draft.amount.replace(/[^\d]/g, '')) || 0,
      validFrom: draft.from || now, validUntil: draft.until || null,
    });
    setRows((r) => [...r, rec]);
    setDraft({ type: 'restitution_avance', issuer: '', amount: '', from: now, until: '' });
    setAdding(false);
    toast.push(t('guarantee.added'), 'success');
  }
  async function setStatus(gid: string, status: GuaranteeStatus) {
    const rec = await guarantees.setStatus(gid, status);
    setRows((r) => r.map((x) => (x.id === gid ? rec : x)));
  }
  async function remove(gid: string) {
    await guarantees.remove(gid);
    setRows((r) => r.filter((x) => x.id !== gid));
    toast.push(t('guarantee.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((g) => {
    const eff = effectiveStatus(g, now);
    return {
      cells: [
        <span className="font-medium">{guaranteeTypeLabel(g.type)}</span>,
        <span className="text-ink-2">{g.issuer}</span>,
        <span className="mono">{formatAmount(g.amount, locale)}</span>,
        <span className="mono text-ink-3">{g.validUntil ? formatDate(g.validUntil, locale) : '—'}</span>,
        <Badge tone={GUARANTEE_STATUS_TONE[eff]}>{guaranteeStatusLabel(eff)}</Badge>,
        <span className="flex justify-end gap-1">
          {canEdit && GUARANTEE_STATUSES.filter((s) => canTransitionGuarantee(g.status, s)).map((s) => (
            <Button key={s} variant="glass" size="sm" onClick={() => setStatus(g.id, s)}>{t(`guarantee.action.${s}` as 'guarantee.action.liberee')}</Button>
          ))}
          {canEdit && (
            <Button variant="ghost" size="sm" icon aria-label={t('guarantee.removed')} onClick={() => remove(g.id)}><Trash2 size={15} /></Button>
          )}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('guarantee.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('guarantee.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('guarantee.kpi.active'), value: activeCount(rows, now) },
          { label: t('guarantee.kpi.covered'), value: <MoneyView amount={covered.toMajorNumber()} currency={currency} /> },
          { label: t('guarantee.kpi.expiring'), value: expiringCount(rows, now), accent: expiringCount(rows, now) > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="gt-type" label={t('guarantee.field.type')} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as GuaranteeType }))}>
              {GUARANTEE_TYPES.map((k) => <option key={k} value={k}>{guaranteeTypeLabel(k)}</option>)}
            </Select>
            <Field id="gt-issuer" label={t('guarantee.field.issuer')} value={draft.issuer} onChange={(e) => setDraft((d) => ({ ...d, issuer: e.target.value }))} />
            <Field id="gt-amount" label={t('guarantee.field.amount')} inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="gt-from" label={t('guarantee.field.from')} type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            <Field id="gt-until" label={t('guarantee.field.until')} type="date" value={draft.until} onChange={(e) => setDraft((d) => ({ ...d, until: e.target.value }))} />
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
        <Card><EmptyState title={t('guarantee.title')} description={t('guarantee.empty')} /></Card>
      ) : (
        <Panel title={t('guarantee.title')} meta={covered.format(locale)} bodyPadded={false}>
          <DataTable
            template="1.3fr 1.2fr 1fr 1fr 1fr auto"
            columns={[
              { label: t('guarantee.col.type') },
              { label: t('guarantee.col.issuer') },
              { label: t('guarantee.col.amount'), align: 'right' },
              { label: t('guarantee.col.until') },
              { label: t('guarantee.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('guarantee.subtitle')}</div>
    </div>
  );
}
