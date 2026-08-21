import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ArrowRight, Gavel } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Select, Skeleton, StatCard, useToast } from '../../ui';
import { tenderStatusLabel, tenderModeLabel, tenderProcedureLabel, TENDER_TONE } from './labels';
import { useData, useOperation, useStakeholders, useTenders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { nextTenderStatus, requiresAward } from '../../domain/m8/tender';
import { TENDER_PROCEDURES, type Tender, type TenderInput, type TenderMode, type TenderProcedure } from '../../domain/m8/types';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function PassationScreen({ id }: { id: string }) {
  const { tenders, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useTenders(id);
  const { data: stakeholders } = useStakeholders(id);

  const [rows, setRows] = useState<Tender[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TenderInput>({ mode: 'private', procedure: 'AOO', object: '' });

  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (op) setDraft((d) => ({ ...d, mode: op.procurementMode })); }, [op]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'tender.edit') && !readOnly;
  const awardedCount = rows.filter((r) => r.status === 'awarded' || r.status === 'notified').length;

  const companies = useMemo(() => (stakeholders ?? []).filter((s) => s.type === 'entreprise' || s.type === 'moe'), [stakeholders]);
  const nameOf = (sid: string | null) => (sid ? (stakeholders ?? []).find((s) => s.id === sid)?.name ?? null : null);

  async function submit() {
    if (!draft.object.trim()) return;
    const td = await tenders.add(id, { ...draft, object: draft.object.trim() });
    setRows((rs) => [...rs, td]);
    setDraft({ mode: op?.procurementMode ?? 'private', procedure: 'AOO', object: '' });
    setAdding(false);
    toast.push(t('passation.added'), 'success');
  }
  async function advance(td: Tender) {
    const next = nextTenderStatus(td.status);
    if (!next) return;
    const updated = await tenders.setStatus(td.id, next);
    setRows((rs) => rs.map((x) => (x.id === td.id ? updated : x)));
    toast.push(t('passation.advanced', { status: tenderStatusLabel(next) }), 'success');
  }
  async function setAward(td: Tender, sid: string) {
    const updated = await tenders.setAwardedTo(td.id, sid || null);
    setRows((rs) => rs.map((x) => (x.id === td.id ? updated : x)));
  }
  async function remove(tid: string) {
    await tenders.remove(tid);
    setRows((rs) => rs.filter((r) => r.id !== tid));
    toast.push(t('passation.removed'), 'info');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('passation.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('passation.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('passation.readonly')}</Banner>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('passation.kpi.total')}>{rows.length}</StatCard>
        <StatCard label={t('passation.kpi.awarded')} emphasis>{awardedCount}</StatCard>
      </div>

      {adding && canEdit && (
        <Card tone="strong">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="td-object" label={t('passation.field.object')} value={draft.object} onChange={(e) => setDraft((d) => ({ ...d, object: e.target.value }))} />
            <Select id="td-proc" label={t('passation.field.procedure')} value={draft.procedure ?? 'AOO'} onChange={(e) => setDraft((d) => ({ ...d, procedure: e.target.value as TenderProcedure }))}>
              {TENDER_PROCEDURES.map((p) => (
                <option key={p} value={p}>{tenderProcedureLabel(p)}</option>
              ))}
            </Select>
            <Select id="td-mode" label={t('passation.field.mode')} value={draft.mode} onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value as TenderMode }))}>
              <option value="private">{tenderModeLabel('private')}</option>
              <option value="public">{tenderModeLabel('public')}</option>
            </Select>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={submit}>{t('common.create')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 56 }} />)}</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Gavel size={32} />} title={t('passation.title')} description={t('passation.empty')} /></Card>
      ) : (
        rows.map((td) => {
          const next = nextTenderStatus(td.status);
          const award = requiresAward(td.status);
          return (
            <Card key={td.id} tone="strong">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-[15px] font-medium">{td.object}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                    <Badge>{tenderModeLabel(td.mode)}</Badge>
                    {td.procedure && <span className="text-ink-3">{tenderProcedureLabel(td.procedure)}</span>}
                    <Badge tone={TENDER_TONE[td.status]}>{tenderStatusLabel(td.status)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && next && (
                    <Button variant="glass" size="sm" onClick={() => advance(td)}>
                      {t('passation.advance')}
                      <ArrowRight size={14} />
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" icon aria-label={t('passation.removed')} onClick={() => remove(td.id)}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>

              {award && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
                  <span className="text-[13px] text-ink-2">{t('passation.awardedTo')} :</span>
                  {canEdit ? (
                    <select className="ax-input ax-input--select" style={{ width: 260 }} value={td.awardedTo ?? ''} onChange={(e) => setAward(td, e.target.value)}>
                      <option value="">{t('common.none')}</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[13px] font-medium">{nameOf(td.awardedTo) ?? t('common.none')}</span>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}

      <div className="text-[12px] text-ink-3">{t('passation.subtitle')}</div>
    </div>
  );
}
