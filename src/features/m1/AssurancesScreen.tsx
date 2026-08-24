import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Skeleton, EmptyState, type TableRowData } from '../../ui';
import { insuranceTypeLabel, insuranceStatusLabel, INS_STATUS_TONE, stakeholderTypeLabel } from './labels';
import { useOperation, useInsurances, useStakeholders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { insuranceStatus } from '../../domain/m7/rules';
import type { InsuranceStatus } from '../../domain/m7/types';

/**
 * Handoff 39 — Tableau des assurances (M7). Vue transversale de toutes les
 * polices de l'opération, tous intervenants confondus, avec statut dérivé
 * (valid / expiring / expired / missing). Une attestation expirée est un
 * contrôle bloquant (RG-M7-03) — mise en évidence en danger.
 */
export function AssurancesScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: insurances, loading } = useInsurances(id);
  const { data: stakeholders } = useStakeholders(id);

  const now = new Date().toISOString().slice(0, 10);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = insurances ?? [];
  const stakeholderName = (sid: string | null) => stakeholders?.find((s) => s.id === sid)?.name ?? t('assurances.noStakeholder');
  const stakeholderType = (sid: string | null) => {
    const s = stakeholders?.find((x) => x.id === sid);
    return s ? stakeholderTypeLabel(s.type) : '—';
  };

  const withStatus = list.map((ins) => ({ ins, status: insuranceStatus(ins, now) as InsuranceStatus }));
  const valid = withStatus.filter((x) => x.status === 'valid').length;
  const expiring = withStatus.filter((x) => x.status === 'expiring').length;
  const expired = withStatus.filter((x) => x.status === 'expired').length;
  // Tri : les statuts à traiter d'abord (expired, expiring), puis valides.
  const ORDER: Record<InsuranceStatus, number> = { expired: 0, missing: 1, expiring: 2, valid: 3 };
  const ordered = [...withStatus].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const rows: TableRowData[] = ordered.map(({ ins, status }) => ({
    cells: [
      <span>
        <span className="block font-medium">{stakeholderName(ins.stakeholderId)}</span>
        <span className="block text-[12px] text-ink-3">{stakeholderType(ins.stakeholderId)}</span>
      </span>,
      <span>{insuranceTypeLabel(ins.type)}</span>,
      <span className="text-ink-2">{ins.insurer}</span>,
      <span className="mono">{ins.validTo ? formatDate(ins.validTo, locale) : '—'}</span>,
      <Badge tone={INS_STATUS_TONE[status]}>{insuranceStatusLabel(status)}</Badge>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'stakeholders', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('assurances.title')}</h1>
        </div>
      </div>

      {expired > 0 && (
        <Banner tone="danger" icon={<ShieldAlert size={16} />}>{t('assurances.expiredWarning', { n: expired })}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('assurances.kpi.total'), value: list.length },
          { label: t('assurances.kpi.valid'), value: valid },
          { label: t('assurances.kpi.expiring'), value: expiring, accent: expiring > 0 },
          { label: t('assurances.kpi.expired'), value: expired, accent: expired > 0 },
        ]}
      />

      <Panel title={t('assurances.list')} meta="RG-M7-03" bodyPadded={false}>
        <DataTable
          template="1.6fr 1fr 1.2fr 1fr auto"
          columns={[
            { label: t('assurances.col.stakeholder') },
            { label: t('assurances.col.type') },
            { label: t('assurances.col.insurer') },
            { label: t('assurances.col.validTo') },
            { label: t('assurances.col.status') },
          ]}
          rows={rows}
          empty={<EmptyState title={t('assurances.title')} description={t('assurances.empty')} />}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('assurances.subtitle')}</div>
    </div>
  );
}
