import { ChevronLeft, ArrowRightLeft, PackageSearch } from 'lucide-react';
import { Badge, Banner, Button, DataTable, FactList, KpiRow, Panel, Skeleton, StatCard, useToast, type Fact, type TableRowData } from '../../ui';
import { useOperation, useHandover, useReserves } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatPercent } from '../../lib/format';
import {
  doeCompletion, categoryCompletion, categoryStatus, canTransfer,
  type DoeCategoryKey, type TargetSystem, type TransferState, type DoeCategoryStatus,
} from '../../domain/handover';
import { canPronounceReception } from '../../domain/m19';

const DOE_KEY: Record<DoeCategoryKey, MessageKey> = {
  plans_asbuilt: 'bascule.doe.plans_asbuilt',
  notices: 'bascule.doe.notices',
  garanties: 'bascule.doe.garanties',
  pv_controle: 'bascule.doe.pv_controle',
};
const CAT_STATUS_KEY: Record<DoeCategoryStatus, MessageKey> = {
  complet: 'bascule.status.complet',
  en_cours: 'bascule.status.en_cours',
  incomplet: 'bascule.status.incomplet',
};
const CAT_STATUS_TONE: Record<DoeCategoryStatus, 'success' | 'neutral' | 'accent'> = {
  complet: 'success', en_cours: 'neutral', incomplet: 'accent',
};
const TARGET_KEY: Record<TargetSystem, MessageKey> = { keystone: 'bascule.target.keystone', lease: 'bascule.target.lease' };
const STATE_KEY: Record<TransferState, MessageKey> = {
  non_lance: 'bascule.state.non_lance', preparation: 'bascule.state.preparation',
  pret: 'bascule.state.pret', transfere: 'bascule.state.transfere',
};

/**
 * Handoff 25 — Passation vers exploitation (bascule). Le transfert vers
 * Keystone / Atlas Lease est conditionné au DOE complet et à la réception
 * prononcée (RG-M20-01, `canTransfer`). La réception est dérivée des réserves
 * majeures ouvertes (M19). Le bouton primaire est désactivé tant qu'un
 * contrôle bloque, avec la cause affichée.
 */
export function BasculeScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: file, loading } = useHandover(id);
  const { data: reserves } = useReserves(id);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 320 }} /><Skeleton style={{ height: 220 }} /></div>;
  if (!file) return <Banner tone="warning" action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'cockpit', id })}>{t('common.back')}</Button>}>{t('bascule.empty')}</Banner>;

  const receptionOk = canPronounceReception(reserves ?? []).ok;
  const completion = doeCompletion(file.doe);
  const ready = canTransfer(file, receptionOk);

  const equipmentFacts: Fact[] = file.equipment.map((e) => ({
    label: e.label,
    sub: e.detail,
    value: <Badge tone={e.target === 'keystone' ? 'accent' : 'neutral'}>{t(TARGET_KEY[e.target])}</Badge>,
  }));

  const conditionFacts: Fact[] = [
    { label: t('bascule.cond.doe'), value: <span className="mono">{formatPercent(completion, locale, 0)}</span>, sub: 'RG-M20-01', severity: completion >= 1 ? 'accent' : 'danger' },
    { label: t('bascule.cond.reception'), value: receptionOk ? t('common.yes') : t('common.no'), sub: 'M19', severity: receptionOk ? 'accent' : 'danger' },
    { label: t('bascule.cond.export'), value: file.exportReady ? t('bascule.ready') : t('common.no'), sub: t('bascule.cond.export.sub'), severity: file.exportReady ? 'neutral' : 'danger' },
  ];

  const doeRows: TableRowData[] = file.doe.map((c) => {
    const st = categoryStatus(c);
    return {
      cells: [
        <span>
          <span className="block font-medium">{t(DOE_KEY[c.key])}</span>
          <span className="block text-[12px] text-ink-3">{c.responsible}</span>
        </span>,
        <span className="mono">{c.expected}</span>,
        <span className="mono">{c.received}</span>,
        <Badge tone={CAT_STATUS_TONE[st]}>{t(CAT_STATUS_KEY[st])}</Badge>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('bascule.title')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" size="sm" onClick={() => toast.push(t('bascule.inventory.soon'), 'info')}><PackageSearch size={15} />{t('bascule.inventory')}</Button>
          <Button variant="primary" size="sm" disabled={!ready} onClick={() => toast.push(t('bascule.prepare.done'), 'success')}><ArrowRightLeft size={15} />{t('bascule.prepare')}</Button>
        </div>
      </div>

      {!ready && (
        <Banner tone="warning">{t('bascule.blocked')}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('bascule.kpi.doe'), value: formatPercent(completion, locale, 0), accent: completion < 1 },
          { label: t('bascule.kpi.equipment'), value: file.equipmentCount },
          { label: t('bascule.kpi.guarantees'), value: file.guaranteesCount },
          { label: t('bascule.kpi.guaranteesNoEnd'), value: file.guaranteesWithoutEnd, accent: file.guaranteesWithoutEnd > 0 },
          { label: t('bascule.kpi.state'), value: t(STATE_KEY[file.transferState]) },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel title={t('bascule.doe.title')} meta={t('bascule.doe.meta')} bodyPadded={false}>
          <DataTable
            template="1.8fr 80px 80px auto"
            columns={[
              { label: t('bascule.col.category') },
              { label: t('bascule.col.expected'), align: 'right' },
              { label: t('bascule.col.received'), align: 'right' },
              { label: t('bascule.col.status') },
            ]}
            rows={doeRows}
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t('bascule.equipment.title')} bodyPadded={false}>
            <FactList items={equipmentFacts} />
          </Panel>
          <Panel title={t('bascule.conditions.title')} meta="RG-M20-01" bodyPadded={false}>
            <FactList items={conditionFacts} />
          </Panel>
        </div>
      </div>

      <Panel title={t('bascule.completion.title')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {file.doe.map((c) => (
            <StatCard key={c.key} label={t(DOE_KEY[c.key])} emphasis={categoryCompletion(c) < 1}>
              <span className="text-[16px]">{c.received} / {c.expected}</span>
              <span className="ml-2 text-[13px] text-ink-3">{formatPercent(categoryCompletion(c), locale, 0)}</span>
            </StatCard>
          ))}
        </div>
      </Panel>

      <div className="text-[12px] text-ink-3">{t('bascule.subtitle')}</div>
    </div>
  );
}
