import { useEffect, useState } from 'react';
import { Plus, Trash2, BellRing } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { alertSeverityLabel, ALERT_SEVERITY_TONE, alertMetricLabel } from './labels';
import { useData, useAlertRules } from '../../app/providers';
import { t } from '../../i18n';
import { isActive, countBySeverity, ALERT_METRICS, ALERT_SEVERITIES, type AlertRule, type AlertSeverity } from '../../domain/alertRule';
import { can } from '../../domain/m1/permissions';

export function AlertesScreen() {
  const { alertRules, session } = useData();
  const toast = useToast();
  const { data: loaded, loading } = useAlertRules();

  const [rows, setRows] = useState<AlertRule[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const canEdit = can(session.role, 'op.update');

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ metric: string; threshold: string; severity: AlertSeverity }>({ metric: ALERT_METRICS[0], threshold: '', severity: 'warning' });

  async function add() {
    const th = draft.threshold.trim() === '' ? null : Number(draft.threshold);
    if (!draft.metric.trim() || (th !== null && !Number.isFinite(th))) return;
    const input = { metric: draft.metric, threshold: th, severity: draft.severity };
    const rec = await alertRules.add(input);
    setRows((r) => [...r, rec]);
    setDraft({ metric: ALERT_METRICS[0], threshold: '', severity: 'warning' });
    setAdding(false);
    toast.push(t('alert.added'), 'success');
  }
  async function changeSeverity(id: string, severity: AlertSeverity) {
    const rec = await alertRules.update(id, { severity });
    setRows((r) => r.map((x) => (x.id === rec.id ? rec : x)));
  }
  async function remove(id: string) {
    await alertRules.remove(id);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.push(t('alert.removed'), 'info');
  }

  const counts = countBySeverity(rows);

  const tableRows: TableRowData[] = rows.map((r) => ({
    cells: [
      <span>
        <span className="block font-medium">{alertMetricLabel(r.metric)}</span>
        <span className="block mono text-[12px] text-ink-3">{r.metric}</span>
      </span>,
      <span className="mono text-[13px]">{isActive(r) ? `≥ ${r.threshold}` : <span className="text-ink-3">{t('alert.inactive')}</span>}</span>,
      canEdit ? (
        <Select id={`sev-${r.id}`} label="" value={r.severity} onChange={(e) => changeSeverity(r.id, e.target.value as AlertSeverity)}>
          {ALERT_SEVERITIES.map((s) => <option key={s} value={s}>{alertSeverityLabel(s)}</option>)}
        </Select>
      ) : <Badge tone={ALERT_SEVERITY_TONE[r.severity]}>{alertSeverityLabel(r.severity)}</Badge>,
      <span className="flex justify-end">
        {canEdit && <Button variant="ghost" size="sm" icon aria-label={t('alert.removed')} onClick={() => remove(r.id)}><Trash2 size={15} /></Button>}
      </span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] text-ink-3"><BellRing size={12} className="mb-0.5 inline" /> {t('alert.scope')}</div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('alert.title')}</h1>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('alert.add')}</Button>}
      </div>

      <KpiRow
        items={[
          { label: t('alert.kpi.total'), value: rows.length },
          { label: t('alert.sev.critical'), value: counts.critical, accent: counts.critical > 0 },
          { label: t('alert.sev.warning'), value: counts.warning },
          { label: t('alert.sev.info'), value: counts.info },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select id="al-metric" label={t('alert.field.metric')} value={draft.metric} onChange={(e) => setDraft((d) => ({ ...d, metric: e.target.value }))}>
              {ALERT_METRICS.map((m) => <option key={m} value={m}>{alertMetricLabel(m)}</option>)}
            </Select>
            <Field id="al-th" label={t('alert.field.threshold')} type="number" inputMode="decimal" value={draft.threshold} onChange={(e) => setDraft((d) => ({ ...d, threshold: e.target.value }))} placeholder={t('alert.field.threshold.ph')} />
            <Select id="al-sev" label={t('alert.field.severity')} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as AlertSeverity }))}>
              {ALERT_SEVERITIES.map((s) => <option key={s} value={s}>{alertSeverityLabel(s)}</option>)}
            </Select>
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
        <Card><EmptyState title={t('alert.title')} description={t('alert.empty')} /></Card>
      ) : (
        <Panel title={t('alert.register')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr 1.2fr auto"
            columns={[
              { label: t('alert.col.metric') },
              { label: t('alert.col.threshold') },
              { label: t('alert.col.severity') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('alert.subtitle')}</div>
    </div>
  );
}
