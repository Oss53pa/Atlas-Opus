import { ChevronLeft, UserPlus } from 'lucide-react';
import { Badge, Button, DataTable, FactList, KpiRow, Panel, Skeleton, EmptyState, useToast, type Fact, type TableRowData } from '../../ui';
import { useMembers } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { activeMembers, distinctRoles, type MemberStatus } from '../../domain/admin';

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
  const { data: members, loading } = useMembers();
  const roleLabel = (r: string) => t(`role.${r}` as MessageKey);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = members ?? [];
  const active = activeMembers(list);
  const pending = list.filter((m) => m.status === 'en_attente').length;
  const roles = distinctRoles(list);
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
          <Button variant="primary" size="sm" onClick={() => toast.push(t('membres.invite.soon'), 'info')}><UserPlus size={15} />{t('membres.invite')}</Button>
        </div>
      </div>

      <KpiRow
        items={[
          { label: t('membres.kpi.members'), value: active, sub: t('membres.kpi.seats', { n: 12 }) },
          { label: t('membres.kpi.invitations'), value: pending, sub: t('membres.kpi.invitationsSub') },
          { label: t('membres.kpi.roles'), value: roles, sub: t('membres.kpi.rolesSub', { n: 9 }) },
          { label: t('membres.kpi.restricted'), value: restricted, sub: t('membres.kpi.restrictedSub') },
          { label: t('membres.kpi.revocation'), value: '04.07', sub: t('membres.kpi.revocationSub') },
        ]}
      />

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
