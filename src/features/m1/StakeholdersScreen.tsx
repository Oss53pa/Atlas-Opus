import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Mail, Phone, AlertTriangle, Lock } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Money as MoneyView, Select, Skeleton, StatCard, useToast } from '../../ui';
import { stakeholderTypeLabel, raciLabel, RACI_TONE, decisionKindLabel } from './labels';
import { useData, useOperation, useStakeholders, useRaci, useDecisions } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { STAKEHOLDER_TYPES, type Stakeholder, type StakeholderInput, type StakeholderType } from '../../domain/m2/types';
import {
  RACI_VALUES,
  DECISION_KINDS,
  type Raci,
  type RaciAssignment,
  type RaciInput,
  type Decision,
  type DecisionInput,
  type DecisionKind,
} from '../../domain/m7/types';
import { raciActivitiesInBreach } from '../../domain/m7/rules';
import { can } from '../../domain/m1/permissions';
import { can as canM7 } from '../../domain/m7/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const emptyDraft: StakeholderInput = { type: 'moe', name: '', email: '', phone: '', mission: '', feeAmount: 0 };

export function StakeholdersScreen({ id }: { id: string }) {
  const { stakeholders, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useStakeholders(id);

  const [rows, setRows] = useState<Stakeholder[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<StakeholderInput>(emptyDraft);
  const [feeText, setFeeText] = useState('');

  useEffect(() => {
    if (loaded) setRows(loaded);
  }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'stakeholder.edit') && !readOnly;

  let totalFees = Money.zero(currency);
  for (const s of rows) totalFees = totalFees.add(Money.of(s.feeAmount, currency));

  async function submit() {
    if (!draft.name.trim()) return;
    const rec = await stakeholders.add(id, { ...draft, name: draft.name.trim(), feeAmount: Number(feeText.replace(/[^\d]/g, '')) || 0 });
    setRows((rs) => [...rs, rec]);
    setDraft(emptyDraft);
    setFeeText('');
    setAdding(false);
    toast.push(t('stakeholders.added'), 'success');
  }
  async function remove(sid: string) {
    await stakeholders.remove(sid);
    setRows((rs) => rs.filter((r) => r.id !== sid));
    toast.push(t('stakeholders.removed'), 'info');
  }

  const sorted = [...rows].sort((a, b) => STAKEHOLDER_TYPES.indexOf(a.type) - STAKEHOLDER_TYPES.indexOf(b.type));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('stakeholders.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('stakeholders.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('stakeholders.readonly')}</Banner>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('stakeholders.title')}>{rows.length}</StatCard>
        <StatCard label={t('stakeholders.total')}>
          <MoneyView amount={totalFees.toMajorNumber()} currency={currency} />
        </StatCard>
      </div>

      {adding && canEdit && (
        <Card tone="strong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="stk-type" label={t('stakeholders.field.type')} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as StakeholderType }))}>
              {STAKEHOLDER_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {stakeholderTypeLabel(ty)}
                </option>
              ))}
            </Select>
            <Field id="stk-name" label={t('stakeholders.field.name')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Field id="stk-email" type="email" label={t('stakeholders.field.email')} value={draft.email ?? ''} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            <Field id="stk-phone" label={t('stakeholders.field.phone')} value={draft.phone ?? ''} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
            <Field id="stk-mission" label={t('stakeholders.field.mission')} value={draft.mission ?? ''} onChange={(e) => setDraft((d) => ({ ...d, mission: e.target.value }))} />
            <Field id="stk-fee" label={t('stakeholders.field.fee')} inputMode="numeric" value={feeText} onChange={(e) => setFeeText(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              {t('common.create')}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 48 }} />
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={t('stakeholders.title')} description={t('stakeholders.empty')} />
        </Card>
      ) : (
        <Card tone="strong" padded={false} className="p-2 sm:p-3">
          <ul className="flex flex-col">
            {sorted.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-3" style={{ borderTop: '1px solid var(--ax-border)' }}>
                <span className="min-w-[180px] flex-1">
                  <span className="flex items-center gap-2">
                    <Badge>{stakeholderTypeLabel(s.type)}</Badge>
                    <span className="text-[14px] font-medium">{s.name}</span>
                  </span>
                  {s.mission && <span className="mt-0.5 block text-[12px] text-ink-3">{s.mission}</span>}
                </span>
                <span className="flex flex-col gap-0.5 text-[12px] text-ink-2">
                  {s.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} className="text-ink-3" />
                      {s.email}
                    </span>
                  )}
                  {s.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={13} className="text-ink-3" />
                      {s.phone}
                    </span>
                  )}
                </span>
                <MoneyView amount={s.feeAmount} currency={currency} className="w-[150px] shrink-0 text-right text-[13px]" />
                <Button variant="glass" size="sm" onClick={() => navigate({ name: 'stakeholder', id, sid: s.id })}>{t('stakeholders.view')}</Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" icon aria-label={t('stakeholders.removed')} onClick={() => remove(s.id)}>
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RaciSection
        operationId={id}
        stakeholders={rows}
        canConfigure={canM7(session.role, 'raci.configure') && !readOnly}
      />

      <DecisionsSection
        operationId={id}
        canRecord={canM7(session.role, 'decision.record') && !readOnly}
      />

      <div className="text-[12px] text-ink-3">{t('stakeholders.subtitle')}</div>
    </div>
  );
}

/** RG-M7-07 — Matrice RACI : exactement un « A » (approbateur) par activité. */
function RaciSection({
  operationId,
  stakeholders,
  canConfigure,
}: {
  operationId: string;
  stakeholders: Stakeholder[];
  canConfigure: boolean;
}) {
  const { governance } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useRaci(operationId);
  const [rows, setRows] = useState<RaciAssignment[]>([]);
  const [adding, setAdding] = useState(false);
  const emptyDraft: RaciInput = { activity: '', stakeholderId: stakeholders[0]?.id ?? '', raci: 'R' };
  const [draft, setDraft] = useState<RaciInput>(emptyDraft);

  useEffect(() => {
    if (loaded) setRows(loaded);
  }, [loaded]);

  const nameOf = (sid: string) => stakeholders.find((s) => s.id === sid)?.name ?? sid;
  const breaches = new Set(raciActivitiesInBreach(rows));
  const activities = [...new Set(rows.map((r) => r.activity))];

  async function submit() {
    if (!draft.activity.trim() || !draft.stakeholderId) return;
    try {
      const rec = await governance.addRaci(operationId, { ...draft, activity: draft.activity.trim() });
      setRows((rs) => [...rs, rec]);
      setDraft({ ...emptyDraft, activity: draft.activity.trim() });
      setAdding(false);
      toast.push(t('raci.added'), 'success');
    } catch {
      toast.push(t('raci.error.duplicateA'), 'danger');
    }
  }
  async function remove(rid: string) {
    await governance.removeRaci(rid);
    setRows((rs) => rs.filter((r) => r.id !== rid));
    toast.push(t('raci.removed'), 'info');
  }

  return (
    <Card tone="strong">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-medium">{t('raci.title')}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{t('raci.subtitle')}</p>
        </div>
        {canConfigure && stakeholders.length > 0 && (
          <Button variant="glass" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('raci.add')}
          </Button>
        )}
      </div>

      {adding && canConfigure && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            id="raci-activity"
            label={t('raci.field.activity')}
            value={draft.activity}
            onChange={(e) => setDraft((d) => ({ ...d, activity: e.target.value }))}
          />
          <Select
            id="raci-stk"
            label={t('raci.field.stakeholder')}
            value={draft.stakeholderId}
            onChange={(e) => setDraft((d) => ({ ...d, stakeholderId: e.target.value }))}
          >
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            id="raci-role"
            label={t('raci.field.raci')}
            value={draft.raci}
            onChange={(e) => setDraft((d) => ({ ...d, raci: e.target.value as Raci }))}
          >
            {RACI_VALUES.map((r) => (
              <option key={r} value={r}>
                {raciLabel(r)}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 40 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t('raci.title')} description={t('raci.empty')} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {activities.map((activity) => (
            <div key={activity}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[14px] font-medium">{activity}</span>
                {breaches.has(activity) && (
                  <Badge tone="danger">
                    <AlertTriangle size={12} /> {t('raci.breach')}
                  </Badge>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {rows
                  .filter((r) => r.activity === activity)
                  .map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-md px-3 py-2"
                      style={{ background: 'var(--ax-glass-subtle)' }}
                    >
                      <Badge tone={RACI_TONE[r.raci]}>{r.raci}</Badge>
                      <span className="flex-1 text-[13px]">{nameOf(r.stakeholderId)}</span>
                      <span className="text-[12px] text-ink-3">{raciLabel(r.raci)}</span>
                      {canConfigure && (
                        <Button variant="ghost" size="sm" icon aria-label={t('raci.removed')} onClick={() => remove(r.id)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** RG-M7-08 — Registre des décisions : append-only (ni édition ni suppression). */
function DecisionsSection({ operationId, canRecord }: { operationId: string; canRecord: boolean }) {
  const { governance } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useDecisions(operationId);
  const [rows, setRows] = useState<Decision[]>([]);
  const [adding, setAdding] = useState(false);
  const emptyDraft: DecisionInput = { kind: 'decision', reference: '', date: '', summary: '', decidedBy: '' };
  const [draft, setDraft] = useState<DecisionInput>(emptyDraft);

  useEffect(() => {
    if (loaded) setRows(loaded);
  }, [loaded]);

  async function submit() {
    if (!draft.reference.trim() || !draft.date || !draft.decidedBy.trim()) return;
    const rec = await governance.addDecision(operationId, {
      ...draft,
      reference: draft.reference.trim(),
      decidedBy: draft.decidedBy.trim(),
    });
    setRows((rs) => [rec, ...rs]);
    setDraft(emptyDraft);
    setAdding(false);
    toast.push(t('decision.added'), 'success');
  }

  return (
    <Card tone="strong">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-medium">{t('decision.title')}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{t('decision.subtitle')}</p>
        </div>
        {canRecord && (
          <Button variant="glass" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('decision.add')}
          </Button>
        )}
      </div>

      <Banner tone="info" icon={<Lock size={16} />}>
        {t('decision.appendOnly')}
      </Banner>

      {adding && canRecord && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            id="dec-kind"
            label={t('decision.field.kind')}
            value={draft.kind}
            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as DecisionKind }))}
          >
            {DECISION_KINDS.map((k) => (
              <option key={k} value={k}>
                {decisionKindLabel(k)}
              </option>
            ))}
          </Select>
          <Field
            id="dec-ref"
            label={t('decision.field.reference')}
            value={draft.reference}
            onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
          />
          <Field
            id="dec-date"
            type="date"
            label={t('decision.field.date')}
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
          <Field
            id="dec-by"
            label={t('decision.field.decidedBy')}
            value={draft.decidedBy}
            onChange={(e) => setDraft((d) => ({ ...d, decidedBy: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Field
              id="dec-summary"
              label={t('decision.field.summary')}
              value={draft.summary ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 44 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t('decision.title')} description={t('decision.empty')} />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id} className="rounded-md px-3 py-2.5" style={{ background: 'var(--ax-glass-subtle)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{decisionKindLabel(d.kind)}</Badge>
                <span className="font-mono text-[13px] font-medium">{d.reference}</span>
                <span className="text-[12px] text-ink-3">{formatDate(d.date, locale)}</span>
                <span className="ml-auto text-[12px] text-ink-3">{d.decidedBy}</span>
              </div>
              {d.summary && <p className="mt-1 text-[13px] text-ink-2">{d.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
