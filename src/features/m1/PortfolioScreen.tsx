import { useState } from 'react';
import { Search, Plus, FolderOpen, Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Money, Panel, Select, Skeleton, useToast } from '../../ui';
import { PhaseBadge } from './PhaseBadge';
import { countryLabel, opTypeLabel, phaseLabel, statusLabel, STATUS_TONE } from './labels';
import { useData, useOperations } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { OP_TYPES, PHASES, type Operation, type OpType, type OperationStatus, type Phase } from '../../domain/m1/types';
import { can } from '../../domain/m1/permissions';
import type { OperationFilter } from '../../data/repo';

function ProgressCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="ax-progress" style={{ width: 64 }}>
        <span className="ax-progress__bar block" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="mono text-[12px] text-ink-3">{formatPercent(value, locale, 0)}</span>
    </div>
  );
}

export function PortfolioScreen() {
  const { ops, session, countries } = useData();
  const { navigate } = useNav();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState<'' | Phase>('');
  const [opType, setOpType] = useState<'' | OpType>('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<'' | OperationStatus>('');

  const filter: OperationFilter = {
    search: search || undefined,
    phase: phase || undefined,
    opType: opType || undefined,
    countryCode: country || undefined,
    status: status || undefined,
  };
  const { data, loading, error, refetch } = useOperations(filter);

  const canArchive = can(session.role, 'op.archive');

  async function toggleArchive(op: Operation) {
    await ops.setStatus(op.id, op.status === 'closed' ? 'active' : 'closed');
    toast.push(t(op.status === 'closed' ? 'common.unarchive' : 'common.archive'), 'info');
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1 flex items-end justify-between gap-3">
        <h1 className="text-[26px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('portfolio.title')}</h1>
        <Button variant="primary" size="sm" onClick={() => navigate({ name: 'create' })}>
          <Plus size={16} />
          {t('portfolio.new')}
        </Button>
      </div>

      {/* Barre d'actions : recherche + filtres */}
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="ax-field flex-1" htmlFor="pf-search">
            <span className="ax-label">{t('common.search')}</span>
            <span className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                id="pf-search"
                className="ax-input"
                style={{ paddingLeft: 34 }}
                placeholder={t('portfolio.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select id="pf-phase" label={t('portfolio.filter.phase')} value={phase} onChange={(e) => setPhase(e.target.value as Phase | '')}>
              <option value="">{t('common.all')}</option>
              {PHASES.map((p) => (
                <option key={p} value={p}>{phaseLabel(p)}</option>
              ))}
            </Select>
            <Select id="pf-type" label={t('portfolio.filter.type')} value={opType} onChange={(e) => setOpType(e.target.value as OpType | '')}>
              <option value="">{t('common.all')}</option>
              {OP_TYPES.map((o) => (
                <option key={o} value={o}>{opTypeLabel(o)}</option>
              ))}
            </Select>
            <Select id="pf-country" label={t('portfolio.filter.country')} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{countryLabel(c.code)}</option>
              ))}
            </Select>
            <Select id="pf-status" label={t('portfolio.filter.status')} value={status} onChange={(e) => setStatus(e.target.value as OperationStatus | '')}>
              <option value="">{t('common.all')}</option>
              {(['active', 'paused', 'closed'] as OperationStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Panel>

      {error && (
        <Banner tone="danger" icon={<AlertTriangle size={16} />} action={<Button size="sm" variant="glass" onClick={refetch}>{t('common.retry')}</Button>}>
          {t('portfolio.error')}
        </Banner>
      )}

      {loading && !error && (
        <Panel>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 44 }} />
            ))}
          </div>
        </Panel>
      )}

      {data && data.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={<FolderOpen size={32} />}
            title={t('portfolio.empty.title')}
            description={t('portfolio.empty.desc')}
            action={
              <Button variant="primary" onClick={() => navigate({ name: 'create' })}>
                <Plus size={16} />
                {t('portfolio.new')}
              </Button>
            }
          />
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          {/* Tableau (≥ 768) — défilement horizontal si nécessaire (handoff) */}
          <Panel bodyPadded={false} className="hidden sm:block">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 880 }}>
                <DataTable
                  template="1.6fr 1fr 1fr 1fr 150px 130px 1fr auto"
                  columns={[
                    { label: t('portfolio.col.name') },
                    { label: t('portfolio.col.country') },
                    { label: t('portfolio.col.type') },
                    { label: t('portfolio.col.phase') },
                    { label: t('portfolio.col.budget'), align: 'right' },
                    { label: t('portfolio.col.progress') },
                    { label: t('portfolio.col.status') },
                    { label: '' },
                  ]}
                  rows={data.map((op) => ({
                    onClick: () => navigate({ name: 'cockpit', id: op.id }),
                    cells: [
                      <span className="font-medium">{op.name}</span>,
                      <span className="text-ink-2">{countryLabel(op.countryCode)}</span>,
                      <span className="text-ink-2">{opTypeLabel(op.opType)}</span>,
                      <PhaseBadge phase={op.phase} />,
                      <Money amount={op.budgetBac} currency={op.currency} className="mono" />,
                      <ProgressCell value={op.progress ?? 0} />,
                      <Badge tone={STATUS_TONE[op.status]}>{statusLabel(op.status)}</Badge>,
                      <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" icon aria-label={t('common.open')} onClick={() => navigate({ name: 'cockpit', id: op.id })}>
                          <FolderOpen size={16} />
                        </Button>
                        {canArchive && (
                          <Button size="sm" variant="ghost" icon aria-label={op.status === 'closed' ? t('common.unarchive') : t('common.archive')} onClick={() => toggleArchive(op)}>
                            {op.status === 'closed' ? <RotateCcw size={16} /> : <Archive size={16} />}
                          </Button>
                        )}
                      </span>,
                    ],
                  }))}
                />
              </div>
            </div>
          </Panel>

          {/* Cartes (< 768) */}
          <div className="flex flex-col gap-3 sm:hidden">
            {data.map((op) => (
              <Card key={op.id} onClick={() => navigate({ name: 'cockpit', id: op.id })}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">{op.name}</div>
                  <PhaseBadge phase={op.phase} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Money amount={op.budgetBac} currency={op.currency} className="text-[14px]" />
                  <span className="mono text-[12px] text-ink-3">{formatPercent(op.progress ?? 0, locale, 0)}</span>
                </div>
                <div className="mt-2">
                  <ProgressCell value={op.progress ?? 0} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
