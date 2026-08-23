import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { reserveSeverityLabel, reserveStatusLabel, RESERVE_SEVERITY_TONE, RESERVE_STATUS_TONE } from './labels';
import { useData, useOperation, useReserves } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { canPronounceReception, clearedCount, majorOpenCount, openReservesCount, RESERVE_SEVERITIES, type Reserve, type ReserveSeverity } from '../../domain/m19';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function ReceptionScreen({ id }: { id: string }) {
  const { reception, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useReserves(id);

  const [rows, setRows] = useState<Reserve[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ label: string; location: string; severity: ReserveSeverity; raised: string }>({
    label: '', location: '', severity: 'mineure', raised: today(),
  });

  const gate = canPronounceReception(rows);

  async function add() {
    if (!draft.label.trim()) return;
    const rec = await reception.addReserve(id, { label: draft.label, location: draft.location, severity: draft.severity, raisedAt: draft.raised || today() });
    setRows((r) => [rec, ...r]);
    setDraft({ label: '', location: '', severity: 'mineure', raised: today() });
    setAdding(false);
    toast.push(t('reception.added'), 'success');
  }
  async function lift(rid: string) {
    const rec = await reception.setReserveStatus(rid, 'levee');
    setRows((r) => r.map((x) => (x.id === rid ? rec : x)));
  }
  async function remove(rid: string) {
    await reception.removeReserve(rid);
    setRows((r) => r.filter((x) => x.id !== rid));
    toast.push(t('reception.removed'), 'info');
  }

  const tableRows: TableRowData[] = rows.map((o) => ({
    cells: [
      <span className="font-medium">{o.label}</span>,
      <span className="text-ink-2">{o.location || '—'}</span>,
      <Badge tone={RESERVE_SEVERITY_TONE[o.severity]}>{reserveSeverityLabel(o.severity)}</Badge>,
      <span className="mono text-ink-3">{formatDate(o.raisedAt, locale)}</span>,
      <Badge tone={RESERVE_STATUS_TONE[o.status]}>{reserveStatusLabel(o.status)}</Badge>,
      <span className="flex justify-end gap-1">
        {canEdit && o.status === 'ouverte' && (
          <Button variant="glass" size="sm" onClick={() => lift(o.id)}><Check size={14} />{t('reception.lift')}</Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="sm" icon aria-label={t('reception.removed')} onClick={() => remove(o.id)}><Trash2 size={15} /></Button>
        )}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('reception.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('reception.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      {/* Garde de réception (RG-M19) */}
      <Banner tone={gate.ok ? 'success' : 'danger'} icon={gate.ok ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}>
        {gate.ok ? t('reception.gate.ok') : t('reception.gate.blocked', { count: gate.blocking })}
      </Banner>

      <KpiRow
        items={[
          { label: t('reception.kpi.open'), value: openReservesCount(rows) },
          { label: t('reception.kpi.major'), value: majorOpenCount(rows), accent: majorOpenCount(rows) > 0 },
          { label: t('reception.kpi.cleared'), value: clearedCount(rows) },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="rs-label" label={t('reception.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            <Field id="rs-loc" label={t('reception.field.location')} value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
            <Select id="rs-sev" label={t('reception.field.severity')} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as ReserveSeverity }))}>
              {RESERVE_SEVERITIES.map((s) => <option key={s} value={s}>{reserveSeverityLabel(s)}</option>)}
            </Select>
            <Field id="rs-raised" label={t('reception.field.raised')} type="date" value={draft.raised} onChange={(e) => setDraft((d) => ({ ...d, raised: e.target.value }))} />
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
        <Card><EmptyState title={t('reception.title')} description={t('reception.empty')} /></Card>
      ) : (
        <Panel title={t('reception.title')} bodyPadded={false}>
          <DataTable
            template="1.6fr 1.2fr 1fr 1fr 1fr auto"
            columns={[
              { label: t('reception.col.label') },
              { label: t('reception.col.location') },
              { label: t('reception.col.severity') },
              { label: t('reception.col.raised') },
              { label: t('reception.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('reception.subtitle')}</div>
    </div>
  );
}
