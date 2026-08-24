import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, Skeleton, EmptyState, type TableRowData } from '../../ui';
import { riskCategoryLabel, riskStatusLabel, riskLevelLabel, RISK_STATUS_TONE, RISK_LEVEL_TONE, raciLabel, RACI_TONE } from './labels';
import { useOperation, useRisks, useRaci, useStakeholders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { riskScore, riskLevel, openRisksCount, controlledCount, criticalOpenCount, sortByCriticality } from '../../domain/m20';
import { raciActivitiesInBreach } from '../../domain/m7/rules';
import type { Raci } from '../../domain/m7/types';

const RACI_ORDER: Raci[] = ['R', 'A', 'C', 'I'];

/**
 * Handoff 40 — Registre des risques & RACI (M20 + M7). Réunit le registre des
 * risques (criticité = probabilité × impact, RG-M20-01) et la matrice RACI de
 * gouvernance (exactement un « A » par activité, RG-M7-07). Lecture consolidée ;
 * l'édition reste dans les modules Risques (M20) et Parties prenantes (M7).
 */
export function RegistreRisquesScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: risks, loading } = useRisks(id);
  const { data: raci } = useRaci(id);
  const { data: stakeholders } = useStakeholders(id);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 320 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = risks ?? [];
  const open = openRisksCount(list);
  const controlled = controlledCount(list);
  const critical = criticalOpenCount(list);
  const ordered = sortByCriticality(list);

  const assignments = raci ?? [];
  const breaches = raciActivitiesInBreach(assignments);
  const stakeholderName = (sid: string) => stakeholders?.find((s) => s.id === sid)?.name ?? '—';

  // Regroupe les assignations RACI par activité pour la matrice.
  const activities = [...new Set(assignments.map((a) => a.activity))];
  const byActivity = activities.map((activity) => ({
    activity,
    inBreach: breaches.includes(activity),
    cells: RACI_ORDER.map((r) => ({
      raci: r,
      names: assignments.filter((a) => a.activity === activity && a.raci === r).map((a) => stakeholderName(a.stakeholderId)),
    })),
  }));

  const riskRows: TableRowData[] = ordered.map((r) => {
    const score = riskScore(r.probability, r.impact);
    const level = riskLevel(score);
    return {
      cells: [
        <span className="mono text-[12px] text-ink-3">{r.code}</span>,
        <span>
          <span className="block font-medium">{r.label}</span>
          {r.mitigation && <span className="block text-[12px] text-ink-3">{r.mitigation}</span>}
        </span>,
        <span>{riskCategoryLabel(r.category)}</span>,
        <span className="mono">{r.probability}×{r.impact} = {score}</span>,
        <Badge tone={RISK_LEVEL_TONE[level]}>{riskLevelLabel(level)}</Badge>,
        <Badge tone={RISK_STATUS_TONE[r.status]}>{riskStatusLabel(r.status)}</Badge>,
      ],
    };
  });

  const raciRows: TableRowData[] = byActivity.map((a) => ({
    cells: [
      <span className="flex items-center gap-2">
        {a.inBreach && <AlertTriangle size={13} style={{ color: 'var(--ax-danger)' }} />}
        <span className={a.inBreach ? 'font-medium' : undefined}>{a.activity}</span>
      </span>,
      ...a.cells.map(({ raci: r, names }) => (
        names.length > 0
          ? <span className="flex flex-wrap items-center gap-1"><Badge tone={RACI_TONE[r]}>{raciLabel(r)}</Badge><span className="text-[12px] text-ink-2">{names.join(', ')}</span></span>
          : <span className="text-ink-3">—</span>
      )),
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'risques', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('registre.title')}</h1>
        </div>
      </div>

      {(critical > 0 || breaches.length > 0) && (
        <Banner tone={critical > 0 ? 'danger' : 'warning'} icon={<AlertTriangle size={16} />}>
          {critical > 0 ? t('registre.criticalWarning', { n: critical }) : t('registre.raciWarning', { n: breaches.length })}
        </Banner>
      )}

      <KpiRow
        items={[
          { label: t('registre.kpi.open'), value: open },
          { label: t('registre.kpi.critical'), value: critical, accent: critical > 0 },
          { label: t('registre.kpi.controlled'), value: controlled },
          { label: t('registre.kpi.raciBreach'), value: breaches.length, accent: breaches.length > 0 },
        ]}
      />

      <Panel title={t('registre.risks')} meta="RG-M20-01" bodyPadded={false}>
        <DataTable
          template="70px 2fr 1fr 1.1fr 1fr auto"
          columns={[
            { label: t('registre.col.code') },
            { label: t('registre.col.label') },
            { label: t('registre.col.category') },
            { label: t('registre.col.score'), align: 'right' },
            { label: t('registre.col.level') },
            { label: t('registre.col.status') },
          ]}
          rows={riskRows}
          empty={<EmptyState title={t('registre.risks')} description={t('registre.emptyRisks')} />}
        />
      </Panel>

      <Panel title={t('registre.raci')} meta="RG-M7-07" bodyPadded={false}>
        <DataTable
          template="1.6fr 1fr 1fr 1fr 1fr"
          columns={[
            { label: t('registre.col.activity') },
            { label: t('raci.R') },
            { label: t('raci.A') },
            { label: t('raci.C') },
            { label: t('raci.I') },
          ]}
          rows={raciRows}
          empty={<EmptyState title={t('registre.raci')} description={t('registre.emptyRaci')} />}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('registre.subtitle')}</div>
    </div>
  );
}
