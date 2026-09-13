import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Trophy, SlidersHorizontal } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, type TableRowData } from '../../ui';
import { criterionTypeLabel } from './labels';
import { useData, useOperation, useOffers, useEvaluationCriteria, useOfferScores } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { isWeightBalanced } from '../../domain/evaluationCriterion';
import { rankOffers, weightedFor, scoreOf, type OfferScore } from '../../domain/offerScore';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const fmt1 = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

export function NotationScreen({ id }: { id: string }) {
  const { offerScores, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: offers, loading: lo } = useOffers(id);
  const { data: criteria, loading: lc } = useEvaluationCriteria(id);
  const { data: loadedScores, loading: ls, refetch } = useOfferScores(id);

  const [scores, setScores] = useState<OfferScore[]>([]);
  useEffect(() => { if (loadedScores) setScores(loadedScores); }, [loadedScores]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const offerList = useMemo(() => offers ?? [], [offers]);
  const critList = useMemo(() => criteria ?? [], [criteria]);
  const balanced = isWeightBalanced(critList);

  const [selected, setSelected] = useState<string>('');
  useEffect(() => { if (!selected && offerList.length) setSelected(offerList[0].id); }, [offerList, selected]);

  const ranking = useMemo(() => rankOffers(offerList, scores), [offerList, scores]);

  async function setRaw(offerId: string, criteriaId: string, weight: number, raw: number) {
    const rawScore = Math.max(0, Math.min(100, raw));
    const weightedScore = weightedFor(rawScore, weight);
    const input = { offerId, criteriaId, rawScore, weightedScore };
    // Mise à jour optimiste locale (upsert).
    setScores((rows) => {
      const i = rows.findIndex((s) => s.offerId === offerId && s.criteriaId === criteriaId);
      if (i >= 0) { const cp = [...rows]; cp[i] = { ...cp[i], rawScore, weightedScore }; return cp; }
      return [...rows, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input }];
    });
    // Offline-first (F3) : notation d'atelier (non écriture) ; upsert idempotent.
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'offerScores', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      return;
    }
    await offerScores.setScore(id, input);
  }

  const loading = lo || lc || ls;
  const bidderOf = (oid: string) => offerList.find((o) => o.id === oid)?.bidder ?? oid;

  const rankRows: TableRowData[] = ranking.map((r) => ({
    cells: [
      <span className="flex items-center gap-2">
        {r.rank === 1 && r.total > 0 ? <Badge tone="success">1er</Badge> : <span className="mono text-ink-3">{r.rank}</span>}
        <span className="font-medium">{r.offer.bidder}</span>
      </span>,
      <span className="mono text-[13px]">{fmt1(r.total)}<span className="text-ink-3"> / 100</span></span>,
      <span className="mono text-[12px] text-ink-3">{r.scored}/{critList.length}</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Trophy size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('nota.title')}</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'criteres', id })}><SlidersHorizontal size={15} />{t('nota.editgrid')}</Button>
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}
      {!balanced && critList.length > 0 && <Banner tone="warning">{t('nota.unbalanced')}</Banner>}
      {critList.length === 0 && <Banner tone="info">{t('nota.nogrid')}</Banner>}

      <KpiRow
        items={[
          { label: t('nota.kpi.offers'), value: offerList.length },
          { label: t('nota.kpi.criteria'), value: critList.length },
          { label: t('nota.kpi.leader'), value: ranking[0] && ranking[0].total > 0 ? ranking[0].offer.bidder : '—' },
        ]}
      />

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : offerList.length === 0 ? (
        <Card><EmptyState title={t('nota.title')} description={t('nota.empty')} /></Card>
      ) : (
        <>
          <Panel title={t('nota.ranking')} bodyPadded={false}>
            <DataTable
              template="2fr 1.2fr 1fr"
              columns={[{ label: t('nota.col.bidder') }, { label: t('nota.col.total') }, { label: t('nota.col.scored') }]}
              rows={rankRows}
            />
          </Panel>

          {critList.length > 0 && (
            <Panel title={t('nota.scoring')}>
              <div className="mb-3 max-w-xs">
                <Select id="nota-offer" label={t('nota.select_offer')} value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {offerList.map((o) => <option key={o.id} value={o.id}>{o.bidder}</option>)}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                {critList.map((c) => {
                  const cur = scoreOf(scores, selected, c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--ax-border)' }}>
                      <span className="text-[13px]">
                        <span className="font-medium">{c.label}</span>
                        <span className="ml-2 text-[12px] text-ink-3">{criterionTypeLabel(c.type)} · {formatPercent(c.weight, locale)}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <Field
                            id={`nota-${c.id}`} label="" type="number" inputMode="numeric"
                            value={cur ? String(cur.rawScore) : ''} placeholder="0–100" disabled={!canEdit}
                            onChange={(e) => setRaw(selected, c.id, c.weight, Number(e.target.value) || 0)}
                          />
                        </div>
                        <span className="mono w-16 text-right text-[12px] text-ink-3">{cur ? fmt1(cur.weightedScore) : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end text-[13px]">
                <span className="text-ink-3">{t('nota.total_for', { b: bidderOf(selected) })} </span>
                <span className="mono ml-2 font-medium">{fmt1(ranking.find((r) => r.offer.id === selected)?.total ?? 0)} / 100</span>
              </div>
            </Panel>
          )}
        </>
      )}

      <div className="text-[12px] text-ink-3">{t('nota.subtitle')}</div>
    </div>
  );
}
