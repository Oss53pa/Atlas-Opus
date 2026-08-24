import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, FactList, KpiRow, Panel, Money as MoneyView, Skeleton, type Fact } from '../../ui';
import { changeOriginLabel, changeStatusLabel, CHANGE_STATUS_TONE } from './labels';
import { useOperation, useChangeOrders, useContracts } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { Money, sumMoney } from '../../domain/money/Money';
import {
  requiredRoleFor, cumulativeAvenantAmount, avenantCap, exceedsCap,
  type ChangeApprovalRule,
} from '../../domain/m14';

/**
 * Handoff 41 — Simulateur d'impact (M15/M14). Drill-down d'un ordre de
 * modification : projette le nouveau montant du marché, contrôle le plafond
 * d'avenants (RG-M14-06), et rappelle le rôle d'approbation requis (RG-M14-03).
 * Aucun calcul monétaire hors Money.ts.
 */
export function ImpactSimScreen({ id, coid }: { id: string; coid: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: orders, loading } = useChangeOrders(id);
  const { data: contracts } = useContracts(id);

  const currency = op?.currency ?? 'XOF';
  const co = orders?.find((x) => x.id === coid) ?? null;

  // Seuils d'arbitrage & plafond d'avenants — config tenant simplifiée (cf. ModificationsScreen).
  const rules: ChangeApprovalRule[] = [
    { thresholdAmount: Money.of(10_000_000, currency), requiredRole: 'moa_director' },
    { thresholdAmount: Money.of(50_000_000, currency), requiredRole: 'owner' },
  ];
  const capRate = 0.3; // plafond réglementaire des avenants (marchés publics UEMOA)

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;
  if (!co) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'modifications', id })}>{t('common.back')}</Button>}>{t('impactSim.notFound')}</Banner>;

  const contract = contracts?.find((c) => c.id === co.contractId) ?? null;
  const initial = Money.of(contract?.amount ?? 0, currency);

  // Cumul des avenants déjà convertis sur ce marché + le CO courant s'il n'est pas encore converti.
  const converted = (orders ?? []).filter((o) => o.contractId === co.contractId);
  const cumulConverted = cumulativeAvenantAmount(converted, currency);
  const projectedCumul = co.status === 'converted'
    ? cumulConverted
    : sumMoney([cumulConverted, co.impactCost], currency);
  const projectedAmount = initial.add(projectedCumul);
  const cap = avenantCap(initial, capRate);
  const overCap = exceedsCap(projectedCumul, initial, capRate);
  const requiredRole = requiredRoleFor(co.impactCost, rules);
  const roleLabel = (r: string) => t(`role.${r}` as MessageKey);

  const signed = (m: Money) => `${m.isNegative() ? '' : '+'}${m.format(locale)}`;

  const facts: Fact[] = [
    { label: t('impactSim.contract'), value: contract ? contract.contractor : t('impactSim.noContract'), sub: contract?.reference },
    { label: t('impactSim.initialAmount'), value: <MoneyView amount={initial.toMajorNumber()} currency={currency} /> },
    { label: t('impactSim.cumulConverted'), value: <span className="mono">{signed(cumulConverted)}</span>, sub: t('impactSim.cumulConverted.sub') },
    { label: t('impactSim.thisImpact'), value: <span className="mono" style={co.impactCost.isNegative() ? { color: 'var(--ax-accent)' } : undefined}>{co.impactAnalyzed ? signed(co.impactCost) : t('impactSim.notAnalyzed')}</span>, sub: co.impactAnalyzed ? t('impactSim.days', { n: `${co.impactDays > 0 ? '+' : ''}${co.impactDays}` }) : undefined },
    { label: t('impactSim.projectedAmount'), value: <MoneyView amount={projectedAmount.toMajorNumber()} currency={currency} />, severity: 'accent' },
    { label: t('impactSim.cap', { pct: `${Math.round(capRate * 100)}` }), value: <span className="mono">{cap.format(locale)}</span>, sub: t('impactSim.cap.sub'), severity: overCap ? 'danger' : undefined },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'modifications', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge>{changeOriginLabel(co.origin)}</Badge>
            <Badge tone={CHANGE_STATUS_TONE[co.status]}>{changeStatusLabel(co.status)}</Badge>
            {co.avenantRef && <span className="mono text-[12px] text-ink-3">{co.avenantRef}</span>}
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('impactSim.title')}</h1>
          <div className="mt-1 text-[13px] text-ink-2">{co.description}</div>
        </div>
      </div>

      {overCap && (
        <Banner tone="warning" icon={<AlertTriangle size={16} />}>{t('impactSim.overCap', { pct: `${Math.round(capRate * 100)}` })}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('change.col.cost'), value: co.impactAnalyzed ? signed(co.impactCost) : '—', accent: co.impactCost.isNegative() },
          { label: t('change.col.days'), value: co.impactAnalyzed ? t('impactSim.days', { n: `${co.impactDays > 0 ? '+' : ''}${co.impactDays}` }) : '—', accent: co.impactDays > 0 },
          { label: t('impactSim.requiredRole'), value: roleLabel(requiredRole) },
        ]}
      />

      <Panel title={t('impactSim.propagation')} bodyPadded={false}>
        <FactList items={facts} />
      </Panel>

      <div className="text-[12px] text-ink-3">{t('impactSim.subtitle')}</div>
    </div>
  );
}
