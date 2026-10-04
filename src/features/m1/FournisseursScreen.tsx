import { useEffect, useState } from 'react';
import { Plus, Trash2, Factory } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { supplierCategoryLabel, supplierStatusLabel, SUPPLIER_STATUS_TONE } from './labels';
import { useData, useSuppliers } from '../../app/providers';
import { t, type MessageKey } from '../../i18n';
import {
  canTransitionSupplier, SUPPLIER_CATEGORIES, SUPPLIER_STATUSES,
  type Supplier, type SupplierCategory, type SupplierStatus,
} from '../../domain/supplier';
import { can } from '../../domain/m1/permissions';

/**
 * M9 — Référentiel fournisseurs (transposé d'Advancity). Rattaché à l'espace,
 * pas à une opération : on référence une fois, on réutilise partout. La note de
 * conformité se lit dans les achats de chaque opération, là où les réceptions
 * sont enregistrées.
 */
export function FournisseursScreen() {
  const { suppliers, session } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useSuppliers();

  const [rows, setRows] = useState<Supplier[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const canEdit = can(session.role, 'tender.edit');
  const emptyDraft = { name: '', category: 'fournitures' as SupplierCategory, contact: '', email: '', taxId: '' };
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  async function add() {
    if (!draft.name.trim()) return;
    const rec = await suppliers.add({
      name: draft.name, category: draft.category, contact: draft.contact || null,
      email: draft.email || null, taxId: draft.taxId || null,
    });
    setRows((r) => [...r, rec].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setDraft(emptyDraft);
    setAdding(false);
    toast.push(t('supplier.added'), 'success');
  }
  async function setStatus(s: Supplier, status: SupplierStatus) {
    const rec = await suppliers.update(s.id, { status });
    setRows((r) => r.map((x) => (x.id === s.id ? rec : x)));
    toast.push(t('supplier.status.changed'), 'success');
  }
  async function remove(s: Supplier) {
    try {
      await suppliers.remove(s.id);
      setRows((r) => r.filter((x) => x.id !== s.id));
      toast.push(t('supplier.removed'), 'info');
    } catch {
      // Un fournisseur déjà commandé se retire du jeu par « écarté », pas par suppression.
      toast.push(t('supplier.inUse'), 'danger');
    }
  }

  const tableRows: TableRowData[] = rows.map((s) => ({
    cells: [
      <span>
        <span className="block font-medium">{s.name}</span>
        <span className="block text-[12px] text-ink-3">
          {s.contact ?? '—'}{s.email ? ` · ${s.email}` : ''}{s.taxId ? ` · ${s.taxId}` : ''}
        </span>
      </span>,
      <span className="text-ink-2">{supplierCategoryLabel(s.category)}</span>,
      <Badge tone={SUPPLIER_STATUS_TONE[s.status]}>{supplierStatusLabel(s.status)}</Badge>,
      <span className="flex flex-wrap justify-end gap-1">
        {canEdit && SUPPLIER_STATUSES.filter((st) => canTransitionSupplier(s.status, st)).map((st) => (
          <Button key={st} variant="glass" size="sm" onClick={() => setStatus(s, st)}>{supplierStatusLabel(st)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('supplier.removed')} onClick={() => remove(s)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] text-ink-3"><Factory size={12} className="mb-0.5 inline" /> {t('supplier.kicker')}</div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('supplier.title')}</h1>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('supplier.add')}</Button>}
      </div>

      {!canEdit && <Banner tone="info">{t('supplier.readonly')}</Banner>}

      <KpiRow
        items={SUPPLIER_STATUSES.map((st) => ({
          label: t(`supplier.status.${st}` as MessageKey),
          value: rows.filter((s) => s.status === st).length,
        })).concat([{ label: t('supplier.kpi.total'), value: rows.length }])}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="sup-name" label={t('supplier.field.name')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Select id="sup-cat" label={t('supplier.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as SupplierCategory }))}>
              {SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c}>{supplierCategoryLabel(c)}</option>)}
            </Select>
            <Field id="sup-tax" label={t('supplier.field.taxId')} value={draft.taxId} onChange={(e) => setDraft((d) => ({ ...d, taxId: e.target.value }))} />
            <Field id="sup-contact" label={t('supplier.field.contact')} value={draft.contact} onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))} />
            <Field id="sup-email" type="email" label={t('supplier.field.email')} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
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
        <Card><EmptyState title={t('supplier.title')} description={t('supplier.empty')} /></Card>
      ) : (
        <Panel title={t('supplier.referentiel')} meta="M9" bodyPadded={false}>
          <DataTable
            template="2.4fr 1fr 1fr auto"
            columns={[
              { label: t('supplier.col.supplier') },
              { label: t('supplier.col.category') },
              { label: t('supplier.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('supplier.subtitle')}</div>
    </div>
  );
}
