import { ChevronLeft } from 'lucide-react';
import { Badge, Banner, Button, DataTable, FactList, KpiRow, Panel, Skeleton, EmptyState, type Fact, type TableRowData } from '../../ui';
import { useApprovals } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { tasksForMe, type ApprovalStatus } from '../../domain/admin';

const STATUS_KEY: Record<ApprovalStatus, MessageKey> = {
  a_valider: 'appro.status.a_valider',
  a_arbitrer: 'appro.status.a_arbitrer',
  a_decider: 'appro.status.a_decider',
  visa_moe: 'appro.status.visa_moe',
};
const STATUS_TONE: Record<ApprovalStatus, 'accent' | 'neutral'> = {
  a_valider: 'accent', a_arbitrer: 'accent', a_decider: 'accent', visa_moe: 'neutral',
};

/** Montant abrégé en millions (mono), signe négatif explicite. */
function toM(amount: number): string {
  const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(amount) / 1_000_000);
  return `${amount < 0 ? '−' : ''}${s} M`;
}

/**
 * Handoff 33 — Boîte d'approbations (F7). File unifiée des tâches à valider,
 * routage par seuil (RG-M14-03) et délégation. Vue tenant, lecture consolidée ;
 * les décisions se prennent dans les modules source.
 */
export function ApprovalsScreen() {
  const { navigate } = useNav();
  const { data: tasks, loading } = useApprovals();
  const roleLabel = (r: string) => t(`role.${r}` as MessageKey);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 300 }} /><Skeleton style={{ height: 220 }} /></div>;

  const list = tasks ?? [];
  const forMe = tasksForMe(list);
  const situations = list.filter((x) => x.module === 'M13');
  const avenants = list.filter((x) => x.module === 'M14');
  const attributions = list.filter((x) => x.module === 'M8');
  const sumM = (arr: typeof list) => toM(arr.reduce((s, x) => s + x.amount, 0));
  const selected = list[0] ?? null;

  const rows: TableRowData[] = list.map((task) => ({
    cells: [
      <span className="mono text-[12px] text-ink-3">{task.module}</span>,
      <span>
        <span className="block font-medium">{task.object}</span>
        <span className="block text-[12px] text-ink-3">{task.detail}</span>
      </span>,
      <span className="text-[13px]">{roleLabel(task.requiredRole)}</span>,
      <span className="mono">{toM(task.amount)}</span>,
      <Badge tone={STATUS_TONE[task.status]}>{t(STATUS_KEY[task.status])}</Badge>,
    ],
  }));

  const routingFacts: Fact[] = [
    { label: t('appro.tier.low'), value: t('role.amo'), severity: 'neutral' },
    { label: t('appro.tier.mid'), value: t('role.moa_director'), sub: t('appro.tier.midSub', { n: avenants.length }), severity: 'neutral' },
    { label: t('appro.tier.high'), value: `${t('role.owner')}`, sub: t('appro.tier.highSub', { n: attributions.length }), severity: 'accent' },
  ];
  const ruleFacts: Fact[] = [
    { label: t('appro.rule.doubleVisa'), sub: 'MOE puis MOA · RG-M13-02' },
    { label: t('appro.rule.motive'), sub: t('appro.rule.motiveSub') },
    { label: t('appro.rule.delegation'), value: '1', sub: 'A. Diallo → K. Traoré' },
  ];
  const selectedFacts: Fact[] = selected ? [
    { label: t('appro.sel.gross'), value: <span className="mono">{toM(selected.amount)}</span> },
    { label: t('appro.sel.retention'), value: <span className="mono">− {toM(selected.amount * 0.15)}</span>, sub: t('appro.sel.retentionSub') },
    { label: t('appro.sel.net'), value: <span className="mono">{toM(selected.amount * 0.85)}</span>, severity: 'accent', sub: t('appro.sel.netSub') },
  ] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{t('appro.context', { n: list.length })}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('appro.title')}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" size="sm">{t('appro.delegations')}</Button>
          <Button variant="primary" size="sm">{t('appro.process')}</Button>
        </div>
      </div>

      {forMe > 0 && <Banner tone="info">{t('appro.forMe', { n: forMe })}</Banner>}

      <KpiRow
        items={[
          { label: t('appro.kpi.todo'), value: list.length, accent: list.length > 0 },
          { label: t('appro.kpi.situations'), value: situations.length, sub: `M13 · ${sumM(situations)}` },
          { label: t('appro.kpi.avenants'), value: avenants.length, sub: `M14 · ${sumM(avenants)}` },
          { label: t('appro.kpi.attributions'), value: attributions.length, sub: 'M8' },
          { label: t('appro.kpi.delay'), value: '1,8 j', sub: t('appro.kpi.delaySub') },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title={t('appro.queue')} meta={t('appro.queue.meta')} bodyPadded={false}>
            <DataTable
              template="60px 2fr 1.1fr 90px auto"
              columns={[
                { label: t('appro.col.module') },
                { label: t('appro.col.object') },
                { label: t('appro.col.approver') },
                { label: t('appro.col.amount'), align: 'right' },
                { label: t('appro.col.status') },
              ]}
              rows={rows}
              empty={<EmptyState title={t('appro.title')} description={t('appro.empty')} />}
            />
          </Panel>
          {selected && (
            <Panel title={t('appro.selected')} meta={selected.object} bodyPadded={false}>
              <FactList items={selectedFacts} />
            </Panel>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title={t('appro.routing')} meta="RG-M14-03" bodyPadded={false}>
            <FactList items={routingFacts} />
          </Panel>
          <Panel title={t('appro.rules')} bodyPadded={false}>
            <FactList items={ruleFacts} />
          </Panel>
        </div>
      </div>

      <div className="text-[12px] text-ink-3">{t('appro.subtitle')}</div>
    </div>
  );
}
