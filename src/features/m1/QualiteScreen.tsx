import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, BadgeCheck, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, Textarea, useToast, type TableRowData } from '../../ui';
import { ncSourceLabel, ncSeverityLabel, ncStatusLabel, NC_SEVERITY_TONE, NC_STATUS_TONE } from './labels';
import { useData, useNonConformities, useOperation } from '../../app/providers';
import { useOffline } from '../../app/offline';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import {
  bySeverity, criticalOpenCount, evaluateNcTransition, isOverdue, openCount, overdueCount,
  receptionBlockedByNc, sortByPriority, traitementRate,
  NC_SEVERITIES, NC_SOURCES, NC_STATUSES,
  type NcSeverity, type NcSource, type NcStatus, type NonConformity,
} from '../../domain/nonConformity';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * M18 (volet qualité) — Registre des non-conformités. Transposé d'Advancity.
 * Une NC est un écart au référentiel : distincte de la réserve de réception et
 * de l'incident HSSE. Le solde exige une action corrective (RG-NC-02) et une NC
 * critique ouverte bloque le prononcé de la réception (RG-NC-01).
 */
export function QualiteScreen({ id }: { id: string }) {
  const { nonConformities, session } = useData();
  const { online, capture, syncedAt } = useOffline();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading, refetch } = useNonConformities(id);

  const [rows, setRows] = useState<NonConformity[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);
  useEffect(() => { if (syncedAt) refetch(); }, [syncedAt, refetch]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  // Constat qualité : ouvert au terrain (site) comme à l'encadrement.
  const canEdit = can(session.role, 'op.update') && !readOnly;
  const now = today();

  const emptyDraft = {
    reference: '', label: '', source: 'chantier' as NcSource, severity: 'majeure' as NcSeverity,
    location: '', owner: '', detectedAt: now, dueDate: '',
  };
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  /** Saisie de l'action corrective, par NC (exigée pour solder). */
  const [actions, setActions] = useState<Record<string, string>>({});

  async function add() {
    if (!draft.reference.trim() || !draft.label.trim()) return;
    const input = {
      reference: draft.reference, label: draft.label, source: draft.source, severity: draft.severity,
      location: draft.location || null, owner: draft.owner || null,
      detectedAt: draft.detectedAt || now, dueDate: draft.dueDate || null,
    };
    const reset = () => { setDraft(emptyDraft); setAdding(false); };
    // Offline-first (F3) : un constat qualité est un fait terrain (non écriture).
    if (!online) {
      capture({
        id: crypto.randomUUID(), entity: 'nonConformities', op: 'create', entityId: null,
        payload: { operationId: id, ...input }, baseVersion: null,
        createdAt: new Date().toISOString(), financial: false,
      });
      setRows((r) => [...r, { id: `local-${crypto.randomUUID()}`, tenantId: session.tenantId, operationId: id, ...input, correctiveAction: null, closedAt: null, status: 'ouverte' }]);
      reset();
      toast.push(t('nc.added.offline'), 'info');
      return;
    }
    const rec = await nonConformities.add(id, input);
    setRows((r) => [...r, rec]);
    reset();
    toast.push(t('nc.added'), 'success');
  }

  async function setStatus(nc: NonConformity, status: NcStatus) {
    const corrective = actions[nc.id]?.trim() || nc.correctiveAction;
    // RG-NC-02 vérifiée avant l'appel : message clair plutôt qu'une erreur brute.
    const decision = evaluateNcTransition(nc.status, status, { correctiveAction: corrective });
    if (!decision.ok) {
      toast.push(t(decision.code === 'corrective_action_required' ? 'nc.needAction' : 'nc.invalidTransition'), 'danger');
      return;
    }
    const rec = await nonConformities.update(nc.id, { status, correctiveAction: corrective });
    setRows((r) => r.map((x) => (x.id === nc.id ? rec : x)));
    setActions((a) => ({ ...a, [nc.id]: '' }));
    toast.push(t('nc.status.changed'), 'success');
  }

  async function remove(nid: string) {
    await nonConformities.remove(nid);
    setRows((r) => r.filter((x) => x.id !== nid));
    toast.push(t('nc.removed'), 'info');
  }

  const severities = bySeverity(rows);
  const rate = traitementRate(rows);
  const tableRows: TableRowData[] = sortByPriority(rows).map((n) => {
    const late = isOverdue(n, now);
    return {
      cells: [
        <span>
          <span className="block font-medium">{n.label}</span>
          <span className="block text-[12px] text-ink-3">
            <span className="mono">{n.reference}</span> · {ncSourceLabel(n.source)}{n.location ? ` · ${n.location}` : ''}
          </span>
          {n.correctiveAction && <span className="block text-[12px] text-ink-2">{n.correctiveAction}</span>}
        </span>,
        <Badge tone={NC_SEVERITY_TONE[n.severity]}>{ncSeverityLabel(n.severity)}</Badge>,
        <span className="flex flex-col gap-0.5">
          <span className="mono text-[12px] text-ink-3">{formatDate(n.detectedAt, locale)}</span>
          {n.dueDate && (
            <span className="flex items-center gap-1 text-[12px] text-ink-3">
              {t('nc.col.due')} {formatDate(n.dueDate, locale)}
              {late && <Badge tone="danger"><AlertTriangle size={11} className="mb-0.5 inline" /> {t('nc.overdue')}</Badge>}
            </span>
          )}
          {n.owner && <span className="text-[12px] text-ink-3">{n.owner}</span>}
        </span>,
        <Badge tone={NC_STATUS_TONE[n.status]}>{ncStatusLabel(n.status)}</Badge>,
        <span className="flex flex-col items-end gap-1">
          {canEdit && n.status !== 'soldee' && !n.correctiveAction && (
            <Field
              id={`nc-act-${n.id}`}
              label={t('nc.field.action')}
              value={actions[n.id] ?? ''}
              onChange={(e) => setActions((a) => ({ ...a, [n.id]: e.target.value }))}
              placeholder={t('nc.field.actionPlaceholder')}
            />
          )}
          <span className="flex flex-wrap justify-end gap-1">
            {canEdit && NC_STATUSES.filter((s) => s !== n.status && evaluateNcTransition(n.status, s, { correctiveAction: actions[n.id]?.trim() || n.correctiveAction }).ok).map((s) => (
              <Button key={s} variant="glass" size="sm" onClick={() => setStatus(n, s)}>{ncStatusLabel(s)}</Button>
            ))}
            {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('nc.removed')} onClick={() => remove(n.id)}><Trash2 size={15} /></Button>}
          </span>
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
            <div className="text-[13px] text-ink-3"><BadgeCheck size={12} className="mb-0.5 inline" /> {op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('nc.title')}</h1>
          </div>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('nc.add')}</Button>}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}
      {receptionBlockedByNc(rows) && (
        <Banner tone="danger" icon={<AlertTriangle size={16} />}>{t('nc.blocksReception', { n: criticalOpenCount(rows) })}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('nc.kpi.open'), value: openCount(rows) },
          { label: t('nc.kpi.critical'), value: severities.critique, accent: severities.critique > 0 },
          { label: t('nc.kpi.overdue'), value: overdueCount(rows, now), accent: overdueCount(rows, now) > 0 },
          { label: t('nc.kpi.rate'), value: rate === null ? '—' : `${Math.round(rate * 100)} %` },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="nc-ref" label={t('nc.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} placeholder="NC-2026-006" />
            <Field id="nc-date" label={t('nc.field.detectedAt')} type="date" value={draft.detectedAt} onChange={(e) => setDraft((d) => ({ ...d, detectedAt: e.target.value }))} />
            <Select id="nc-source" label={t('nc.field.source')} value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value as NcSource }))}>
              {NC_SOURCES.map((s) => <option key={s} value={s}>{ncSourceLabel(s)}</option>)}
            </Select>
            <Select id="nc-sev" label={t('nc.field.severity')} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as NcSeverity }))}>
              {NC_SEVERITIES.map((s) => <option key={s} value={s}>{ncSeverityLabel(s)}</option>)}
            </Select>
            <Field id="nc-loc" label={t('nc.field.location')} value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
            <Field id="nc-owner" label={t('nc.field.owner')} value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} />
            <Field id="nc-due" label={t('nc.field.dueDate')} type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
            <Textarea id="nc-label" label={t('nc.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
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
        <Card><EmptyState title={t('nc.title')} description={t('nc.empty')} /></Card>
      ) : (
        <Panel title={t('nc.register')} meta="RG-NC-01/02" bodyPadded={false}>
          <DataTable
            template="2.2fr 0.8fr 1.2fr 0.9fr auto"
            columns={[
              { label: t('nc.col.nc') },
              { label: t('nc.col.severity') },
              { label: t('nc.col.dates') },
              { label: t('nc.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('nc.subtitle')}</div>
    </div>
  );
}
