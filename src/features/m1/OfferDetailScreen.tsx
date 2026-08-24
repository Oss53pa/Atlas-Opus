import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, KpiRow, Panel, FactList, Skeleton, type Fact } from '../../ui';
import { offerStatusLabel, OFFER_STATUS_TONE } from './labels';
import { useData, useOperation, useOffers, useTenders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import { rankOffers, financialScore, globalScore, meetsTechnicalThreshold, TECHNICAL_THRESHOLD, type OfferStatus } from '../../domain/m9';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function OfferDetailScreen({ id, oid }: { id: string; oid: string }) {
  const { offers, session } = useData();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: rows, loading, refetch } = useOffers(id);
  const { data: tenders } = useTenders(id);
  const o = rows?.find((x) => x.id === oid) ?? null;
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'tender.edit') && !readOnly;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!o) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'analyse', id })}>{t('common.back')}</Button>}>{t('offer.notFound')}</Banner>;

  const tid = o.tenderId;
  const siblings = (rows ?? []).filter((x) => x.tenderId === tid);
  const ranked = rankOffers(siblings);
  const mine = ranked.find((r) => r.offer.id === o.id);
  const minAmount = Math.min(...siblings.filter((s) => s.status !== 'ecarte' && s.amount > 0).map((s) => s.amount));
  const fin = financialScore(o.amount, minAmount);
  const glob = globalScore(o.scoreTechnical, fin);
  const tenderName = tenders?.find((td) => td.id === o.tenderId)?.object ?? o.tenderId;
  const admissible = meetsTechnicalThreshold(o.scoreTechnical);

  async function setStatus(status: OfferStatus) {
    await offers.setStatus(oid, status);
    refetch();
  }

  const facts: Fact[] = [
    { label: t('offer.field.tender'), value: tenderName },
    { label: t('offer.col.amount'), value: formatAmount(o.amount, locale) },
    { label: t('offer.detail.threshold'), value: `${TECHNICAL_THRESHOLD} / 100`, severity: admissible ? undefined : 'danger' },
    { label: t('offer.col.status'), value: offerStatusLabel(o.status) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'analyse', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={OFFER_STATUS_TONE[o.status]}>{offerStatusLabel(o.status)}</Badge>
            <span className="text-[13px] text-ink-3">{tenderName} · {op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{o.bidder}</h1>
        </div>
      </div>

      {!admissible && <Banner tone="danger" icon={<AlertTriangle size={16} />}>{t('offer.belowThreshold', { threshold: TECHNICAL_THRESHOLD })}</Banner>}

      <KpiRow
        items={[
          { label: t('offer.col.tech'), value: `${o.scoreTechnical} / 100` },
          { label: t('offer.detail.financial'), value: `${fin.toFixed(1)} / 100` },
          { label: t('offer.col.global'), value: `${glob.toFixed(1)} / 100`, accent: true },
          { label: t('offer.col.rank'), value: mine ? `#${mine.rank} / ${ranked.length}` : '—' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
        <Panel title={t('offer.detail.meta')} bodyPadded={false}><FactList items={facts} /></Panel>
        <Panel
          title={t('offer.detail.decision')}
          actions={canEdit && (o.status === 'recu'
            ? <><Button variant="glass" size="sm" onClick={() => setStatus('conforme')}>{t('offer.action.conforme')}</Button><Button variant="glass" size="sm" onClick={() => setStatus('ecarte')}>{t('offer.action.ecarte')}</Button></>
            : o.status === 'conforme'
              ? <><Button variant="glass" size="sm" onClick={() => setStatus('retenu')}>{t('offer.action.retenu')}</Button><Button variant="glass" size="sm" onClick={() => setStatus('ecarte')}>{t('offer.action.ecarte')}</Button></>
              : undefined)}
        >
          <p className="text-[13px] text-ink-2">{t('offer.detail.help')}</p>
        </Panel>
      </div>
    </div>
  );
}
