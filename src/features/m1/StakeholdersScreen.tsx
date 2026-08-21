import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Mail, Phone } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Money as MoneyView, Select, Skeleton, StatCard, useToast } from '../../ui';
import { stakeholderTypeLabel } from './labels';
import { useData, useOperation, useStakeholders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { Money } from '../../domain/money/Money';
import { STAKEHOLDER_TYPES, type Stakeholder, type StakeholderInput, type StakeholderType } from '../../domain/m2/types';
import { can } from '../../domain/m1/permissions';
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

      <div className="text-[12px] text-ink-3">{t('stakeholders.subtitle')}</div>
    </div>
  );
}
