import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, FactList, Panel, Skeleton, type Fact } from '../../ui';
import { docDisciplineLabel, docStatusLabel, DOC_STATUS_TONE } from './labels';
import { useData, useOperation, useDocuments, useRfis } from '../../app/providers';
import { useNav } from '../../app/router';
import { t } from '../../i18n';
import { canVisa, isApproved, isRefused, nextIndice, type DocStatus } from '../../domain/ged';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';

export function DocumentVisaScreen({ id, did }: { id: string; did: string }) {
  const { documents, session } = useData();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: rows, loading, refetch } = useDocuments(id);
  const { data: rfis } = useRfis(id);
  const d = rows?.find((x) => x.id === did) ?? null;
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'op.update') && !readOnly;

  if (loading) return <div className="flex flex-col gap-4"><Skeleton style={{ height: 40, width: 280 }} /><Skeleton style={{ height: 200 }} /></div>;
  if (!d) return <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'conception', id })}>{t('common.back')}</Button>}>{t('doc.notFound')}</Banner>;

  // RFI ouvertes qui référencent ce document (peuvent bloquer le visa).
  const docRef = d.reference;
  const blockingRfis = (rfis ?? []).filter((r) => r.documentRef === docRef && r.status !== 'cloturee');

  async function setStatus(status: DocStatus) {
    await documents.setStatus(did, status);
    refetch();
  }

  const facts: Fact[] = [
    { label: t('doc.col.discipline'), value: docDisciplineLabel(d.discipline) },
    { label: t('doc.col.indice'), value: d.indice },
    { label: t('doc.col.status'), value: docStatusLabel(d.status) },
    ...(isRefused(d.status) ? [{ label: t('doc.nextIndice'), value: nextIndice(d.indice), severity: 'accent' as const }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'conception', id })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="mono text-[13px] font-medium">{d.reference}</span>
            <Badge tone={DOC_STATUS_TONE[d.status]}>{docStatusLabel(d.status)}</Badge>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{d.title}</h1>
        </div>
      </div>

      {blockingRfis.length > 0 && (
        <Banner tone="danger" icon={<AlertTriangle size={16} />}>
          {t('doc.blockedByRfi', { rfis: blockingRfis.map((r) => r.number).join(', ') })}
        </Banner>
      )}
      {isApproved(d.status) && <Banner tone="success">{t('doc.approved')}</Banner>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr]">
        <Panel
          title={t('doc.visa.title')}
          actions={canEdit && (d.status === 'en_cours'
            ? <Button variant="primary" size="sm" onClick={() => setStatus('diffuse')}>{t('doc.action.diffuse')}</Button>
            : canVisa(d.status)
              ? <>
                  <Button variant="glass" size="sm" onClick={() => setStatus('vise_a')}>{t('doc.action.vise_a')}</Button>
                  <Button variant="glass" size="sm" onClick={() => setStatus('vise_b')}>{t('doc.action.vise_b')}</Button>
                  <Button variant="glass" size="sm" onClick={() => setStatus('vise_c')}>{t('doc.action.vise_c')}</Button>
                </>
              : undefined)}
        >
          <p className="text-[13px] text-ink-2">{t('doc.visa.help')}</p>
        </Panel>
        <Panel title={t('doc.detail.meta')} bodyPadded={false}><FactList items={facts} /></Panel>
      </div>
    </div>
  );
}
