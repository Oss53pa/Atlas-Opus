import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRight, FileCheck2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Money as MoneyView, Progress, Select, Skeleton, useToast } from '../../ui';
import {
  tenureLabel,
  acquisitionStatusLabel,
  ACQ_TONE,
  titleDocTypeLabel,
  titleStatusLabel,
  TITLE_STATUS_TONE,
} from './labels';
import { useData, useLandParcels, useTitles } from '../../app/providers';
import { t } from '../../i18n';
import {
  TENURE_TYPES,
  TITLE_DOC_TYPES,
  evaluateAcquisition,
  nextAcquisitionStatus,
  acquisitionProgress,
  type LandParcel,
  type LandParcelInput,
  type TenureType,
  type TitleDocument,
  type TitleDocType,
} from '../../domain/m2/foncier';

export function FoncierSection({ operationId, currency, canEdit }: { operationId: string; currency: string; canEdit: boolean }) {
  const { compliance } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useLandParcels(operationId);
  const [rows, setRows] = useState<LandParcel[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ reference: string; tenureType: TenureType; areaText: string; priceText: string; notary: string }>({
    reference: '', tenureType: 'titre_foncier', areaText: '', priceText: '', notary: '',
  });

  async function add() {
    if (!draft.reference.trim()) return;
    const input: LandParcelInput = {
      reference: draft.reference.trim(),
      tenureType: draft.tenureType,
      area: Number(draft.areaText.replace(/[^\d]/g, '')) || 0,
      price: Number(draft.priceText.replace(/[^\d]/g, '')) || 0,
      notary: draft.notary.trim() || null,
    };
    const rec = await compliance.addLandParcel(operationId, input);
    setRows((r) => [...r, rec]);
    setDraft({ reference: '', tenureType: 'titre_foncier', areaText: '', priceText: '', notary: '' });
    setAdding(false);
    toast.push(t('foncier.added'), 'success');
  }
  async function remove(pid: string) {
    await compliance.removeLandParcel(pid);
    setRows((r) => r.filter((p) => p.id !== pid));
    toast.push(t('foncier.removed'), 'info');
  }
  function onParcelChanged(next: LandParcel) {
    setRows((r) => r.map((p) => (p.id === next.id ? next : p)));
  }

  return (
    <Card tone="strong">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-medium">{t('foncier.title')}</h2>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />
            {t('foncier.add')}
          </Button>
        )}
      </div>

      {adding && canEdit && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field id="lp-ref" label={t('parcel.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} />
          <Select id="lp-tenure" label={t('parcel.field.tenure')} value={draft.tenureType} onChange={(e) => setDraft((d) => ({ ...d, tenureType: e.target.value as TenureType }))}>
            {TENURE_TYPES.map((ty) => <option key={ty} value={ty}>{tenureLabel(ty)}</option>)}
          </Select>
          <Field id="lp-notary" label={t('parcel.field.notary')} value={draft.notary} onChange={(e) => setDraft((d) => ({ ...d, notary: e.target.value }))} />
          <Field id="lp-area" label={t('parcel.field.area')} inputMode="numeric" value={draft.areaText} onChange={(e) => setDraft((d) => ({ ...d, areaText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
          <Field id="lp-price" label={t('parcel.field.price')} inputMode="numeric" value={draft.priceText} onChange={(e) => setDraft((d) => ({ ...d, priceText: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.add')}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 96 }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3"><EmptyState title={t('foncier.empty')} /></div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((p) => (
            <ParcelCard key={p.id} parcel={p} currency={currency} canEdit={canEdit} onChanged={onParcelChanged} onRemove={() => remove(p.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ParcelCard({
  parcel, currency, canEdit, onChanged, onRemove,
}: {
  parcel: LandParcel; currency: string; canEdit: boolean; onChanged: (p: LandParcel) => void; onRemove: () => void;
}) {
  const { compliance } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useTitles(parcel.id);
  const [titles, setTitles] = useState<TitleDocument[]>([]);
  useEffect(() => { if (loaded) setTitles(loaded); }, [loaded]);

  const [addingTitle, setAddingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState<{ docType: TitleDocType; reference: string }>({ docType: 'acte_notarie', reference: '' });

  const next = nextAcquisitionStatus(parcel.acquisitionStatus);

  async function advance() {
    if (!next) return;
    const decision = evaluateAcquisition(parcel.acquisitionStatus, next, parcel, {
      suspensiveConditions: parcel.suspensiveConditions,
      titles,
    });
    if (!decision.ok) {
      const msg = decision.code === 'conditions_pending' ? t('foncier.blocked.conditions')
        : decision.code === 'notarial_deed_required' ? t('foncier.blocked.deed')
        : t('foncier.blocked.conditions');
      toast.push(msg, 'danger');
      return;
    }
    const rec = await compliance.setAcquisitionStatus(parcel.id, decision.to);
    onChanged(rec);
  }

  async function addTitle() {
    if (!titleDraft.reference.trim()) return;
    const rec = await compliance.addTitle(parcel.id, { docType: titleDraft.docType, reference: titleDraft.reference.trim() });
    setTitles((ts) => [...ts, rec]);
    setTitleDraft({ docType: 'acte_notarie', reference: '' });
    setAddingTitle(false);
  }
  async function toggleVerify(td: TitleDocument) {
    const rec = await compliance.setTitleStatus(td.id, td.status === 'verified' ? 'pending' : 'verified');
    setTitles((ts) => ts.map((x) => (x.id === td.id ? rec : x)));
  }
  async function removeTitle(tid: string) {
    await compliance.removeTitle(tid);
    setTitles((ts) => ts.filter((x) => x.id !== tid));
  }

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--ax-glass-subtle)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium">{parcel.reference}</span>
            <Badge>{tenureLabel(parcel.tenureType)}</Badge>
            <Badge tone={ACQ_TONE[parcel.acquisitionStatus]}>{acquisitionStatusLabel(parcel.acquisitionStatus)}</Badge>
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {parcel.area} m² · <MoneyView amount={parcel.price} currency={currency} />{parcel.notary ? ` · ${parcel.notary}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit && next && (
            <Button variant="glass" size="sm" onClick={advance}>
              {t('foncier.advance')}
              <ArrowRight size={14} />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" icon aria-label={t('foncier.removed')} onClick={onRemove}><Trash2 size={15} /></Button>
          )}
        </div>
      </div>

      <div className="mt-2">
        <Progress value={acquisitionProgress(parcel.acquisitionStatus)} label={acquisitionStatusLabel(parcel.acquisitionStatus)} />
      </div>

      {parcel.suspensiveConditions.length > 0 && (
        <div className="mt-2 text-[12px] text-ink-2">
          <span className="text-ink-3">{t('foncier.conditions')} :</span> {parcel.suspensiveConditions.join(' · ')}
        </div>
      )}

      {/* Titres */}
      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--ax-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-2">{t('foncier.titles')}</span>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setAddingTitle((a) => !a)}>
              <Plus size={14} />
              {t('title.add')}
            </Button>
          )}
        </div>
        {addingTitle && canEdit && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select id={`td-type-${parcel.id}`} label={t('title.field.type')} value={titleDraft.docType} onChange={(e) => setTitleDraft((d) => ({ ...d, docType: e.target.value as TitleDocType }))}>
              {TITLE_DOC_TYPES.map((ty) => <option key={ty} value={ty}>{titleDocTypeLabel(ty)}</option>)}
            </Select>
            <Field id={`td-ref-${parcel.id}`} label={t('title.field.reference')} value={titleDraft.reference} onChange={(e) => setTitleDraft((d) => ({ ...d, reference: e.target.value }))} />
            <div className="flex items-end gap-2">
              <Button variant="primary" size="sm" onClick={addTitle}>{t('common.add')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingTitle(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        {loading ? (
          <Skeleton className="mt-2" style={{ height: 32 }} />
        ) : titles.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {titles.map((td) => (
              <li key={td.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <FileCheck2 size={13} className="text-ink-3" />
                <span className="text-ink-2">{titleDocTypeLabel(td.docType)} · {td.reference}</span>
                <Badge tone={TITLE_STATUS_TONE[td.status]}>{titleStatusLabel(td.status)}</Badge>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => toggleVerify(td)}>
                      {td.status === 'verified' ? t('title.action.unverify') : t('title.action.verify')}
                    </Button>
                    <Button variant="ghost" size="sm" icon aria-label={t('foncier.removed')} onClick={() => removeTitle(td.id)}><Trash2 size={13} /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
