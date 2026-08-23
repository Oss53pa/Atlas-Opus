import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { riskCategoryLabel, riskStatusLabel, riskLevelLabel, RISK_STATUS_TONE, RISK_LEVEL_TONE } from './labels';
import { useData, useOperation, useRisks } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import {
  riskScore, riskLevel, openRisksCount, controlledCount, criticalOpenCount, sortByCriticality,
  RISK_CATEGORIES, type Risk, type RiskCategory, type RiskStatus,
} from '../../domain/m20';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function RisquesScreen({ id }: { id: string }) {
  const { risks, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useRisks(id);

  const [rows, setRows] = useState<Risk[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ code: string; label: string; category: RiskCategory; p: string; i: string; mitigation: string }>({
    code: '', label: '', category: 'technique', p: '3', i: '3', mitigation: '',
  });

  async function add() {
    if (!draft.code.trim() || !draft.label.trim()) return;
    const clamp = (v: string) => Math.min(5, Math.max(1, Number(v.replace(/[^\d]/g, '')) || 1));
    const rec = await risks.add(id, {
      code: draft.code, label: draft.label, category: draft.category,
      probability: clamp(draft.p), impact: clamp(draft.i), mitigation: draft.mitigation || null,
    });
    setRows((r) => [...r, rec]);
    setDraft({ code: '', label: '', category: 'technique', p: '3', i: '3', mitigation: '' });
    setAdding(false);
    toast.push(t('risk.added'), 'success');
  }
  async function setStatus(rid: string, status: RiskStatus) {
    const rec = await risks.setStatus(rid, status);
    setRows((r) => r.map((x) => (x.id === rid ? rec : x)));
  }
  async function remove(rid: string) {
    await risks.remove(rid);
    setRows((r) => r.filter((x) => x.id !== rid));
    toast.push(t('risk.removed'), 'info');
  }

  const NEXT_STATUS: Record<RiskStatus, { s: RiskStatus; key: 'risk.action.maitrise' | 'risk.action.clos' | 'risk.action.ouvert' }[]> = {
    ouvert: [{ s: 'maitrise', key: 'risk.action.maitrise' }, { s: 'clos', key: 'risk.action.clos' }],
    maitrise: [{ s: 'clos', key: 'risk.action.clos' }, { s: 'ouvert', key: 'risk.action.ouvert' }],
    clos: [{ s: 'ouvert', key: 'risk.action.ouvert' }],
  };

  const tableRows: TableRowData[] = sortByCriticality(rows).map((r) => {
    const score = riskScore(r.probability, r.impact);
    const level = riskLevel(score);
    return {
      cells: [
        <span className="mono text-[13px] font-medium">{r.code}</span>,
        <span>
          <span className="block font-medium">{r.label}</span>
          {r.mitigation && <span className="block text-[12px] text-ink-3">{r.mitigation}</span>}
        </span>,
        <span className="text-ink-2">{riskCategoryLabel(r.category)}</span>,
        <span className="flex items-center justify-end gap-2">
          <span className="mono">{r.probability}×{r.impact}={score}</span>
          <Badge tone={RISK_LEVEL_TONE[level]}>{riskLevelLabel(level)}</Badge>
        </span>,
        <Badge tone={RISK_STATUS_TONE[r.status]}>{riskStatusLabel(r.status)}</Badge>,
        <span className="flex justify-end gap-1">
          {canEdit && NEXT_STATUS[r.status].map((n) => (
            <Button key={n.s} variant="glass" size="sm" onClick={() => setStatus(r.id, n.s)}>{t(n.key)}</Button>
          ))}
          {canEdit && (
            <Button variant="ghost" size="sm" icon aria-label={t('risk.removed')} onClick={() => remove(r.id)}><Trash2 size={15} /></Button>
          )}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('risk.title')}</h1>
          </div>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} />{t('risk.add')}
          </Button>
        )}
      </div>

      {readOnly && <Banner tone="warning">{t('financing.readonly')}</Banner>}

      <KpiRow
        items={[
          { label: t('risk.kpi.open'), value: openRisksCount(rows) },
          { label: t('risk.kpi.critical'), value: criticalOpenCount(rows), accent: criticalOpenCount(rows) > 0 },
          { label: t('risk.kpi.controlled'), value: controlledCount(rows) },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="rk-code" label={t('risk.field.code')} value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} placeholder="R-12" />
            <Select id="rk-cat" label={t('risk.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as RiskCategory }))}>
              {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{riskCategoryLabel(c)}</option>)}
            </Select>
            <div className="sm:col-span-2">
              <Field id="rk-label" label={t('risk.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <Field id="rk-p" label={t('risk.field.probability')} inputMode="numeric" value={draft.p} onChange={(e) => setDraft((d) => ({ ...d, p: e.target.value.replace(/[^\d]/g, '') }))} />
            <Field id="rk-i" label={t('risk.field.impact')} inputMode="numeric" value={draft.i} onChange={(e) => setDraft((d) => ({ ...d, i: e.target.value.replace(/[^\d]/g, '') }))} />
            <div className="sm:col-span-2">
              <Field id="rk-mit" label={t('risk.field.mitigation')} value={draft.mitigation} onChange={(e) => setDraft((d) => ({ ...d, mitigation: e.target.value }))} />
            </div>
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
        <Card><EmptyState title={t('risk.title')} description={t('risk.empty')} /></Card>
      ) : (
        <Panel title={t('risk.title')} bodyPadded={false}>
          <DataTable
            template="70px 2fr 1fr 1.4fr 1fr auto"
            columns={[
              { label: t('risk.col.code') },
              { label: t('risk.col.label') },
              { label: t('risk.col.category') },
              { label: t('risk.col.score'), align: 'right' },
              { label: t('risk.col.status') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('risk.subtitle')}</div>
    </div>
  );
}
