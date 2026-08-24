import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, KpiRow, Money as MoneyView, Panel, Select, Skeleton, useToast } from '../../ui';
import {
  financingSourceLabel,
  financingStatusLabel,
  FIN_STATUS_TONE,
  drawdownStatusLabel,
  DRAWDOWN_STATUS_TONE,
} from './labels';
import { useData, useOperation, useFinancings, useDrawdowns } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';
import {
  FINANCING_SOURCES,
  FINANCING_STATUSES,
  canTransitionFinancing,
  evaluateDrawdown,
  interetsIntercalairesJours,
  type Financing,
  type FinancingSource,
  type FinancingStatus,
  type Drawdown,
  type DrawdownStatus,
} from '../../domain/m5';

const today = () => new Date().toISOString().slice(0, 10);
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.parse(today()) - Date.parse(iso)) / 86_400_000));
}

export function FinancingScreen({ id }: { id: string }) {
  const { financing, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useFinancings(id);

  const [rows, setRows] = useState<Financing[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const progress = op?.progress ?? 0;
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'financing.edit') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ source: FinancingSource; amountText: string; rateText: string }>({
    source: 'credit_promoteur', amountText: '', rateText: '',
  });

  let total = Money.zero(currency);
  for (const f of rows) total = total.add(f.amount);

  async function add() {
    const amount = Money.of(Number(draft.amountText.replace(/[^\d]/g, '')) || 0, currency);
    const rate = (Number(draft.rateText.replace(/[^\d.]/g, '')) || 0) / 100;
    const rec = await financing.add(id, { source: draft.source, amount, rate });
    setRows((r) => [...r, rec]);
    setDraft({ source: 'credit_promoteur', amountText: '', rateText: '' });
    setAdding(false);
    toast.push(t('financing.added'), 'success');
  }
  async function setStatus(fid: string, status: FinancingStatus) {
    const rec = await financing.setStatus(fid, status);
    setRows((r) => r.map((x) => (x.id === fid ? rec : x)));
  }
  async function remove(fid: string) {
    await financing.remove(fid);
    setRows((r) => r.filter((x) => x.id !== fid));
    toast.push(t('financing.removed'), 'info');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('financing.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('financing.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('financing.kpi.total'), value: <MoneyView amount={total.toMajorNumber()} currency={currency} /> },
          { label: t('financing.title'), value: rows.length },
          { label: t('financing.progress', { pct: formatPercent(progress, locale, 0) }), value: formatPercent(progress, locale, 0) },
        ]}
      />

      {adding && canEdit && (
        <Card tone="strong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select id="fin-source" label={t('financing.field.source')} value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value as FinancingSource }))}>
              {FINANCING_SOURCES.map((s) => <option key={s} value={s}>{financingSourceLabel(s)}</option>)}
            </Select>
            <Field id="fin-amount" label={t('financing.field.amount')} inputMode="numeric" value={draft.amountText} onChange={(e) => setDraft((d) => ({ ...d, amountText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="fin-rate" label={t('financing.field.rate')} inputMode="decimal" value={draft.rateText} onChange={(e) => setDraft((d) => ({ ...d, rateText: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="9" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.add')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 96 }} />)}</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('financing.title')} description={t('financing.empty')} /></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((f) => (
            <FinancingCard key={f.id} financing={f} currency={currency} progress={progress} canEdit={canEdit}
              onStatus={(s) => setStatus(f.id, s)} onRemove={() => remove(f.id)} />
          ))}
        </div>
      )}

      <div className="text-[12px] text-ink-3">{t('financing.subtitle')}</div>
    </div>
  );
}

function FinancingCard({
  financing: f, currency, progress, canEdit, onStatus, onRemove,
}: {
  financing: Financing; currency: string; progress: number; canEdit: boolean;
  onStatus: (s: FinancingStatus) => void; onRemove: () => void;
}) {
  const { financing } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useDrawdowns(f.id);
  const [rows, setRows] = useState<Drawdown[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const [addingDraw, setAddingDraw] = useState(false);
  const [drawDraft, setDrawDraft] = useState<{ amountText: string; conditionText: string }>({ amountText: '', conditionText: '' });

  let released = Money.zero(currency);
  let interest = Money.zero(currency);
  for (const d of rows) {
    if (d.status === 'debloque') {
      released = released.add(d.amount);
      if (d.date) interest = interest.add(interetsIntercalairesJours(d.amount, f.rate, daysSince(d.date)));
    }
  }

  async function addDraw() {
    const amount = Money.of(Number(drawDraft.amountText.replace(/[^\d]/g, '')) || 0, currency);
    const condition = (Number(drawDraft.conditionText.replace(/[^\d]/g, '')) || 0) / 100;
    const rec = await financing.addDrawdown(f.id, { amount, condition });
    setRows((r) => [...r, rec]);
    setDrawDraft({ amountText: '', conditionText: '' });
    setAddingDraw(false);
  }
  async function drawTransition(d: Drawdown, to: DrawdownStatus) {
    const decision = evaluateDrawdown(d.status, to, { validatedProgress: progress, condition: d.condition });
    if (!decision.ok) {
      // Seul progress_insufficient est atteignable ici (les boutons n'offrent que des transitions valides).
      toast.push(t('draw.blocked.progress'), 'danger');
      return;
    }
    const rec = await financing.setDrawdownStatus(d.id, decision.to);
    setRows((r) => r.map((x) => (x.id === d.id ? rec : x)));
  }
  async function removeDraw(did: string) {
    await financing.removeDrawdown(did);
    setRows((r) => r.filter((x) => x.id !== did));
  }

  const nextByStatus: Partial<Record<DrawdownStatus, { to: DrawdownStatus; key: MessageKey }[]>> = {
    planifie: [{ to: 'demande', key: 'draw.action.request' }],
    demande: [{ to: 'debloque', key: 'draw.action.release' }, { to: 'refuse', key: 'draw.action.refuse' }],
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {financingSourceLabel(f.source)}
          <Badge tone={FIN_STATUS_TONE[f.status]}>{financingStatusLabel(f.status)}</Badge>
          <span className="mono text-[12px] text-ink-3">
            · <MoneyView amount={f.amount.toMajorNumber()} currency={currency} /> · {formatPercent(f.rate, locale, 2)}
          </span>
        </span>
      }
      actions={
        canEdit && (
          <>
            {FINANCING_STATUSES.filter((s) => canTransitionFinancing(f.status, s)).map((s) => (
              <Button key={s} variant="glass" size="sm" onClick={() => onStatus(s)}>{financingStatusLabel(s)}</Button>
            ))}
            <Button variant="ghost" size="sm" icon aria-label={t('financing.removed')} onClick={onRemove}><Trash2 size={15} /></Button>
          </>
        )
      }
    >
      <KpiRow
        items={[
          { label: t('financing.kpi.released'), value: <MoneyView amount={released.toMajorNumber()} currency={currency} /> },
          { label: t('financing.kpi.interest'), value: <MoneyView amount={interest.toMajorNumber()} currency={currency} /> },
        ]}
      />

      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--ax-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-2">{t('draw.title')}</span>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setAddingDraw((a) => !a)}>
              <Plus size={14} />
              {t('draw.add')}
            </Button>
          )}
        </div>
        {addingDraw && canEdit && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field id={`dw-amt-${f.id}`} label={t('draw.field.amount')} inputMode="numeric" value={drawDraft.amountText} onChange={(e) => setDrawDraft((d) => ({ ...d, amountText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id={`dw-cond-${f.id}`} label={t('draw.field.condition')} inputMode="numeric" value={drawDraft.conditionText} onChange={(e) => setDrawDraft((d) => ({ ...d, conditionText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="30" />
            <div className="flex items-end gap-2">
              <Button variant="primary" size="sm" onClick={addDraw}>{t('common.add')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingDraw(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        {loading ? (
          <Skeleton className="mt-2" style={{ height: 32 }} />
        ) : rows.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <MoneyView amount={d.amount.toMajorNumber()} currency={currency} className="font-medium" />
                <span className="text-ink-3">{t('draw.condition')} {formatPercent(d.condition, locale, 0)}</span>
                <Badge tone={DRAWDOWN_STATUS_TONE[d.status]}>{drawdownStatusLabel(d.status)}</Badge>
                {canEdit && (nextByStatus[d.status] ?? []).map((n) => (
                  <Button key={n.to} variant="ghost" size="sm" onClick={() => drawTransition(d, n.to)}>{t(n.key)}</Button>
                ))}
                {canEdit && (
                  <Button variant="ghost" size="sm" icon aria-label={t('financing.removed')} onClick={() => removeDraw(d.id)}><Trash2 size={13} /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
