import { useState } from 'react';
import { ChevronLeft, UserPlus, Trash2, Shield } from 'lucide-react';
import { Badge, Button, DataTable, Field, FactList, KpiRow, Panel, Select, Skeleton, EmptyState, useToast, type Fact, type TableRowData } from '../../ui';
import { useData, useMembers, useMemberGrants, useOperations } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { activeMembers, distinctRoles, effectiveRole, validateGrantInput, validateInvite, linkableMembers, type MemberStatus } from '../../domain/admin';
import { ROLES, type Role } from '../../domain/m1/types';
import { can } from '../../domain/m1/permissions';

const STATUS_KEY: Record<MemberStatus, MessageKey> = {
  actif: 'membres.status.actif', en_attente: 'membres.status.en_attente', suspendu: 'membres.status.suspendu',
};
const STATUS_TONE: Record<MemberStatus, 'success' | 'accent' | 'warning'> = {
  actif: 'success', en_attente: 'accent', suspendu: 'warning',
};

/**
 * Handoff 31 — Membres & rôles (F1). Membres du tenant, rôles, périmètres et
 * statut ; rôles & pouvoirs (extraits du CDC) et contrôles d'accès (RLS par
 * tenant, périmètre par opération). Vue tenant, lecture consolidée.
 */
export function MembresScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const { admin, membership, session } = useData();
  const { data: members, loading, refetch: refetchMembers } = useMembers();
  const { data: grants, refetch: refetchGrants } = useMemberGrants();
  const { data: operations } = useOperations({});
  const roleLabel = (r: string) => t(`role.${r}` as MessageKey);
  const canManage = can(session.role, 'member.manage');

  // Éditeur d'attribution des droits (F1 · rôles + périmètre → ao_tenant_roles/
  // ao_operation_members). Écriture sensible en ligne (jamais offline).
  const [userId, setUserId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [scopeAll, setScopeAll] = useState(true);
  const [scope, setScope] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setUserId(''); setRoles([]); setScopeAll(true); setScope([]);
  }
  function toggleRole(r: Role) {
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  }
  function toggleOp(id: string) {
    setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  async function saveGrant() {
    const input = { userId: userId.trim(), roles, operationScope: scopeAll ? null : scope };
    const v = validateGrantInput(input);
    if (!v.ok) { toast.push(v.errors[0] ?? t('grant.invalid'), 'danger'); return; }
    setSaving(true);
    try {
      await membership.setGrant(input);
      toast.push(t('grant.saved'), 'success');
      resetForm();
      refetchGrants();
    } catch {
      toast.push(t('grant.error'), 'danger');
    } finally {
      setSaving(false);
    }
  }
  async function revokeGrant(uid: string) {
    await membership.revoke(uid);
    toast.push(t('grant.revoked'), 'info');
    refetchGrants();
  }

  // Invitation d'un membre (crée une entrée « en_attente » ; droits attribués
  // ensuite via l'éditeur une fois le compte lié).
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState<{ name: string; email: string; role: Role }>({ name: '', email: '', role: 'viewer' });
  async function sendInvite() {
    const v = validateInvite(invite);
    if (!v.ok) { toast.push(v.errors[0] ?? t('grant.invalid'), 'danger'); return; }
    try {
      await admin.invite(invite);
      toast.push(t('invite.sent'), 'success');
      setInvite({ name: '', email: '', role: 'viewer' });
      setInviting(false);
      refetchMembers();
    } catch {
      toast.push(t('invite.error'), 'danger');
    }
  }

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = members ?? [];
  const active = activeMembers(list);
  const pending = list.filter((m) => m.status === 'en_attente').length;
  const roleCount = distinctRoles(list);
  const restricted = list.filter((m) => m.scope !== 'toutes opérations').length;

  const rows: TableRowData[] = list.map((m) => ({
    cells: [
      <span>
        <span className="block font-medium">{m.name}</span>
        <span className="mono block text-[12px] text-ink-3">{m.email}</span>
      </span>,
      <Badge tone={m.status === 'actif' ? 'accent' : 'neutral'}>{roleLabel(m.role)}</Badge>,
      <span className="text-[13px]">{m.scope}</span>,
      <span className="mono text-[12px] text-ink-3">{m.lastActivity ?? '—'}</span>,
      <Badge tone={STATUS_TONE[m.status]}>{t(STATUS_KEY[m.status])}</Badge>,
    ],
  }));

  const powerFacts: Fact[] = [
    { label: t('role.moa_director'), value: t('membres.power.validate'), sub: t('membres.power.moa'), severity: 'neutral' },
    { label: t('role.finance'), value: t('membres.power.mandate'), sub: t('membres.power.finance'), severity: 'neutral' },
    { label: t('role.amo'), value: t('membres.power.instruct'), sub: t('membres.power.amo'), severity: 'neutral' },
    { label: t('role.site'), value: t('membres.power.capture'), sub: t('membres.power.site'), severity: 'neutral' },
  ];
  const accessFacts: Fact[] = [
    { label: t('membres.access.isolation'), value: t('membres.access.active'), sub: t('membres.access.isolationSub'), severity: 'accent' },
    { label: t('membres.access.scope'), value: t('membres.access.scopeVal', { n: restricted }), severity: 'neutral' },
    { label: t('membres.access.mfa'), value: '2', sub: t('membres.access.mfaSub'), severity: 'accent' },
  ];
  const delegationFacts: Fact[] = [
    { label: 'A. Diallo → K. Traoré', value: t('membres.deleg.until', { date: '31.08' }), sub: t('membres.deleg.sub'), severity: 'accent' },
    { label: t('membres.deleg.none'), sub: t('membres.deleg.noneSub'), severity: 'neutral' },
  ];

  const opName = (id: string) => (operations ?? []).find((o) => o.id === id)?.name ?? id;
  const memberName = (uid: string) => list.find((m) => m.userId === uid)?.name;
  const grantRows: TableRowData[] = (grants ?? []).map((g) => ({
    cells: [
      <span>
        {memberName(g.userId) ? <span className="block font-medium">{memberName(g.userId)}</span> : null}
        <span className="mono block text-[12px] text-ink-3">{g.userId}</span>
      </span>,
      <Badge tone="accent">{roleLabel(effectiveRole(g.roles) ?? 'viewer')}</Badge>,
      <span className="text-[13px]">{g.operationScope === null ? t('grant.scope.all') : g.operationScope.map(opName).join(', ')}</span>,
      canManage ? (
        <Button variant="ghost" size="sm" icon aria-label={t('grant.revoke')} onClick={() => revokeGrant(g.userId)}><Trash2 size={15} /></Button>
      ) : <span />,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{t('membres.context', { n: list.length, pending })}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('membres.title')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" size="sm">{t('membres.accessLog')}</Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setInviting((v) => !v)}><UserPlus size={15} />{t('membres.invite')}</Button>
          )}
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('membres.kpi.members'), value: active, sub: t('membres.kpi.seats', { n: 12 }) },
          { label: t('membres.kpi.invitations'), value: pending, sub: t('membres.kpi.invitationsSub') },
          { label: t('membres.kpi.roles'), value: roleCount, sub: t('membres.kpi.rolesSub', { n: 9 }) },
          { label: t('membres.kpi.restricted'), value: restricted, sub: t('membres.kpi.restrictedSub') },
          { label: t('membres.kpi.revocation'), value: '04.07', sub: t('membres.kpi.revocationSub') },
        ]}
      />

      {canManage && inviting && (
        <Panel title={t('invite.title')} meta={t('invite.meta')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="inv-name" label={t('invite.name')} value={invite.name} onChange={(e) => setInvite((d) => ({ ...d, name: e.target.value }))} />
            <Field id="inv-email" label={t('invite.email')} type="email" value={invite.email} onChange={(e) => setInvite((d) => ({ ...d, email: e.target.value }))} />
            <Select id="inv-role" label={t('invite.role')} value={invite.role} onChange={(e) => setInvite((d) => ({ ...d, role: e.target.value as Role }))}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-ink-3">{t('invite.hint')}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setInviting(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={sendInvite}>{t('invite.send')}</Button>
            </div>
          </div>
        </Panel>
      )}

      {canManage && (
        <Panel title={t('grant.title')} meta={t('grant.meta')}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select id="grant-member" label={t('grant.member')} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">{t('grant.member.ph')}</option>
                {linkableMembers(list).map((m) => (
                  <option key={m.id} value={m.userId as string}>{m.name} · {roleLabel(m.role)}</option>
                ))}
              </Select>
              <Field id="grant-user" label={t('grant.user')} value={userId} placeholder={t('grant.user.ph')} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-medium text-ink-2">{t('grant.roles')}</div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <Button key={r} variant={roles.includes(r) ? 'primary' : 'glass'} size="sm" onClick={() => toggleRole(r)}>{roleLabel(r)}</Button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[12px] font-medium text-ink-2">{t('grant.scope')}</div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant={scopeAll ? 'primary' : 'glass'} size="sm" onClick={() => setScopeAll(true)}>{t('grant.scope.all')}</Button>
                <Button variant={!scopeAll ? 'primary' : 'glass'} size="sm" onClick={() => setScopeAll(false)}>{t('grant.scope.restricted')}</Button>
              </div>
              {!scopeAll && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(operations ?? []).map((o) => (
                    <Button key={o.id} variant={scope.includes(o.id) ? 'primary' : 'glass'} size="sm" onClick={() => toggleOp(o.id)}>{o.name}</Button>
                  ))}
                  {(operations ?? []).length === 0 && <span className="text-[12px] text-ink-3">{t('grant.scope.noops')}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-ink-3"><Shield size={12} className="mb-0.5 inline" /> {t('grant.hint')}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm}>{t('common.cancel')}</Button>
                <Button variant="primary" size="sm" onClick={saveGrant} disabled={saving}>{t('grant.save')}</Button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <DataTable
              template="1.4fr 1fr 1.6fr auto"
              columns={[
                { label: t('grant.col.user') },
                { label: t('grant.col.role') },
                { label: t('grant.col.scope') },
                { label: '' },
              ]}
              rows={grantRows}
              empty={<EmptyState title={t('grant.title')} description={t('grant.empty')} />}
            />
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title={t('membres.list')} meta={t('membres.list.meta')} bodyPadded={false}>
            <DataTable
              template="1.8fr 1fr 1.2fr 90px auto"
              columns={[
                { label: t('membres.col.member') },
                { label: t('membres.col.role') },
                { label: t('membres.col.scope') },
                { label: t('membres.col.activity'), align: 'right' },
                { label: t('membres.col.status') },
              ]}
              rows={rows}
              empty={<EmptyState title={t('membres.title')} description={t('membres.empty')} />}
            />
          </Panel>
          <Panel title={t('membres.delegation')} meta={t('membres.delegation.meta')} bodyPadded={false}>
            <FactList items={delegationFacts} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title={t('membres.powers')} meta={t('membres.powers.meta')} bodyPadded={false}>
            <FactList items={powerFacts} />
          </Panel>
          <Panel title={t('membres.access')} meta={t('membres.access.meta')} bodyPadded={false}>
            <FactList items={accessFacts} />
          </Panel>
        </div>
      </div>

      <div className="text-[12px] text-ink-3">{t('membres.subtitle')}</div>
    </div>
  );
}
