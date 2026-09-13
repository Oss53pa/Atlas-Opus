import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Boxes } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { assetTypeLabel } from './labels';
import { useData, useOperation, useHandoverAssets } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  isUnderWarranty, underWarrantyCount, expiringWarranty, unassignedCount,
  ASSET_TYPES, type HandoverAsset, type AssetType,
} from '../../domain/handoverAssets';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function PatrimoineScreen({ id }: { id: string }) {
  const { handoverAssets, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useHandoverAssets(id);

  const [rows, setRows] = useState<HandoverAsset[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ label: string; assetType: AssetType; location: string; warrantyEnd: string; targetSystem: string }>({
    label: '', assetType: 'equipement', location: '', warrantyEnd: '', targetSystem: '',
  });

  async function add() {
    if (!draft.label.trim()) return;
    const input = {
      label: draft.label, assetType: draft.assetType, location: draft.location || null,
      warrantyEnd: draft.warrantyEnd || null, targetSystem: draft.targetSystem || null,
    };
    const reset = () => { setDraft({ label: '', assetType: 'equipement', location: '', warrantyEnd: '', targetSystem: '' }); setAdding(false); };
    // Offline-first (F3) : inventaire relevé sur site (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'handoverAssets', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input }]);
      reset();
      toast.push(t('asset.added.offline'), 'info');
      return;
    }
    const rec = await handoverAssets.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('asset.added'), 'success');
  }
  async function remove(aid: string) {
    await handoverAssets.remove(aid);
    setRows((r) => r.filter((x) => x.id !== aid));
    toast.push(t('asset.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((a) => ({
    cells: [
      <span>
        <span className="block font-medium">{a.label}</span>
        <span className="block text-[12px] text-ink-3">{assetTypeLabel(a.assetType)}{a.location ? ` · ${a.location}` : ''}</span>
      </span>,
      <span className="flex items-center gap-2">
        <span className="mono text-[12px] text-ink-3">{a.warrantyEnd ? formatDate(a.warrantyEnd, locale) : '—'}</span>
        {a.warrantyEnd && <Badge tone={isUnderWarranty(a, now) ? 'success' : 'neutral'}>{t(isUnderWarranty(a, now) ? 'asset.warranty.on' : 'asset.warranty.off')}</Badge>}
      </span>,
      <span className="text-[13px]">{a.targetSystem ?? <span className="text-warning">{t('asset.unassigned')}</span>}</span>,
      <span className="flex justify-end">
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('asset.removed')} onClick={() => remove(a.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Boxes size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('asset.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('asset.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('asset.kpi.total'), value: rows.length },
          { label: t('asset.kpi.warranty'), value: underWarrantyCount(rows, now) },
          { label: t('asset.kpi.expiring'), value: expiringWarranty(rows, now), accent: expiringWarranty(rows, now) > 0 },
          { label: t('asset.kpi.unassigned'), value: unassignedCount(rows), accent: unassignedCount(rows) > 0 },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="as-label" label={t('asset.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <Select id="as-type" label={t('asset.field.type')} value={draft.assetType} onChange={(e) => setDraft((d) => ({ ...d, assetType: e.target.value as AssetType }))}>
              {ASSET_TYPES.map((k) => <option key={k} value={k}>{assetTypeLabel(k)}</option>)}
            </Select>
            <Field id="as-loc" label={t('asset.field.location')} value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
            <Field id="as-war" label={t('asset.field.warranty')} type="date" value={draft.warrantyEnd} onChange={(e) => setDraft((d) => ({ ...d, warrantyEnd: e.target.value }))} />
            <Field id="as-sys" label={t('asset.field.target')} value={draft.targetSystem} onChange={(e) => setDraft((d) => ({ ...d, targetSystem: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('asset.title')} description={t('asset.empty')} /></Card>
      ) : (
        <Panel title={t('asset.register')} bodyPadded={false}>
          <DataTable
            template="1.8fr 1.2fr 1.2fr auto"
            columns={[
              { label: t('asset.col.asset') },
              { label: t('asset.col.warranty') },
              { label: t('asset.col.target') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('asset.subtitle')}</div>
    </div>
  );
}
