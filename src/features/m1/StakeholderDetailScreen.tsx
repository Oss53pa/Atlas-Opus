import { ChevronLeft, Mail, Phone, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge, Banner, Button, DataTable, KpiRow, Panel, ReadField, Skeleton, type TableRowData } from '../../ui';
import { stakeholderTypeLabel, insuranceTypeLabel, insuranceStatusLabel, INS_STATUS_TONE, raciLabel, RACI_TONE } from './labels';
import { useData, useOperation, useStakeholders, useInsurances, useRaci } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatDate } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { insuranceStatus, missingMandatoryInsurances, isInterventionBlocked, requiredInsurances } from '../../domain/m7/rules';
import type { InsuranceStatus } from '../../domain/m7/types';

const today = () => new Date().toISOString().slice(0, 10);

export function StakeholderDetailScreen({ id, sid }: { id: string; sid: string }) {
  const { session } = useData();
  const { navigate } = useNav();
  const { data: op } = useOperation(id);
  const { data: stakeholders, loading: ls } = useStakeholders(id);
  const { data: insurances, loading: li } = useInsurances(id);
  const { data: raci } = useRaci(id);

  const currency = op?.currency ?? 'XOF';
  const now = today();
  const loading = ls || li;
  const s = stakeholders?.find((x) => x.id === sid) ?? null;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton style={{ height: 40, width: 280 }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 84 }} />)}</div>
        <Skeleton style={{ height: 200 }} />
      </div>
    );
  }
  if (!s) {
    return (
      <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={() => navigate({ name: 'stakeholders', id })}>{t('common.back')}</Button>}>
        {t('stakeholder.notFound')}
      </Banner>
    );
  }

  const mine = (insurances ?? []).filter((i) => i.stakeholderId === s.id);
  const required = requiredInsurances(s.type);
  const missing = missingMandatoryInsurances(s.type, mine, now);
  const blocked = isInterventionBlocked(s.type, mine, now);
  const myRaci = (raci ?? []).filter((r) => r.stakeholderId === s.id);

  // Lignes du tableau des assurances : polices présentes + obligatoires manquantes.
  const insuranceRows: TableRowData[] = [
    ...mine.map((ins) => {
      const st: InsuranceStatus = insuranceStatus(ins, now);
      return {
        cells: [
          <span className="font-medium">{insuranceTypeLabel(ins.type)}</span>,
          <span className="text-ink-2">{ins.insurer}</span>,
          <span className="mono text-ink-3">{ins.validTo ? formatDate(ins.validTo, locale) : '—'}</span>,
          <Badge tone={INS_STATUS_TONE[st]}>{insuranceStatusLabel(st)}</Badge>,
        ],
      } as TableRowData;
    }),
    ...missing.filter((mt) => !mine.some((i) => i.type === mt)).map((mt) => ({
      cells: [
        <span className="font-medium">{insuranceTypeLabel(mt)}</span>,
        <span className="text-ink-3">—</span>,
        <span className="text-ink-3">—</span>,
        <Badge tone={INS_STATUS_TONE.missing}>{insuranceStatusLabel('missing')}</Badge>,
      ],
    } as TableRowData)),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'stakeholders', id })}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge>{stakeholderTypeLabel(s.type)}</Badge>
            <span className="text-[13px] text-ink-3">{op?.name}</span>
          </div>
          <h1 className="text-[26px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{s.name}</h1>
        </div>
      </div>

      {/* Garde d'intervention (RG-M7-03) */}
      {required.length > 0 && (
        <Banner tone={blocked ? 'danger' : 'success'} icon={blocked ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}>
          {blocked
            ? t('stakeholder.blocked', { types: missing.map(insuranceTypeLabel).join(', ') })
            : t('stakeholder.covered')}
        </Banner>
      )}

      <KpiRow
        items={[
          { label: t('stakeholders.field.fee'), value: Money.of(s.feeAmount, currency).format(locale) },
          { label: t('stakeholder.kpi.insurances'), value: mine.length },
          { label: t('stakeholder.kpi.raci'), value: myRaci.length },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr]">
        {/* Coordonnées & mission */}
        <Panel title={t('stakeholder.contact')}>
          <div className="grid grid-cols-1 gap-3">
            <ReadField label={t('stakeholders.field.mission')} value={s.mission} />
            <ReadField label={t('stakeholders.field.email')} value={s.email ? <span className="flex items-center gap-2"><Mail size={14} className="text-ink-3" />{s.email}</span> : null} />
            <ReadField label={t('stakeholders.field.phone')} value={s.phone ? <span className="flex items-center gap-2"><Phone size={14} className="text-ink-3" />{s.phone}</span> : null} mono />
          </div>
        </Panel>

        {/* Assurances (dérivées) */}
        <Panel title={t('stakeholder.insurances')} meta={required.length > 0 ? t('stakeholder.required', { types: required.map(insuranceTypeLabel).join(', ') }) : undefined} bodyPadded={insuranceRows.length === 0}>
          {insuranceRows.length === 0 ? (
            <span className="text-[13px] text-ink-3">{t('stakeholder.noInsurance')}</span>
          ) : (
            <DataTable
              template="1fr 1.4fr 1fr 1fr"
              columns={[
                { label: t('ins.col.type') },
                { label: t('ins.col.insurer') },
                { label: t('ins.col.validTo') },
                { label: t('ins.col.status') },
              ]}
              rows={insuranceRows}
            />
          )}
        </Panel>
      </div>

      {/* RACI de l'intervenant */}
      {myRaci.length > 0 && (
        <Panel title={t('stakeholder.raci')} bodyPadded={false}>
          <DataTable
            template="2fr 1fr"
            columns={[{ label: t('raci.field.activity') }, { label: t('raci.field.raci') }]}
            rows={myRaci.map((r): TableRowData => ({
              cells: [
                <span className="font-medium">{r.activity}</span>,
                <span className="flex items-center gap-2"><Badge tone={RACI_TONE[r.raci]}>{r.raci}</Badge><span className="text-[12px] text-ink-3">{raciLabel(r.raci)}</span></span>,
              ],
            }))}
          />
        </Panel>
      )}

      {session.role === 'viewer' && <div className="text-[12px] text-ink-3">{t('stakeholders.readonly')}</div>}
    </div>
  );
}
