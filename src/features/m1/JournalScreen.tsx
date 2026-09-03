import { useEffect, useState } from 'react';
import { ChevronLeft, Lock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, KpiRow, Panel, Skeleton, type TableRowData } from '../../ui';
import { auditActionLabel, AUDIT_ACTION_TONE } from './labels';
import { useOperation, useAudit } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { distinctModules, groupByDay, verifyAuditChain, type AuditEntry } from '../../domain/m23';

/** Heure « HH h MM » (format handoff). */
function formatTime(iso: string): string {
  const hh = iso.slice(11, 13);
  const mm = iso.slice(14, 16);
  return `${hh} h ${mm}`;
}

export function JournalScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useAudit(id);

  const [rows, setRows] = useState<AuditEntry[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  const groups = groupByDay(rows);
  const actors = new Set(rows.map((e) => e.actor)).size;
  const integrity = verifyAuditChain(rows);

  const dayRows = (entries: AuditEntry[]): TableRowData[] =>
    entries.map((e) => ({
      cells: [
        <span className="mono text-ink-3">{formatTime(e.at)}</span>,
        <span className="font-medium">{e.actor}</span>,
        <Badge tone={AUDIT_ACTION_TONE[e.action]}>{auditActionLabel(e.action)}</Badge>,
        <span className="mono text-[13px]">{e.module}</span>,
        <span>
          <span className="block">{e.object}</span>
          {e.summary && <span className="block text-[12px] text-ink-3">{e.summary}</span>}
        </span>,
      ],
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <div className="text-[13px] text-ink-3">{op?.name}</div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('audit.title')}</h1>
        </div>
      </div>

      <Banner tone="info" icon={<Lock size={16} />}>{t('audit.appendOnly')}</Banner>

      {!loading && rows.length > 0 && (
        integrity.ok
          ? <Banner tone="success" icon={<ShieldCheck size={16} />}>{t('audit.integrity.ok', { n: rows.length })}</Banner>
          : <Banner tone="danger" icon={<ShieldAlert size={16} />}>{t('audit.integrity.broken', { n: (integrity.brokenAt ?? 0) + 1 })}</Banner>
      )}

      <KpiRow
        items={[
          { label: t('audit.kpi.count'), value: rows.length },
          { label: t('audit.kpi.modules'), value: distinctModules(rows) },
          { label: t('audit.kpi.actors'), value: actors },
          { label: t('audit.kpi.integrity'), value: integrity.ok ? t('audit.integrity.verified') : t('audit.integrity.alert'), accent: !integrity.ok },
        ]}
      />

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('audit.title')} description={t('audit.empty')} /></Card>
      ) : (
        groups.map((g) => (
          <Panel key={g.day} title={formatDate(g.day, locale)} bodyPadded={false}>
            <DataTable
              template="90px 1.3fr 1fr 80px 2fr"
              columns={[
                { label: t('audit.col.time') },
                { label: t('audit.col.actor') },
                { label: t('audit.col.action') },
                { label: t('audit.col.module') },
                { label: t('audit.col.object') },
              ]}
              rows={dayRows(g.entries)}
            />
          </Panel>
        ))
      )}

      <div className="text-[12px] text-ink-3">{t('audit.subtitle')}</div>
    </div>
  );
}
