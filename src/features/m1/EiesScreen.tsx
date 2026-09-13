import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Leaf } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { milieuLabel, severityLabel, SEVERITY_TONE, eiesStatusLabel, EIES_STATUS_TONE } from './labels';
import { useData, useOperation, useEiesItems } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import {
  openHighCount, mitigatedRate, sortByPriority, canTransitionEies,
  MILIEUX, SEVERITIES, EIES_STATUSES, type EiesItem, type Milieu, type Severity, type EiesStatus,
} from '../../domain/eiesItem';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function EiesScreen({ id }: { id: string }) {
  const { eiesItems, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useEiesItems(id);

  const [rows, setRows] = useState<EiesItem[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ impact: string; milieu: Milieu; severity: Severity; mesure: string }>({
    impact: '', milieu: 'physique', severity: 'moyenne', mesure: '',
  });

  async function add() {
    if (!draft.impact.trim()) return;
    const input = { impact: draft.impact, milieu: draft.milieu, severity: draft.severity, mesureAttenuation: draft.mesure || null };
    const reset = () => { setDraft({ impact: '', milieu: 'physique', severity: 'moyenne', mesure: '' }); setAdding(false); };
    // Offline-first (F3) : impact relevé sur site (non écriture), créé « planifiée ».
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'eiesItems', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, impact: draft.impact, milieu: draft.milieu, severity: draft.severity, mesureAttenuation: draft.mesure || null, status: 'planifiee' }]);
      reset();
      toast.push(t('eies.added.offline'), 'info');
      return;
    }
    const rec = await eiesItems.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('eies.added'), 'success');
  }
  async function setStatus(iid: string, status: EiesStatus) {
    const rec = await eiesItems.setStatus(iid, status);
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
    toast.push(t('eies.status.changed'), 'success');
  }
  async function remove(iid: string) {
    await eiesItems.remove(iid);
    setRows((r) => r.filter((x) => x.id !== iid));
    toast.push(t('eies.removed'), 'info');
  }

  const sorted = sortByPriority(rows);

  const tableRows: TableRowData[] = sorted.map((i) => ({
    cells: [
      <span>
        <span className="block font-medium">{i.impact}</span>
        <span className="block text-[12px] text-ink-3">{milieuLabel(i.milieu)}{i.mesureAttenuation ? ` · ${i.mesureAttenuation}` : ` · ${t('eies.no_measure')}`}</span>
      </span>,
      <Badge tone={SEVERITY_TONE[i.severity]}>{severityLabel(i.severity)}</Badge>,
      <Badge tone={EIES_STATUS_TONE[i.status]}>{eiesStatusLabel(i.status)}</Badge>,
      <span className="flex flex-wrap justify-end gap-1">
        {canEdit && EIES_STATUSES.filter((st) => canTransitionEies(i.status, st)).map((st) => (
          <Button key={st} variant="glass" size="sm" onClick={() => setStatus(i.id, st)}>{eiesStatusLabel(st)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('eies.removed')} onClick={() => remove(i.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><Leaf size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('eies.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('eies.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('eies.kpi.total'), value: rows.length },
          { label: t('eies.kpi.highopen'), value: openHighCount(rows), accent: openHighCount(rows) > 0 },
          { label: t('eies.kpi.mitigated'), value: `${Math.round(mitigatedRate(rows) * 100)} %` },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="ei-impact" label={t('eies.field.impact')} value={draft.impact} onChange={(e) => setDraft((d) => ({ ...d, impact: e.target.value }))} />
            <Select id="ei-milieu" label={t('eies.field.milieu')} value={draft.milieu} onChange={(e) => setDraft((d) => ({ ...d, milieu: e.target.value as Milieu }))}>
              {MILIEUX.map((k) => <option key={k} value={k}>{milieuLabel(k)}</option>)}
            </Select>
            <Select id="ei-sev" label={t('eies.field.severity')} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as Severity }))}>
              {SEVERITIES.map((k) => <option key={k} value={k}>{severityLabel(k)}</option>)}
            </Select>
          </div>
          <div className="mt-3">
            <Textarea id="ei-mesure" label={t('eies.field.measure')} value={draft.mesure} onChange={(e) => setDraft((d) => ({ ...d, mesure: e.target.value }))} rows={2} />
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
        <Card><EmptyState title={t('eies.title')} description={t('eies.empty')} /></Card>
      ) : (
        <Panel title={t('eies.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr 1.2fr auto"
            columns={[
              { label: t('eies.col.impact') },
              { label: t('eies.col.severity') },
              { label: t('eies.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('eies.subtitle')}</div>
    </div>
  );
}
