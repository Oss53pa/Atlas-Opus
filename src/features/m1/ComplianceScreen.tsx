import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, Plus, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, Field, Select, Skeleton, useToast } from '../../ui';
import {
  authorizationTypeLabel,
  authorizationStatusLabel,
  AUTH_STATUS_TONE,
  insuranceTypeLabel,
  insuranceStatusLabel,
  INS_STATUS_TONE,
  ddCategoryLabel,
  ddSeverityLabel,
  DD_SEV_TONE,
  ddStatusLabel,
} from './labels';
import { useData, useOperation, useAuthorizations, useInsurances, useDueDiligence } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { isReadOnlyForRole } from '../../domain/m1/rules';
import { can } from '../../domain/m7/permissions';
import {
  AUTHORIZATION_TYPES,
  AUTHORIZATION_STATUSES,
  canTransitionAuthorization,
  permitGate,
  type Authorization,
  type AuthorizationInput,
  type AuthorizationStatus,
  type AuthorizationType,
} from '../../domain/m2/authorizations';
import {
  DD_CATEGORIES,
  DD_SEVERITIES,
  ddGate,
  type DueDiligenceItem,
  type DueDiligenceCategory,
  type DueDiligenceSeverity,
} from '../../domain/m2/dueDiligence';
import { doGate, insuranceStatus } from '../../domain/m7/rules';
import { INSURANCE_TYPES, type Insurance, type InsuranceType } from '../../domain/m7/types';
import { FoncierSection } from './FoncierSection';

const today = () => new Date().toISOString().slice(0, 10);

function GateChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
      <span style={{ color: ok ? 'var(--ax-success)' : 'var(--ax-danger)' }}>
        {ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
      </span>
      <span className="text-[13px] text-ink-2">{label}</span>
      <Badge tone={ok ? 'success' : 'danger'}>{ok ? t('compliance.gate.ok') : t('compliance.gate.blocked')}</Badge>
    </span>
  );
}

export function ComplianceScreen({ id }: { id: string }) {
  const { compliance, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const auths = useAuthorizations(id);
  const inss = useInsurances(id);
  const dds = useDueDiligence(id);

  const [authRows, setAuthRows] = useState<Authorization[]>([]);
  const [insRows, setInsRows] = useState<Insurance[]>([]);
  const [ddRows, setDdRows] = useState<DueDiligenceItem[]>([]);
  useEffect(() => { if (auths.data) setAuthRows(auths.data); }, [auths.data]);
  useEffect(() => { if (inss.data) setInsRows(inss.data); }, [inss.data]);
  useEffect(() => { if (dds.data) setDdRows(dds.data); }, [dds.data]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'insurance.manage') && !readOnly;

  // Gardes M1 dérivées en direct (mêmes fonctions que getTransitionContext).
  const permitOk = permitGate(authRows, today()).ok;
  const doOk = doGate(insRows.map((i) => ({ type: i.type, validTo: i.validTo })), today()).ok;
  const ddOk = ddGate(ddRows).ok;

  // ── Autorisations ──
  const [authDraft, setAuthDraft] = useState<AuthorizationInput>({ type: 'permis_construire', authority: '', validity: '' });
  const [authAdding, setAuthAdding] = useState(false);
  async function addAuth() {
    if (!authDraft.authority.trim()) return;
    const rec = await compliance.addAuthorization(id, { ...authDraft, validity: authDraft.validity || null });
    setAuthRows((r) => [...r, rec]);
    setAuthDraft({ type: 'permis_construire', authority: '', validity: '' });
    setAuthAdding(false);
    toast.push(t('auth.added'), 'success');
  }
  async function setAuthStatus(aid: string, status: AuthorizationStatus) {
    const rec = await compliance.setAuthorizationStatus(aid, status);
    setAuthRows((r) => r.map((x) => (x.id === aid ? rec : x)));
  }
  async function removeAuth(aid: string) {
    await compliance.removeAuthorization(aid);
    setAuthRows((r) => r.filter((x) => x.id !== aid));
    toast.push(t('auth.removed'), 'info');
  }

  // ── Assurances ──
  const [insDraft, setInsDraft] = useState<{ type: InsuranceType; insurer: string; validFrom: string; validTo: string }>({
    type: 'DO', insurer: '', validFrom: today(), validTo: '',
  });
  const [insAdding, setInsAdding] = useState(false);
  async function addIns() {
    if (!insDraft.insurer.trim() || !insDraft.validFrom) return;
    const rec = await compliance.addInsurance(id, { ...insDraft, validTo: insDraft.validTo || null });
    setInsRows((r) => [...r, rec]);
    setInsDraft({ type: 'DO', insurer: '', validFrom: today(), validTo: '' });
    setInsAdding(false);
    toast.push(t('ins.added'), 'success');
  }
  async function removeIns(iid: string) {
    await compliance.removeInsurance(iid);
    setInsRows((r) => r.filter((x) => x.id !== iid));
    toast.push(t('ins.removed'), 'info');
  }

  // ── Due diligence ──
  const [ddDraft, setDdDraft] = useState<{ category: DueDiligenceCategory; finding: string; severity: DueDiligenceSeverity }>({
    category: 'litige', finding: '', severity: 'high',
  });
  const [ddAdding, setDdAdding] = useState(false);
  async function addDd() {
    if (!ddDraft.finding.trim()) return;
    const rec = await compliance.addDueDiligence(id, ddDraft);
    setDdRows((r) => [...r, rec]);
    setDdDraft({ category: 'litige', finding: '', severity: 'high' });
    setDdAdding(false);
    toast.push(t('dd.added'), 'success');
  }
  async function toggleDd(item: DueDiligenceItem) {
    const rec = await compliance.setDueDiligenceStatus(item.id, item.status === 'open' ? 'cleared' : 'open');
    setDdRows((r) => r.map((x) => (x.id === item.id ? rec : x)));
  }
  async function removeDd(did: string) {
    await compliance.removeDueDiligence(did);
    setDdRows((r) => r.filter((x) => x.id !== did));
    toast.push(t('dd.removed'), 'info');
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-medium">{t('compliance.title')}</h1>
        </div>
      </div>

      {readOnly && <Banner tone="warning">{t('compliance.readonly')}</Banner>}

      {/* Synthèse des gardes M1 dérivées de ces données */}
      <div className="flex flex-wrap gap-2">
        <GateChip ok={ddOk} label={t('compliance.gate.dd')} />
        <GateChip ok={permitOk} label={t('compliance.gate.permit')} />
        <GateChip ok={doOk} label={t('compliance.gate.do')} />
      </div>

      {/* ── Dossier foncier ── */}
      <FoncierSection operationId={id} currency={op?.currency ?? 'XOF'} canEdit={canEdit} />

      {/* ── Autorisations ── */}
      <Card tone="strong">
        <SectionHead title={t('auth.title')} addLabel={t('auth.add')} canEdit={canEdit} onAdd={() => setAuthAdding((a) => !a)} />
        {authAdding && canEdit && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select id="au-type" label={t('auth.field.type')} value={authDraft.type} onChange={(e) => setAuthDraft((d) => ({ ...d, type: e.target.value as AuthorizationType }))}>
              {AUTHORIZATION_TYPES.map((ty) => <option key={ty} value={ty}>{authorizationTypeLabel(ty)}</option>)}
            </Select>
            <Field id="au-auth" label={t('auth.field.authority')} value={authDraft.authority} onChange={(e) => setAuthDraft((d) => ({ ...d, authority: e.target.value }))} />
            <Field id="au-val" type="date" label={t('auth.field.validity')} value={authDraft.validity ?? ''} onChange={(e) => setAuthDraft((d) => ({ ...d, validity: e.target.value }))} />
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAuthAdding(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addAuth}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        <RowList loading={auths.loading} empty={authRows.length === 0} emptyLabel={t('auth.empty')}>
          {authRows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-3" style={{ borderTop: '1px solid var(--ax-border)' }}>
              <span className="min-w-[200px] flex-1">
                <span className="flex items-center gap-2">
                  <Badge>{authorizationTypeLabel(a.type)}</Badge>
                  <Badge tone={AUTH_STATUS_TONE[a.status]}>{authorizationStatusLabel(a.status)}</Badge>
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-3">
                  {a.authority}{a.validity ? ` · ${formatDate(a.validity, locale)}` : ''}
                </span>
              </span>
              {canEdit && (
                <span className="flex items-center gap-1.5">
                  {AUTHORIZATION_STATUSES.filter((s) => canTransitionAuthorization(a.status, s)).map((s) => (
                    <Button key={s} variant="glass" size="sm" onClick={() => setAuthStatus(a.id, s)}>{authorizationStatusLabel(s)}</Button>
                  ))}
                  <Button variant="ghost" size="sm" icon aria-label={t('auth.removed')} onClick={() => removeAuth(a.id)}><Trash2 size={15} /></Button>
                </span>
              )}
            </li>
          ))}
        </RowList>
      </Card>

      {/* ── Assurances ── */}
      <Card tone="strong">
        <SectionHead title={t('ins.title')} addLabel={t('ins.add')} canEdit={canEdit} onAdd={() => setInsAdding((a) => !a)} />
        {insAdding && canEdit && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select id="in-type" label={t('ins.field.type')} value={insDraft.type} onChange={(e) => setInsDraft((d) => ({ ...d, type: e.target.value as InsuranceType }))}>
              {INSURANCE_TYPES.map((ty) => <option key={ty} value={ty}>{insuranceTypeLabel(ty)}</option>)}
            </Select>
            <Field id="in-insurer" label={t('ins.field.insurer')} value={insDraft.insurer} onChange={(e) => setInsDraft((d) => ({ ...d, insurer: e.target.value }))} />
            <Field id="in-from" type="date" label={t('ins.field.validFrom')} value={insDraft.validFrom} onChange={(e) => setInsDraft((d) => ({ ...d, validFrom: e.target.value }))} />
            <Field id="in-to" type="date" label={t('ins.field.validTo')} value={insDraft.validTo} onChange={(e) => setInsDraft((d) => ({ ...d, validTo: e.target.value }))} />
            <div className="sm:col-span-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setInsAdding(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addIns}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        <RowList loading={inss.loading} empty={insRows.length === 0} emptyLabel={t('ins.empty')}>
          {insRows.map((i) => {
            const st = insuranceStatus({ validTo: i.validTo }, today());
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-3" style={{ borderTop: '1px solid var(--ax-border)' }}>
                <span className="min-w-[200px] flex-1">
                  <span className="flex items-center gap-2">
                    <Badge>{insuranceTypeLabel(i.type)}</Badge>
                    <Badge tone={INS_STATUS_TONE[st]}>{insuranceStatusLabel(st)}</Badge>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    {i.insurer} · {formatDate(i.validFrom, locale)} → {i.validTo ? formatDate(i.validTo, locale) : '—'}
                  </span>
                </span>
                {canEdit && (
                  <Button variant="ghost" size="sm" icon aria-label={t('ins.removed')} onClick={() => removeIns(i.id)}><Trash2 size={15} /></Button>
                )}
              </li>
            );
          })}
        </RowList>
      </Card>

      {/* ── Due diligence ── */}
      <Card tone="strong">
        <SectionHead title={t('dd.title')} addLabel={t('dd.add')} canEdit={canEdit} onAdd={() => setDdAdding((a) => !a)} />
        {ddAdding && canEdit && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select id="dd-cat" label={t('dd.field.category')} value={ddDraft.category} onChange={(e) => setDdDraft((d) => ({ ...d, category: e.target.value as DueDiligenceCategory }))}>
              {DD_CATEGORIES.map((c) => <option key={c} value={c}>{ddCategoryLabel(c)}</option>)}
            </Select>
            <Field id="dd-find" label={t('dd.field.finding')} value={ddDraft.finding} onChange={(e) => setDdDraft((d) => ({ ...d, finding: e.target.value }))} />
            <Select id="dd-sev" label={t('dd.field.severity')} value={ddDraft.severity} onChange={(e) => setDdDraft((d) => ({ ...d, severity: e.target.value as DueDiligenceSeverity }))}>
              {DD_SEVERITIES.map((s) => <option key={s} value={s}>{ddSeverityLabel(s)}</option>)}
            </Select>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDdAdding(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addDd}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        <RowList loading={dds.loading} empty={ddRows.length === 0} emptyLabel={t('dd.empty')}>
          {ddRows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-3" style={{ borderTop: '1px solid var(--ax-border)' }}>
              <span className="min-w-[200px] flex-1">
                <span className="flex items-center gap-2">
                  <Badge>{ddCategoryLabel(d.category)}</Badge>
                  <Badge tone={DD_SEV_TONE[d.severity]}>{ddSeverityLabel(d.severity)}</Badge>
                  <Badge tone={d.status === 'cleared' ? 'success' : 'neutral'}>{ddStatusLabel(d.status)}</Badge>
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-3">{d.finding}</span>
              </span>
              {canEdit && (
                <span className="flex items-center gap-1.5">
                  <Button variant="glass" size="sm" onClick={() => toggleDd(d)}>
                    {d.status === 'open' ? t('dd.action.clear') : t('dd.action.reopen')}
                  </Button>
                  <Button variant="ghost" size="sm" icon aria-label={t('dd.removed')} onClick={() => removeDd(d.id)}><Trash2 size={15} /></Button>
                </span>
              )}
            </li>
          ))}
        </RowList>
      </Card>

      <div className="text-[12px] text-ink-3">{t('compliance.subtitle')}</div>
    </div>
  );
}

function SectionHead({ title, addLabel, canEdit, onAdd }: { title: string; addLabel: string; canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[16px] font-medium">{title}</h2>
      {canEdit && (
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={16} />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

function RowList({ loading, empty, emptyLabel, children }: { loading: boolean; empty: boolean; emptyLabel: string; children: ReactNode }) {
  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 44 }} />)}
      </div>
    );
  }
  if (empty) return <div className="mt-3"><EmptyState title={emptyLabel} /></div>;
  return <ul className="mt-2 flex flex-col">{children}</ul>;
}
