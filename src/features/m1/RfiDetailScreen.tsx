import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, FactList, Panel, Skeleton, type Fact } from '../../ui';
import { rfiStatusLabel, rfiPriorityLabel, RFI_STATUS_TONE, RFI_PRIORITY_TONE } from './labels';
import { useData, useOperation, useRfis } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { isOverdue, nextRfiStatus } from '../../domain/rfi';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

const today = () => new Date().toISOString().slice(0, 10);

export function RfiDetailScreen({ id, rid }: { id: string; rid: string }) {
  const { rfis, session } = useData();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: rows, loading, refetch } = useRfis(id);
  const r = rows?.find((x) => x.id === rid) ?? null;
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!r) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'rfi', id })}>{t('common.back')}</Button>}>{t('rfi.notFound')}</Banner>;

  const overdue = isOverdue(r, today());
  async function answer() {
    if (!r) return;
    const a = window.prompt(t('rfi.answer.prompt'), r.answer ?? '') ?? '';
    if (!a.trim()) return;
    await rfis.setStatus(r.id, 'repondue', a);
    refetch();
  }
  async function close() {
    if (!r) return;
    await rfis.setStatus(r.id, 'cloturee');
    refetch();
  }

  const facts: Fact[] = [
    { label: t('rfi.col.raisedBy'), value: r.raisedBy },
    { label: t('rfi.col.due'), value: r.dueDate ? formatDate(r.dueDate, locale) : '—', severity: overdue ? 'danger' : undefined },
    { label: t('rfi.field.document'), value: r.documentRef ?? '—' },
    { label: t('rfi.col.status'), value: rfiStatusLabel(r.status) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'rfi', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="mono text-[13px] font-medium">{r.number}</span>
            <Badge tone={RFI_PRIORITY_TONE[r.priority]}>{rfiPriorityLabel(r.priority)}</Badge>
            <Badge tone={RFI_STATUS_TONE[r.status]}>{rfiStatusLabel(r.status)}</Badge>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{r.subject}</h1>
        </div>
      </div>

      {overdue && <Banner tone="danger" icon={<AlertTriangle size={16} />}>{t('rfi.overdue.banner')}</Banner>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title={t('rfi.field.question')}><p className="text-[14px] text-ink-2">{r.question || '—'}</p></Panel>
          <Panel
            title={t('rfi.answer.title')}
            actions={canEdit && (r.status === 'ouverte'
              ? <Button variant="primary" size="sm" onClick={answer}>{t('rfi.action.answer')}</Button>
              : r.status === 'repondue' && nextRfiStatus(r.status) ? <Button variant="glass" size="sm" onClick={close}>{t('rfi.action.close')}</Button> : undefined)}
          >
            {r.answer ? <p className="text-[14px] text-ink-2">{r.answer}</p> : <p className="text-[13px] text-ink-3">{t('rfi.answer.pending')}</p>}
          </Panel>
        </div>
        <Panel title={t('rfi.detail.meta')} bodyPadded={false}><FactList items={facts} /></Panel>
      </div>
    </div>
  );
}
