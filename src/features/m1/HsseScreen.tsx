import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { hsseKindLabel, hsseStatusLabel, hsseSeverityLabel, HSSE_STATUS_TONE, HSSE_SEVERITY_TONE } from './labels';
import { useData, useOperation, useHsseIncidents, useHsseInspections } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  openCount, criticalOpenCount, daysSinceLastAccident, canTransitionHsse, sortByPriority,
  tauxFrequence, tauxGravite, heuresTravaillees, complianceRate, isCompliant, type HsseInspection,
  HSSE_KINDS, HSSE_SEVERITIES, HSSE_STATUSES, type HsseIncident, type HsseKind, type HsseSeverity, type HsseStatus,
} from '../../domain/hsse';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function HsseScreen({ id }: { id: string }) {
  const { hsse, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useHsseIncidents(id);

  const [rows, setRows] = useState<HsseIncident[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);
  const { data: loadedInsp, refetch: refetchInsp } = useHsseInspections(id);
  const [inspections, setInspections] = useState<HsseInspection[]>([]);
  useEffect(() => { if (loadedInsp) setInspections(loadedInsp); }, [loadedInsp]);
  useEffect(() => { if (syncedAt) refetchInsp(); }, [syncedAt, refetchInsp]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  // Déclaration HSSE : ouverte au terrain (site) et à l'encadrement.
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ reference: string; kind: HsseKind; severity: HsseSeverity; occurredAt: string; location: string; description: string; daysLost: string }>({
    reference: '', kind: 'presqu_accident', severity: 'mineure', occurredAt: now, description: '', location: '', daysLost: '',
  });

  async function add() {
    if (!draft.reference.trim() || !draft.description.trim()) return;
    const input = {
      reference: draft.reference, kind: draft.kind, severity: draft.severity,
      occurredAt: draft.occurredAt || now, location: draft.location || null, description: draft.description, correctiveAction: null,
      daysLost: Number(draft.daysLost) || 0,
    };
    const reset = () => { setDraft({ reference: '', kind: 'presqu_accident', severity: 'mineure', occurredAt: now, description: '', location: '', daysLost: '' }); setAdding(false); };
    // Offline-first (F3) : un incident HSSE est un fait terrain (non écriture),
    // créé « déclaré ». Capture admise hors-ligne, rejouée telle quelle.
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'hsseIncidents', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, status: 'declare' }]);
      reset();
      toast.push(t('hsse.added.offline'), 'info');
      return;
    }
    const rec = await hsse.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('hsse.added'), 'success');
  }
  const [addingInsp, setAddingInsp] = useState(false);
  const emptyInsp = { date: now, title: '', score: '', hoursWorked: '', observations: '' };
  const [inspDraft, setInspDraft] = useState(emptyInsp);

  async function addInspection() {
    if (!inspDraft.title.trim() || inspDraft.score === '') return;
    const input = {
      date: inspDraft.date || now, title: inspDraft.title, score: Number(inspDraft.score),
      hoursWorked: Number(inspDraft.hoursWorked) || 0, observations: inspDraft.observations || null,
    };
    const reset = () => { setInspDraft(emptyInsp); setAddingInsp(false); };
    // Offline-first (F3) : la visite est un relevé terrain (non écriture), rejouable.
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'hsseInspections', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setInspections((r) => [{ id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input }, ...r]);
      reset();
      toast.push(t('hsse.inspection.added.offline'), 'info');
      return;
    }
    const rec = await hsse.addInspection(id, input);
    setInspections((r) => [rec, ...r]);
    reset();
    toast.push(t('hsse.inspection.added'), 'success');
  }
  async function removeInspection(iid: string) {
    await hsse.removeInspection(iid);
    setInspections((r) => r.filter((x) => x.id !== iid));
    toast.push(t('hsse.inspection.removed'), 'info');
  }

  async function setStatus(iid: string, status: HsseStatus) {
    const rec = await hsse.setStatus(iid, status);
    setRows((r) => r.map((x) => (x.id === iid ? rec : x)));
  }
  async function remove(iid: string) {
    await hsse.remove(iid);
    setRows((r) => r.filter((x) => x.id !== iid));
    toast.push(t('hsse.removed'), 'info');
  }

  const days = daysSinceLastAccident(rows, now);
  const hours = heuresTravaillees(inspections);
  const tf = tauxFrequence(rows, hours);
  const tg = tauxGravite(rows, hours);
  const conformite = complianceRate(inspections);
  const tableRows: TableRowData[] = sortByPriority(rows).map((i) => ({
    cells: [
      <span>
        <span className="block font-medium">{i.reference}</span>
        <span className="block text-[12px] text-ink-3">{hsseKindLabel(i.kind)}{i.location ? ` · ${i.location}` : ''}</span>
      </span>,
      <Badge tone={HSSE_SEVERITY_TONE[i.severity]}>{hsseSeverityLabel(i.severity)}</Badge>,
      <span className="mono text-[12px] text-ink-3">{formatDate(i.occurredAt, locale)}</span>,
      <span className="text-[13px] text-ink-2">{i.description}</span>,
      <Badge tone={HSSE_STATUS_TONE[i.status]}>{hsseStatusLabel(i.status)}</Badge>,
      <span className="flex justify-end gap-1">
        {canEdit && HSSE_STATUSES.filter((s) => canTransitionHsse(i.status, s)).map((s) => (
          <Button key={s} variant="glass" size="sm" onClick={() => setStatus(i.id, s)}>{hsseStatusLabel(s)}</Button>
        ))}
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('hsse.removed')} onClick={() => remove(i.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3"><ShieldAlert size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('hsse.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('hsse.declare')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('hsse.kpi.open'), value: openCount(rows) },
          { label: t('hsse.kpi.critical'), value: criticalOpenCount(rows), accent: criticalOpenCount(rows) > 0 },
          { label: t('hsse.kpi.days'), value: days === null ? '—' : days, sub: t('hsse.kpi.daysSub') },
        ]}
      />
      <KpiRow
        items={[
          { label: t('hsse.kpi.tf'), value: tf === null ? '—' : tf.toLocaleString(locale, { maximumFractionDigits: 1 }), sub: t('hsse.kpi.tfSub') },
          { label: t('hsse.kpi.tg'), value: tg === null ? '—' : tg.toLocaleString(locale, { maximumFractionDigits: 2 }), sub: t('hsse.kpi.tgSub') },
          { label: t('hsse.kpi.hours'), value: hours.toLocaleString(locale) },
          { label: t('hsse.kpi.compliance'), value: conformite === null ? '—' : `${Math.round(conformite * 100)} %`, accent: conformite !== null && conformite < 1 },
        ]}
      />
      {hours === 0 && <Banner tone="info">{t('hsse.hours.missing')}</Banner>}

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="hs-ref" label={t('hsse.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} placeholder="HSSE-2026-005" />
            <Field id="hs-date" label={t('hsse.field.occurredAt')} type="date" value={draft.occurredAt} onChange={(e) => setDraft((d) => ({ ...d, occurredAt: e.target.value }))} />
            <Select id="hs-kind" label={t('hsse.field.kind')} value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as HsseKind }))}>
              {HSSE_KINDS.map((k) => <option key={k} value={k}>{hsseKindLabel(k)}</option>)}
            </Select>
            <Select id="hs-sev" label={t('hsse.field.severity')} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as HsseSeverity }))}>
              {HSSE_SEVERITIES.map((s) => <option key={s} value={s}>{hsseSeverityLabel(s)}</option>)}
            </Select>
            <Field id="hs-loc" label={t('hsse.field.location')} value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
            <Field id="hs-days" label={t('hsse.field.daysLost')} inputMode="numeric" value={draft.daysLost} onChange={(e) => setDraft((d) => ({ ...d, daysLost: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" />
            <Textarea id="hs-desc" label={t('hsse.field.description')} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('hsse.declare')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('hsse.title')} description={t('hsse.empty')} /></Card>
      ) : (
        <Panel title={t('hsse.register')} bodyPadded={false}>
          <DataTable
            template="1.4fr 0.9fr 1fr 1.6fr 1fr auto"
            columns={[
              { label: t('hsse.col.ref') },
              { label: t('hsse.col.severity') },
              { label: t('hsse.col.date') },
              { label: t('hsse.col.description') },
              { label: t('hsse.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <Panel
        title={t('hsse.inspections.title')}
        meta="M19"
        actions={canEdit ? <Button variant="glass" size="sm" onClick={() => setAddingInsp((a) => !a)}><Plus size={14} />{t('hsse.inspection.add')}</Button> : undefined}
        bodyPadded={false}
      >
        {addingInsp && canEdit && (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <Field id="hi-date" label={t('hsse.inspection.field.date')} type="date" value={inspDraft.date} onChange={(e) => setInspDraft((d) => ({ ...d, date: e.target.value }))} />
            <Field id="hi-title" label={t('hsse.inspection.field.title')} value={inspDraft.title} onChange={(e) => setInspDraft((d) => ({ ...d, title: e.target.value }))} />
            <Field id="hi-score" label={t('hsse.inspection.field.score')} inputMode="numeric" value={inspDraft.score} onChange={(e) => setInspDraft((d) => ({ ...d, score: e.target.value.replace(/[^\d]/g, '') }))} placeholder="85" />
            <Field id="hi-hours" label={t('hsse.inspection.field.hours')} inputMode="numeric" value={inspDraft.hoursWorked} onChange={(e) => setInspDraft((d) => ({ ...d, hoursWorked: e.target.value.replace(/[^\d]/g, '') }))} placeholder="90000" />
            <Textarea id="hi-obs" label={t('hsse.inspection.field.observations')} value={inspDraft.observations} onChange={(e) => setInspDraft((d) => ({ ...d, observations: e.target.value }))} />
            <div className="flex items-end justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingInsp(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={addInspection}>{t('common.add')}</Button>
            </div>
          </div>
        )}
        {inspections.length === 0 ? (
          <div className="p-4 text-[13px] text-ink-3">{t('hsse.inspections.empty')}</div>
        ) : (
          <DataTable
            template="1fr 2fr 0.8fr 1fr auto"
            columns={[
              { label: t('hsse.col.date') },
              { label: t('hsse.inspection.field.title') },
              { label: t('hsse.inspection.col.score'), align: 'right' },
              { label: t('hsse.inspection.col.hours'), align: 'right' },
              { label: '' },
            ]}
            rows={inspections.map((v) => ({
              cells: [
                <span className="mono text-[12px] text-ink-3">{formatDate(v.date, locale)}</span>,
                <span>
                  <span className="block font-medium">{v.title}</span>
                  {v.observations && <span className="block text-[12px] text-ink-3">{v.observations}</span>}
                </span>,
                <Badge tone={isCompliant(v.score) ? 'success' : 'warning'}>{v.score}/100</Badge>,
                <span className="mono text-[12px]">{v.hoursWorked.toLocaleString(locale)}</span>,
                <span className="flex justify-end">
                  {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('hsse.inspection.removed')} onClick={() => removeInspection(v.id)}><Trash2 size={15} /></Button>}
                </span>,
              ],
            }))}
          />
        )}
      </Panel>

      <div className="text-[12px] text-ink-3">{t('hsse.subtitle')}</div>
    </div>
  );
}
