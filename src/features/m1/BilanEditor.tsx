import { useEffect, useState } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Badge, Banner, Button, KpiRow, Panel, Select, Skeleton, useToast } from '../../ui';
import { posteLabel } from './labels';
import { useData, useBilanLines, useOperation } from '../../app/providers';
import { useNav } from '../../app/router';
import { locale, t } from '../../i18n';
import { formatAmount, formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import { bilanSummary, type BilanLine } from '../../domain/finance/bilan';
import { COST_POSTES, REVENUE_POSTES } from '../../domain/finance/postes';
import { can } from '../../domain/m1/permissions';
import { isReadOnlyForRole } from '../../domain/m1/rules';
import type { BilanLineRecord } from '../../data/repo';

export function BilanEditor({ id }: { id: string }) {
  const { bilan, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: loaded, loading } = useBilanLines(id);
  const [rows, setRows] = useState<BilanLineRecord[]>([]);

  useEffect(() => {
    if (loaded) setRows(loaded);
  }, [loaded]);

  const currency = op?.currency ?? 'XOF';
  const readOnly = op ? isReadOnlyForRole(op, session.role) : false;
  const canEdit = can(session.role, 'bilan.edit') && !readOnly;

  const moneyLines: BilanLine[] = rows.map((r) => ({ kind: r.kind, amount: Money.of(r.amountPlanned, currency) }));
  const sum = bilanSummary(moneyLines, currency);

  function setLocal(lineId: string, patch: Partial<BilanLineRecord>) {
    setRows((rs) => rs.map((r) => (r.id === lineId ? { ...r, ...patch } : r)));
  }
  async function persist(lineId: string, patch: { poste?: string; amountPlanned?: number }) {
    try {
      await bilan.updateLine(lineId, patch);
    } catch {
      /* RLS / réseau — l'état local reste, l'utilisateur peut réessayer */
    }
  }
  async function addLine(kind: 'cost' | 'revenue') {
    const poste = kind === 'cost' ? COST_POSTES[0] : REVENUE_POSTES[0];
    const rec = await bilan.addLine(id, { kind, poste, amountPlanned: 0, amountActual: 0 });
    setRows((rs) => [...rs, rec]);
    toast.push(t('bilan.line.added'), 'success');
  }
  async function removeLine(lineId: string) {
    await bilan.removeLine(lineId);
    setRows((rs) => rs.filter((r) => r.id !== lineId));
    toast.push(t('bilan.line.removed'), 'info');
  }

  const section = (kind: 'cost' | 'revenue') => {
    const list = rows.filter((r) => r.kind === kind);
    const postes = kind === 'cost' ? COST_POSTES : REVENUE_POSTES;
    return (
      <Panel
        title={t(kind === 'cost' ? 'bilan.section.costs' : 'bilan.section.revenues')}
        actions={
          canEdit && (
            <Button variant="glass" size="sm" onClick={() => addLine(kind)}>
              <Plus size={16} />
              {t(kind === 'cost' ? 'bilan.addCost' : 'bilan.addRevenue')}
            </Button>
          )
        }
      >
        {list.length === 0 ? (
          <p className="text-[13px] text-ink-3">{t('bilan.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <li className="hidden items-center gap-2 px-1 sm:flex">
              <span className="flex-1 text-[11px] uppercase tracking-wide text-ink-3">{t('bilan.col.poste')}</span>
              <span className="w-[150px] text-right text-[11px] uppercase tracking-wide text-ink-3">{t('bilan.col.planned')}</span>
              <span className="w-[150px] text-right text-[11px] uppercase tracking-wide text-ink-3">{t('bilan.col.actual')}</span>
              {canEdit && <span className="w-8" />}
            </li>
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1">
                {canEdit ? (
                  <span className="min-w-[150px] flex-1">
                    <Select id={`poste-${r.id}`} value={r.poste} onChange={(e) => { setLocal(r.id, { poste: e.target.value }); void persist(r.id, { poste: e.target.value }); }}>
                      {postes.map((p) => (
                        <option key={p} value={p}>
                          {posteLabel(p)}
                        </option>
                      ))}
                    </Select>
                  </span>
                ) : (
                  <span className="flex-1 text-[14px]">{posteLabel(r.poste)}</span>
                )}
                {canEdit ? (
                  <input
                    className="ax-input mono"
                    style={{ width: 150, textAlign: 'right' }}
                    inputMode="numeric"
                    value={String(r.amountPlanned)}
                    onChange={(e) => setLocal(r.id, { amountPlanned: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
                    onBlur={(e) => persist(r.id, { amountPlanned: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
                    aria-label={t('bilan.col.planned')}
                  />
                ) : (
                  <span className="mono w-[150px] text-right text-[13px]">{formatAmount(r.amountPlanned, locale)}</span>
                )}
                <span className="mono w-[150px] text-right text-[13px] text-ink-3">{formatAmount(r.amountActual, locale)}</span>
                <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'bilanPoste', id, poste: r.poste })}>{t('common.detail')}</Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" icon aria-label={t('bilan.line.removed')} onClick={() => removeLine(r.id)}>
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <div className="text-[13px] text-ink-3">{op?.name}</div>
            <h1 className="text-[24px] font-medium">{t('bilan.editTitle')}</h1>
          </div>
        </div>
        <Button variant="glass" size="sm" onClick={() => navigate({ name: 'tresorerie', id })}>{t('tresorerie.title')}</Button>
      </div>

      {readOnly && <Banner tone="warning">{t('bilan.readonly')}</Banner>}

      {/* Totaux en direct — rangée d'indicateurs */}
      <KpiRow
        items={[
          { label: t('bilan.cost'), value: sum.coutTotal.format(locale) },
          { label: t('bilan.revenue'), value: sum.recettes.format(locale) },
          {
            label: `${t('bilan.margin')} · ${formatPercent(sum.tauxMarge, locale)}`,
            value: `${sum.marge.isNegative() ? '' : '+'}${sum.marge.format(locale)}`,
            accent: sum.marge.isNegative(),
          },
        ]}
      />

      {loading ? (
        <Panel>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 40 }} />
            ))}
          </div>
        </Panel>
      ) : (
        <>
          {section('cost')}
          {section('revenue')}
          {!canEdit && rows.length > 0 && (
            <Badge>
              {t('bilan.readonly')}
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
