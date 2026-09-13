import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Scale, X } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { structureTypeLabel, legalEntityStatusLabel, LEGAL_STATUS_TONE } from './labels';
import { useData, useOperation, useLegalEntities } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import {
  totalShares, isCapitalBalanced, majorityHolder, registeredCount, activeCount,
  canTransitionLegalEntity, STRUCTURE_TYPES, LEGAL_ENTITY_STATUSES,
  type LegalEntity, type StructureType, type Shareholder,
} from '../../domain/legalEntity';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} %`;

export function MontageScreen({ id }: { id: string }) {
  const { legalEntities, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useLegalEntities(id);

  const [rows, setRows] = useState<LegalEntity[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [structureType, setStructureType] = useState<StructureType>('sci');
  const [rccm, setRccm] = useState('');
  const [holders, setHolders] = useState<Shareholder[]>([]);

  function reset() {
    setName(''); setStructureType('sci'); setRccm(''); setHolders([]); setAdding(false);
  }

  async function add() {
    if (!name.trim()) return;
    const input = { structureType, name, rccm: rccm || null, shareholders: holders };
    // Offline-first (F3) : montage saisi hors-ligne (non écriture), créé « projet ».
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'legalEntities', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, structureType, name, rccm: rccm || null, shareholders: holders, status: 'projet' }]);
      reset();
      toast.push(t('legal.added.offline'), 'info');
      return;
    }
    const rec = await legalEntities.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('legal.added'), 'success');
  }
  async function setStatus(eid: string, status: LegalEntity['status']) {
    const rec = await legalEntities.setStatus(eid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('legal.status.changed'), 'success');
  }
  async function remove(eid: string) {
    await legalEntities.remove(eid);
    setRows((r) => r.filter((x) => x.id !== eid));
    toast.push(t('legal.removed'), 'info');
  }

  const draftTotal = totalShares(holders);
  const draftBalanced = isCapitalBalanced(holders);

  const tableRows: TableRowData[] = rows.map((e) => {
    const maj = majorityHolder(e.shareholders);
    const balanced = isCapitalBalanced(e.shareholders);
    return {
      cells: [
        <span>
          <span className="block font-medium">{e.name}</span>
          <span className="block text-[12px] text-ink-3">{structureTypeLabel(e.structureType)}{e.rccm ? ` · RCCM ${e.rccm}` : ` · ${t('legal.no_rccm')}`}</span>
        </span>,
        <span className="text-[13px]">
          {maj ? <span>{maj.name} <span className="mono text-ink-3">{pct(maj.sharePct)}</span></span> : <span className="text-ink-3">—</span>}
          {e.shareholders.length > 0 && !balanced && <span className="ml-2 text-[11px] text-warning">{t('legal.capital.unbalanced', { n: pct(totalShares(e.shareholders)) })}</span>}
        </span>,
        <Badge tone={LEGAL_STATUS_TONE[e.status]}>{legalEntityStatusLabel(e.status)}</Badge>,
        <span className="flex flex-wrap justify-end gap-1">
          {canEdit && LEGAL_ENTITY_STATUSES.filter((s) => canTransitionLegalEntity(e.status, s)).map((s) => (
            <Button key={s} variant="glass" size="sm" onClick={() => setStatus(e.id, s)}>{legalEntityStatusLabel(s)}</Button>
          ))}
          {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('legal.removed')} onClick={() => remove(e.id)}><Trash2 size={15} /></Button>}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Scale size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('legal.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('legal.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('legal.kpi.count'), value: rows.length },
          { label: t('legal.kpi.registered'), value: registeredCount(rows) },
          { label: t('legal.kpi.active'), value: activeCount(rows) },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="le-name" label={t('legal.field.name')} value={name} onChange={(e) => setName(e.target.value)} />
            <Select id="le-type" label={t('legal.field.type')} value={structureType} onChange={(e) => setStructureType(e.target.value as StructureType)}>
              {STRUCTURE_TYPES.map((k) => <option key={k} value={k}>{structureTypeLabel(k)}</option>)}
            </Select>
            <Field id="le-rccm" label={t('legal.field.rccm')} value={rccm} onChange={(e) => setRccm(e.target.value)} placeholder={t('legal.field.rccm.placeholder')} />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium">{t('legal.capital.title')}</span>
              <span className={`mono text-[12px] ${draftBalanced ? 'text-success' : 'text-warning'}`}>{pct(draftTotal)}{draftBalanced ? '' : ` / 100 %`}</span>
            </div>
            <div className="flex flex-col gap-2">
              {holders.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Field id={`sh-name-${i}`} label="" value={h.name} placeholder={t('legal.capital.holder')}
                    onChange={(e) => setHolders((hs) => hs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <div className="w-24">
                    <Field id={`sh-pct-${i}`} label="" type="number" value={String(h.sharePct)} placeholder="%"
                      onChange={(e) => setHolders((hs) => hs.map((x, j) => (j === i ? { ...x, sharePct: Number(e.target.value) || 0 } : x)))} />
                  </div>
                  <Button variant="ghost" size="sm" icon aria-label={t('common.cancel')} onClick={() => setHolders((hs) => hs.filter((_, j) => j !== i))}><X size={15} /></Button>
                </div>
              ))}
              <Button variant="glass" size="sm" onClick={() => setHolders((hs) => [...hs, { name: '', sharePct: 0 }])}><Plus size={14} />{t('legal.capital.add')}</Button>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('legal.title')} description={t('legal.empty')} /></Card>
      ) : (
        <Panel title={t('legal.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1.6fr 1fr auto"
            columns={[
              { label: t('legal.col.entity') },
              { label: t('legal.col.majority') },
              { label: t('legal.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('legal.subtitle')}</div>
    </div>
  );
}
