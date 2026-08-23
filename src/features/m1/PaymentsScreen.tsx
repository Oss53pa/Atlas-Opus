import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight, FileText } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Skeleton, useToast } from '../../ui';
import { decompteStatusLabel, DECOMPTE_TONE } from './labels';
import { useContracts, useData, useDecomptes, useOperation } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { decompteNet, nextDecompteStatus } from '../../domain/payments/decompte';
import type { Contract, Decompte } from '../../domain/payments/types';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function PaymentsScreen({ id }: { id: string }) {
  const { payments, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loadedContracts, loading: lc } = useContracts(id);
  const { data: loadedDecomptes, loading: ld } = useDecomptes(id);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [decomptes, setDecomptes] = useState<Decompte[]>([]);
  const [addingContract, setAddingContract] = useState(false);
  const [cDraft, setCDraft] = useState({ reference: '', contractor: '', amount: '' });
  const [decFor, setDecFor] = useState<string | null>(null);
  const [dDraft, setDDraft] = useState({ gross: '', retentionPct: '5' });

  useEffect(() => { if (loadedContracts) setContracts(loadedContracts); }, [loadedContracts]);
  useEffect(() => { if (loadedDecomptes) setDecomptes(loadedDecomptes); }, [loadedDecomptes]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'payment.edit') && !readOnly;

  let totalNet = Money.zero(currency);
  let totalPaid = Money.zero(currency);
  for (const d of decomptes) {
    totalNet = totalNet.add(Money.of(d.amountNet, currency));
    if (d.status === 'paid') totalPaid = totalPaid.add(Money.of(d.amountNet, currency));
  }

  async function addContract() {
    if (!cDraft.reference.trim() || !cDraft.contractor.trim()) return;
    const c = await payments.addContract(id, {
      reference: cDraft.reference, contractor: cDraft.contractor, amount: Number(cDraft.amount.replace(/[^\d]/g, '')) || 0,
    });
    setContracts((cs) => [...cs, c]);
    setCDraft({ reference: '', contractor: '', amount: '' });
    setAddingContract(false);
    toast.push(t('payments.contract.added'), 'success');
  }
  async function removeContract(cid: string) {
    await payments.removeContract(cid);
    setContracts((cs) => cs.filter((c) => c.id !== cid));
    setDecomptes((ds) => ds.filter((d) => d.contractId !== cid));
    toast.push(t('payments.contract.removed'), 'info');
  }
  async function addDecompte(contractId: string) {
    const gross = Number(dDraft.gross.replace(/[^\d]/g, '')) || 0;
    const rate = (Number(dDraft.retentionPct.replace(/[^\d.,]/g, '').replace(',', '.')) || 0) / 100;
    const number = Math.max(0, ...decomptes.filter((d) => d.contractId === contractId).map((d) => d.number)) + 1;
    const d = await payments.addDecompte(id, { contractId, number, amountGross: gross, retentionRate: rate });
    setDecomptes((ds) => [...ds, d]);
    setDecFor(null);
    setDDraft({ gross: '', retentionPct: '5' });
    toast.push(t('payments.decompte.added'), 'success');
  }
  async function advance(d: Decompte) {
    const next = nextDecompteStatus(d.status);
    if (!next) return;
    const updated = await payments.setDecompteStatus(d.id, next);
    setDecomptes((ds) => ds.map((x) => (x.id === d.id ? updated : x)));
    toast.push(t('payments.decompte.advanced', { status: decompteStatusLabel(next) }), 'success');
  }

  const loading = lc || ld;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('payments.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAddingContract((a) => !a)}>
            <Plus size={16} />
            {t('payments.addContract')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('payments.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('payments.total.net'), value: <MoneyView amount={totalNet.toMajorNumber()} currency={currency} /> },
          { label: t('payments.total.paid'), value: <MoneyView amount={totalPaid.toMajorNumber()} currency={currency} />, accent: true },
        ]}
      />

      {addingContract && canEdit && (
        <Card tone="strong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="ct-ref" label={t('payments.field.reference')} value={cDraft.reference} onChange={(e) => setCDraft((d) => ({ ...d, reference: e.target.value }))} />
            <Field id="ct-contractor" label={t('payments.field.contractor')} value={cDraft.contractor} onChange={(e) => setCDraft((d) => ({ ...d, contractor: e.target.value }))} />
            <Field id="ct-amount" label={t('payments.field.amount')} inputMode="numeric" value={cDraft.amount} onChange={(e) => setCDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingContract(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={addContract}>{t('common.create')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 56 }} />)}</div></Card>
      ) : contracts.length === 0 ? (
        <Card><EmptyState icon={<FileText size={32} />} title={t('payments.contracts')} description={t('payments.empty.contracts')} /></Card>
      ) : (
        contracts.map((c) => {
          const list = decomptes.filter((d) => d.contractId === c.id).sort((a, b) => a.number - b.number);
          return (
            <Panel
              key={c.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[12px] text-ink-3">{c.reference}</span>
                  <span>{c.contractor}</span>
                  <span className="mono text-[12px] text-ink-3">· <MoneyView amount={c.amount} currency={currency} /></span>
                </span>
              }
              actions={
                canEdit && (
                  <>
                    <Button variant="glass" size="sm" onClick={() => { setDecFor(decFor === c.id ? null : c.id); setDDraft({ gross: '', retentionPct: '5' }); }}>
                      <Plus size={15} />
                      {t('payments.addDecompte')}
                    </Button>
                    <Button variant="ghost" size="sm" icon aria-label={t('payments.contract.removed')} onClick={() => removeContract(c.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </>
                )
              }
            >
              {decFor === c.id && canEdit && (
                <div className="mt-3 rounded-md p-3" style={{ background: 'var(--ax-glass-subtle)' }}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field id={`dec-gross-${c.id}`} label={t('payments.field.gross')} inputMode="numeric" value={dDraft.gross} onChange={(e) => setDDraft((d) => ({ ...d, gross: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
                    <Field id={`dec-ret-${c.id}`} label={t('payments.field.retention')} inputMode="decimal" value={dDraft.retentionPct} onChange={(e) => setDDraft((d) => ({ ...d, retentionPct: e.target.value.replace(/[^\d.,]/g, '') }))} />
                    <div className="ax-field">
                      <span className="ax-label">{t('payments.col.net')}</span>
                      <div className="mono flex h-10 items-center text-[14px]">
                        {decompteNet(Money.of(Number(dDraft.gross.replace(/[^\d]/g, '')) || 0, currency), (Number(dDraft.retentionPct.replace(',', '.')) || 0) / 100).net.format(locale)} {currency}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="primary" size="sm" onClick={() => addDecompte(c.id)}>{t('common.create')}</Button>
                  </div>
                </div>
              )}

              {list.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-3">{t('payments.empty.decomptes')}</p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {list.map((d) => {
                    const next = nextDecompteStatus(d.status);
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-3 py-2" style={{ borderTop: '1px solid var(--ax-border)' }}>
                        <span className="mono w-[42px] text-[13px] text-ink-3">#{d.number}</span>
                        <span className="flex-1 text-[13px] text-ink-2">
                          {t('payments.field.gross')} <span className="mono">{formatAmount(d.amountGross, locale)}</span> · {t('payments.field.retention')} {formatPercent(d.retentionRate, locale, 0)}
                        </span>
                        <MoneyView amount={d.amountNet} currency={currency} className="w-[150px] text-right text-[13px]" />
                        <Badge tone={DECOMPTE_TONE[d.status]}>{decompteStatusLabel(d.status)}</Badge>
                        {canEdit && next && (
                          <Button variant="glass" size="sm" onClick={() => advance(d)}>
                            {t('payments.advance')}
                            <ArrowRight size={14} />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          );
        })
      )}

      <div className="text-[12px] text-ink-3">{t('payments.subtitle')}</div>
    </div>
  );
}
