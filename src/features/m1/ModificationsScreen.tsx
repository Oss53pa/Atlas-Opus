import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { changeOriginLabel, changeStatusLabel, CHANGE_STATUS_TONE } from './labels';
import { useData, useOperation, useChangeOrders, useContracts } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { Money, sumMoney } from '../../domain/money/Money';
import {
  CHANGE_ORIGINS, evaluateChangeTransition, requiredRoleFor, buildAvenantRef,
  type ChangeOrder, type ChangeOrigin, type ChangeAction, type ChangeApprovalRule,
} from '../../domain/m14';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function ModificationsScreen({ id }: { id: string }) {
  const { changeOrders, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: contracts } = useContracts(id);
  const { data: loaded, loading } = useChangeOrders(id);

  const [rows, setRows] = useState<ChangeOrder[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  // Seuils d'arbitrage (RG-M14-03) — config tenant simplifiée.
  const rules: ChangeApprovalRule[] = [
    { thresholdAmount: Money.of(10_000_000, currency), requiredRole: 'moa_director' },
    { thresholdAmount: Money.of(50_000_000, currency), requiredRole: 'owner' },
  ];

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ contractId: string; origin: ChangeOrigin; description: string }>({ contractId: '', origin: 'aleas', description: '' });
  const [impactFor, setImpactFor] = useState<string | null>(null);
  const [impactDraft, setImpactDraft] = useState({ cost: '', days: '' });

  const cumulCost = sumMoney(rows.filter((r) => r.status !== 'rejected').map((r) => r.impactCost), currency);
  const cumulDays = rows.filter((r) => r.status !== 'rejected').reduce((s, r) => s + r.impactDays, 0);
  const contractRef = (cid: string | null) => contracts?.find((c) => c.id === cid)?.reference ?? '—';

  async function add() {
    const contractId = draft.contractId || contracts?.[0]?.id;
    if (!contractId || !draft.description.trim()) return;
    const rec = await changeOrders.add(id, { contractId, origin: draft.origin, description: draft.description });
    setRows((r) => [...r, rec]);
    setDraft({ contractId: '', origin: 'aleas', description: '' });
    setAdding(false);
    toast.push(t('change.added'), 'success');
  }
  async function saveImpact(co: ChangeOrder) {
    const cost = Money.of(Number(impactDraft.cost.replace(/[^\d-]/g, '')) || 0, currency);
    const days = Number(impactDraft.days.replace(/[^\d-]/g, '')) || 0;
    const rec = await changeOrders.update(co.id, { impactCost: cost, impactDays: days, impactAnalyzed: true, status: 'under_review' });
    setRows((r) => r.map((x) => (x.id === co.id ? rec : x)));
    setImpactFor(null);
    setImpactDraft({ cost: '', days: '' });
    toast.push(t('change.impact.saved'), 'success');
  }
  async function act(co: ChangeOrder, action: ChangeAction) {
    const requiredRole = requiredRoleFor(co.impactCost, rules);
    let reason: string | undefined;
    if (action === 'reject') {
      reason = window.prompt(t('change.reject.reason')) ?? '';
      if (!reason.trim()) return;
    }
    const decision = evaluateChangeTransition(co.status, action, { impactAnalyzed: co.impactAnalyzed, requiredRole }, { role: session.role, reason });
    if (!decision.ok) {
      toast.push(t(decision.code === 'insufficient_role' ? 'change.blocked.role' : 'change.blocked.impact'), 'danger');
      return;
    }
    const patch: Parameters<typeof changeOrders.update>[1] = { status: decision.to };
    if (action === 'approve') patch.decidedBy = session.userId;
    if (action === 'reject') patch.rejectionReason = reason ?? null;
    if (action === 'convert') patch.avenantRef = buildAvenantRef(contractRef(co.contractId), rows.filter((r) => r.status === 'converted').length + 1);
    const rec = await changeOrders.update(co.id, patch);
    setRows((r) => r.map((x) => (x.id === co.id ? rec : x)));
    toast.push(t('change.transitioned'), 'success');
  }
  async function remove(cid: string) {
    await changeOrders.remove(cid);
    setRows((r) => r.filter((x) => x.id !== cid));
    toast.push(t('change.removed'), 'info');
  }

  const actionsFor = (co: ChangeOrder): { a: ChangeAction; key: MessageKeyAction }[] => {
    switch (co.status) {
      case 'under_review': return [{ a: 'arbitrate', key: 'change.action.arbitrate' }];
      case 'arbitrated': return [{ a: 'approve', key: 'change.action.approve' }, { a: 'reject', key: 'change.action.reject' }];
      case 'approved': return [{ a: 'convert', key: 'change.action.convert' }];
      default: return [];
    }
  };

  const tableRows: TableRowData[] = rows.map((co) => ({
    cells: [
      <span><Badge>{changeOriginLabel(co.origin)}</Badge></span>,
      <span>
        <span className="block font-medium">{co.description}</span>
        <span className="block text-[12px] text-ink-3">{contractRef(co.contractId)}{co.avenantRef ? ` · ${co.avenantRef}` : ''}</span>
      </span>,
      <span className="mono" style={co.impactCost.isNegative() ? { color: 'var(--ax-accent)' } : undefined}>
        {co.impactAnalyzed ? `${co.impactCost.isNegative() ? '' : '+'}${co.impactCost.format(locale)}` : '—'}
      </span>,
      <span className="mono">{co.impactAnalyzed ? t('change.days.unit', { n: `${co.impactDays > 0 ? '+' : ''}${co.impactDays}` }) : '—'}</span>,
      <Badge tone={CHANGE_STATUS_TONE[co.status]}>{changeStatusLabel(co.status)}</Badge>,
      <span className="flex justify-end gap-1">
        <Button variant="glass" size="sm" onClick={() => navigate({ name: 'impactSim', id, coid: co.id })}>{t('change.simulate')}</Button>
        {canEdit && co.status === 'requested' && (
          <Button variant="glass" size="sm" onClick={() => { setImpactFor(impactFor === co.id ? null : co.id); setImpactDraft({ cost: '', days: '' }); }}>{t('change.impact.save')}</Button>
        )}
        {canEdit && actionsFor(co).map((x) => (
          <Button key={x.a} variant="glass" size="sm" onClick={() => act(co, x.a)}>{t(x.key)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('change.removed')} onClick={() => remove(co.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('change.title')}</h1>
          </div>
        </div>
        {canEdit && (contracts?.length ?? 0) > 0 && (
          <Button variant="primary" size="sm" onClick={() => { setAdding((a) => !a); setDraft((d) => ({ ...d, contractId: d.contractId || (contracts?.[0]?.id ?? '') })); }}>
            <Plus size={16} />{t('change.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('change.kpi.count'), value: rows.length },
          { label: t('change.kpi.cost'), value: <MoneyView amount={cumulCost.toMajorNumber()} currency={currency} />, accent: cumulCost.isNegative() },
          { label: t('change.kpi.days'), value: t('change.days.unit', { n: `${cumulDays > 0 ? '+' : ''}${cumulDays}` }), accent: cumulDays > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="co-contract" label={t('payments.field.reference')} value={draft.contractId} onChange={(e) => setDraft((d) => ({ ...d, contractId: e.target.value }))}>
              {(contracts ?? []).map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contractor}</option>)}
            </Select>
            <Select id="co-origin" label={t('change.field.origin')} value={draft.origin} onChange={(e) => setDraft((d) => ({ ...d, origin: e.target.value as ChangeOrigin }))}>
              {CHANGE_ORIGINS.map((o) => <option key={o} value={o}>{changeOriginLabel(o)}</option>)}
            </Select>
            <div className="sm:col-span-2">
              <Field id="co-desc" label={t('change.field.description')} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {impactFor && canEdit && (() => {
        const co = rows.find((r) => r.id === impactFor);
        if (!co) return null;
        return (
          <Panel title={t('change.impact.save')} meta={co.description}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="im-cost" label={t('change.field.cost')} value={impactDraft.cost} onChange={(e) => setImpactDraft((d) => ({ ...d, cost: e.target.value.replace(/[^\d-]/g, '') }))} placeholder="42000000" />
              <Field id="im-days" label={t('change.field.days')} value={impactDraft.days} onChange={(e) => setImpactDraft((d) => ({ ...d, days: e.target.value.replace(/[^\d-]/g, '') }))} placeholder="15" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setImpactFor(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={() => saveImpact(co)}>{t('change.impact.save')}</Button>
            </div>
          </Panel>
        );
      })()}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('change.title')} description={t('change.empty')} /></Card>
      ) : (
        <Panel title={t('change.title')} bodyPadded={false}>
          <DataTable
            template="1fr 2fr 1.2fr 90px 1.1fr auto"
            columns={[
              { label: t('change.col.origin') },
              { label: t('change.col.description') },
              { label: t('change.col.cost'), align: 'right' },
              { label: t('change.col.days'), align: 'right' },
              { label: t('change.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('change.subtitle')}</div>
    </div>
  );
}

type MessageKeyAction = 'change.action.arbitrate' | 'change.action.approve' | 'change.action.reject' | 'change.action.convert';
