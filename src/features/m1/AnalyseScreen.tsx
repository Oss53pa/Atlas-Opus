import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { offerStatusLabel, OFFER_STATUS_TONE } from './labels';
import { useData, useOperation, useOffers, useTenders } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatAmount } from '../../lib/format';
import { rankOffers, type Offer, type OfferStatus } from '../../domain/m9';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function AnalyseScreen({ id }: { id: string }) {
  const { offers, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: tenders } = useTenders(id);
  const { data: loaded, loading } = useOffers(id);

  const [rows, setRows] = useState<Offer[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'tender.edit') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ tenderId: '', bidder: '', amount: '', tech: '' });

  const tenderName = (tid: string) => tenders?.find((td) => td.id === tid)?.object ?? tid;
  const withOffers = (tenders ?? []).filter((td) => rows.some((o) => o.tenderId === td.id));
  const conformes = rows.filter((o) => o.status === 'conforme' || o.status === 'retenu').length;
  const retenue = rows.find((o) => o.status === 'retenu');

  async function add() {
    if (!draft.tenderId || !draft.bidder.trim()) return;
    const rec = await offers.add(id, {
      tenderId: draft.tenderId, bidder: draft.bidder,
      amount: Number(draft.amount.replace(/[^\d]/g, '')) || 0,
      scoreTechnical: Math.min(100, Number(draft.tech.replace(/[^\d]/g, '')) || 0),
    });
    setRows((r) => [...r, rec]);
    setDraft({ tenderId: draft.tenderId, bidder: '', amount: '', tech: '' });
    setAdding(false);
    toast.push(t('offer.added'), 'success');
  }
  async function setStatus(oid: string, status: OfferStatus) {
    const rec = await offers.setStatus(oid, status);
    setRows((r) => r.map((x) => (x.id === oid ? rec : x)));
  }
  async function remove(oid: string) {
    await offers.remove(oid);
    setRows((r) => r.filter((x) => x.id !== oid));
    toast.push(t('offer.removed'), 'info');
  }

  function tenderTable(tenderId: string): TableRowData[] {
    const list = rows.filter((o) => o.tenderId === tenderId);
    const ranked = rankOffers(list);
    const rankById = new Map(ranked.map((r) => [r.offer.id, r]));
    // Admissibles classées d'abord (par rang), puis écartées.
    const ordered = [
      ...ranked.map((r) => r.offer),
      ...list.filter((o) => !rankById.has(o.id)),
    ];
    return ordered.map((o) => {
      const r = rankById.get(o.id);
      const actions: { s: OfferStatus; key: 'offer.action.conforme' | 'offer.action.ecarte' | 'offer.action.retenu' }[] = [];
      if (o.status === 'recu') { actions.push({ s: 'conforme', key: 'offer.action.conforme' }, { s: 'ecarte', key: 'offer.action.ecarte' }); }
      else if (o.status === 'conforme') { actions.push({ s: 'retenu', key: 'offer.action.retenu' }, { s: 'ecarte', key: 'offer.action.ecarte' }); }
      return {
        cells: [
          <span className="mono">{r ? r.rank : '—'}</span>,
          <span className="font-medium">{o.bidder}</span>,
          <span className="mono">{formatAmount(o.amount, locale)}</span>,
          <span className="mono">{o.scoreTechnical}</span>,
          <span className="mono">{r ? r.scoreGlobal.toFixed(1) : '—'}</span>,
          <Badge tone={OFFER_STATUS_TONE[o.status]}>{offerStatusLabel(o.status)}</Badge>,
          <span className="flex justify-end gap-1">
            {canEdit && actions.map((a) => (
              <Button key={a.s} variant="glass" size="sm" onClick={() => setStatus(o.id, a.s)}>{t(a.key)}</Button>
            ))}
            {canEdit && (
              <Button variant="ghost" size="sm" icon aria-label={t('offer.removed')} onClick={() => remove(o.id)}><Trash2 size={15} /></Button>
            )}
          </span>,
        ],
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('offer.title')}</h1>
          </div>
        </div>
        {canEdit && (tenders?.length ?? 0) > 0 && (
          <Button variant="primary" size="sm" onClick={() => { setAdding((a) => !a); setDraft((d) => ({ ...d, tenderId: d.tenderId || (tenders?.[0]?.id ?? '') })); }}>
            <Plus size={16} />{t('offer.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('offer.kpi.count'), value: rows.length },
          { label: t('offer.kpi.admissible'), value: conformes },
          { label: t('offer.kpi.best'), value: retenue ? retenue.bidder : '—', accent: !!retenue },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="of-tender" label={t('offer.field.tender')} value={draft.tenderId} onChange={(e) => setDraft((d) => ({ ...d, tenderId: e.target.value }))}>
              {(tenders ?? []).map((td) => <option key={td.id} value={td.id}>{td.object}</option>)}
            </Select>
            <Field id="of-bidder" label={t('offer.field.bidder')} value={draft.bidder} onChange={(e) => setDraft((d) => ({ ...d, bidder: e.target.value }))} />
            <Field id="of-amount" label={t('offer.field.amount')} inputMode="numeric" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Field id="of-tech" label={t('offer.field.tech')} inputMode="numeric" value={draft.tech} onChange={(e) => setDraft((d) => ({ ...d, tech: e.target.value.replace(/[^\d]/g, '') }))} placeholder="80" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : (tenders?.length ?? 0) === 0 ? (
        <Card><EmptyState title={t('offer.title')} description={t('offer.empty.tenders')} /></Card>
      ) : withOffers.length === 0 ? (
        <Card><EmptyState title={t('offer.title')} description={t('offer.empty')} /></Card>
      ) : (
        withOffers.map((td) => (
          <Panel key={td.id} title={tenderName(td.id)} bodyPadded={false}>
            <DataTable
              template="60px 1.4fr 1fr 100px 110px 1fr auto"
              columns={[
                { label: t('offer.col.rank') },
                { label: t('offer.col.bidder') },
                { label: t('offer.col.amount'), align: 'right' },
                { label: t('offer.col.tech'), align: 'right' },
                { label: t('offer.col.global'), align: 'right' },
                { label: t('offer.col.status') },
                { label: '' },
              ]}
              rows={tenderTable(td.id)}
            />
          </Panel>
        ))
      )}

      <div className="text-[12px] text-ink-3">{t('offer.subtitle')}</div>
    </div>
  );
}
