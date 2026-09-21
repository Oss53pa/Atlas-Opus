import { useState } from 'react';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, type TableRowData } from '../../ui';
import { useBilan, useOperation } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import {
  applyScenario, pointMort, sensitivity, SCENARIO_KINDS, SCENARIO_PRESETS,
  type ScenarioAssumptions, type ScenarioKind, type SensitivityAxis,
} from '../../domain/finance/scenarios';

const DELTAS = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2];
const KIND_TONE: Record<ScenarioKind, 'success' | 'accent' | 'warning' | 'danger'> = {
  optimiste: 'success', probable: 'accent', pessimiste: 'warning', stress: 'danger',
};

/** Saisie en points de pourcentage → taux (« -5 » → -0,05). */
const pct = (v: string) => (Number(v.replace(',', '.')) || 0) / 100;
const signed = (r: number) => `${r > 0 ? '+' : ''}${formatPercent(r, locale, 1)}`;

/**
 * M4 — Scénarios & sensibilité (transposé d'Advancity, « études de faisabilité »).
 * Tout part du bilan réel de l'opération : seules les hypothèses varient, rien
 * n'est ressaisi ni stocké. Calculs exclusivement via Money.ts.
 */
export function ScenariosScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: bilan, loading } = useBilan(id);
  const [axis, setAxis] = useState<SensitivityAxis>('cost');
  const [custom, setCustom] = useState({ revenue: '0', cost: '0', delay: '0' });

  const currency = op?.currency ?? 'XOF';
  const money = (n: number) => `${formatAmount(n, locale)} ${currency}`;
  const base = bilan ? { recettes: bilan.summary.recettes, coutTotal: bilan.summary.coutTotal } : null;

  const header = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
      <div>
        <div className="text-[13px] text-ink-3"><TrendingUp size={12} className="mb-0.5 inline" /> {op?.name}</div>
        <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('scenarios.title')}</h1>
      </div>
    </div>
  );

  if (loading) return <div className="flex flex-col gap-4">{header}<Skeleton style={{ height: 220 }} /></div>;
  if (!base || base.coutTotal.isZero()) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card><EmptyState title={t('scenarios.title')} description={t('scenarios.noBilan')} /></Card>
      </div>
    );
  }

  const customAssumptions: ScenarioAssumptions = {
    revenueDelta: pct(custom.revenue), costDelta: pct(custom.cost), delayMonths: Number(custom.delay) || 0,
  };
  const customResult = applyScenario(base, customAssumptions);
  const seuilCout = pointMort(base, 'cost');
  const seuilRecettes = pointMort(base, 'revenue');
  const reference = applyScenario(base, SCENARIO_PRESETS.probable);

  const scenarioRows: TableRowData[] = SCENARIO_KINDS.map((k) => {
    const s = SCENARIO_PRESETS[k];
    const r = applyScenario(base, s);
    return {
      cells: [
        <span className="flex items-center gap-2">
          <Badge tone={KIND_TONE[k]}>{t(`scenarios.kind.${k}` as MessageKey)}</Badge>
          <span className="text-[12px] text-ink-3">
            {signed(s.revenueDelta)} {t('scenarios.short.revenue')} · {signed(s.costDelta)} {t('scenarios.short.cost')}
            {s.delayMonths ? ` · +${s.delayMonths} ${t('scenarios.months')}` : ''}
          </span>
        </span>,
        <span className="mono">{money(r.recettes.toMajorNumber())}</span>,
        <span className="mono">{money(r.coutTotal.toMajorNumber())}</span>,
        <span className="mono" style={{ color: r.marge.isNegative() ? 'var(--ax-danger)' : undefined }}>{money(r.marge.toMajorNumber())}</span>,
        <span className="mono">{formatPercent(r.tauxMarge, locale, 1)}</span>,
      ],
    };
  });

  const maxAbs = Math.max(1, ...sensitivity(base, axis, DELTAS).map((r) => Math.abs(r.marge.toMajorNumber())));
  const sensitivityRows: TableRowData[] = sensitivity(base, axis, DELTAS).map((r) => ({
    cells: [
      <span className="mono">{signed(r.delta)}</span>,
      <span className="block h-2 rounded-full" style={{
        width: `${Math.max(2, (Math.abs(r.marge.toMajorNumber()) / maxAbs) * 100)}%`,
        background: r.marge.isNegative() ? 'var(--ax-danger)' : 'var(--ax-accent)',
      }} />,
      <span className="mono">{money(r.marge.toMajorNumber())}</span>,
      <span className="mono">{formatPercent(r.tauxMarge, locale, 1)}</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      {header}

      <KpiRow
        items={[
          { label: t('scenarios.kpi.marge'), value: money(reference.marge.toMajorNumber()), sub: formatPercent(reference.tauxMarge, locale, 1) },
          { label: t('scenarios.kpi.stress'), value: money(applyScenario(base, SCENARIO_PRESETS.stress).marge.toMajorNumber()), accent: applyScenario(base, SCENARIO_PRESETS.stress).marge.isNegative() },
          { label: t('scenarios.kpi.pmCost'), value: seuilCout === null ? t('scenarios.pm.none') : signed(seuilCout) },
          { label: t('scenarios.kpi.pmRevenue'), value: seuilRecettes === null ? t('scenarios.pm.none') : signed(seuilRecettes) },
        ]}
      />

      <Panel title={t('scenarios.presets')} meta="M4" bodyPadded={false}>
        <DataTable
          template="2fr 1fr 1fr 1fr 0.7fr"
          columns={[
            { label: t('scenarios.col.scenario') },
            { label: t('scenarios.col.revenue'), align: 'right' },
            { label: t('scenarios.col.cost'), align: 'right' },
            { label: t('scenarios.col.marge'), align: 'right' },
            { label: t('scenarios.col.taux'), align: 'right' },
          ]}
          rows={scenarioRows}
        />
      </Panel>

      <Panel title={t('scenarios.custom')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field id="sc-rev" label={t('scenarios.field.revenue')} inputMode="decimal" value={custom.revenue} onChange={(e) => setCustom((c) => ({ ...c, revenue: e.target.value }))} />
          <Field id="sc-cost" label={t('scenarios.field.cost')} inputMode="decimal" value={custom.cost} onChange={(e) => setCustom((c) => ({ ...c, cost: e.target.value }))} />
          <Field id="sc-delay" label={t('scenarios.field.delay')} inputMode="numeric" value={custom.delay} onChange={(e) => setCustom((c) => ({ ...c, delay: e.target.value }))} />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px]">
          <span>{t('scenarios.col.marge')} : <span className="mono font-medium" style={{ color: customResult.marge.isNegative() ? 'var(--ax-danger)' : undefined }}>{money(customResult.marge.toMajorNumber())}</span></span>
          <span>{t('scenarios.col.taux')} : <span className="mono">{formatPercent(customResult.tauxMarge, locale, 1)}</span></span>
        </div>
        {customResult.marge.isNegative() && <div className="mt-3"><Banner tone="danger">{t('scenarios.negative')}</Banner></div>}
      </Panel>

      <Panel
        title={t('scenarios.sensitivity')}
        actions={
          <Select id="sc-axis" value={axis} onChange={(e) => setAxis(e.target.value as SensitivityAxis)}>
            <option value="cost">{t('scenarios.axis.cost')}</option>
            <option value="revenue">{t('scenarios.axis.revenue')}</option>
          </Select>
        }
        bodyPadded={false}
      >
        <DataTable
          template="0.6fr 2fr 1fr 0.7fr"
          columns={[
            { label: t('scenarios.col.delta') },
            { label: '' },
            { label: t('scenarios.col.marge'), align: 'right' },
            { label: t('scenarios.col.taux'), align: 'right' },
          ]}
          rows={sensitivityRows}
        />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('scenarios.subtitle')}</div>
    </div>
  );
}
