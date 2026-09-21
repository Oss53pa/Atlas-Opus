import { useEffect, useState } from 'react';
import { Plus, Trash2, MapPin, ArrowUpRight } from 'lucide-react';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Field, KpiRow, Panel, Select, Skeleton, useToast, type TableRowData } from '../../ui';
import { countryLabel } from './labels';
import { useData, useLandOpportunities } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale, type MessageKey } from '../../i18n';
import { formatAmount, formatDate, formatPercent } from '../../lib/format';
import { Money } from '../../domain/money/Money';
import {
  activeOpportunities, canConvert, chargeAuM2, chargeFonciereAdmissible, constructibilityRatio,
  margeDeNegociation, scoreOpportunity, suggestedDecision,
  DECISIONS, OPPORTUNITY_STATUSES, PROPERTY_TYPES,
  type Decision, type LandOpportunity, type OpportunityStatus, type PropertyType,
} from '../../domain/landOpportunity';
import { can } from '../../domain/m1/permissions';

const DECISION_TONE: Record<Decision, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'neutral', go: 'success', conditional_go: 'warning', no_go: 'danger', postponed: 'info',
};
const STATUS_TONE: Record<OpportunityStatus, 'neutral' | 'info' | 'warning' | 'accent' | 'success' | 'danger'> = {
  prospection: 'neutral', etude: 'info', negociation: 'warning', sous_conditions: 'accent', acquise: 'success', abandonnee: 'danger',
};
const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
const lbl = (prefix: string, v: string) => t(`${prefix}.${v}` as MessageKey);

/**
 * M2 (amont) — Pipeline d'opportunités foncières (transposé d'Advancity).
 * Repérage, scoring indicatif, arbitrage go / no go, simulateur de charge
 * foncière (bilan promoteur inversé) et conversion en opération : l'opération
 * naît en phase amont, son bilan amorcé au poste « foncier » du prix négocié.
 */
export function FoncierScreen() {
  const { landOpportunities, ops, bilan, countries, session } = useData();
  const { navigate } = useNav();
  const toast = useToast();
  const { data: loaded, loading } = useLandOpportunities();

  const [rows, setRows] = useState<LandOpportunity[]>([]);
  useEffect(() => { if (loaded) setRows(loaded); }, [loaded]);

  // Arbitrage foncier = décision d'engager une opération : réservé à la direction.
  const canEdit = can(session.role, 'op.create');
  const emptyDraft = {
    reference: '', name: '', propertyType: 'terrain_nu' as PropertyType, countryCode: countries[0]?.code ?? 'CI',
    city: '', totalSurface: '', buildableSurface: '', priceAsked: '', estimatedValue: '', probability: '50',
  };
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [simId, setSimId] = useState('');
  const [sim, setSim] = useState({ ca: '', construction: '', autres: '', marge: '12' });

  const currencyOf = (code: string) => countries.find((c) => c.code === code)?.currency ?? 'XOF';
  const money = (n: number, code: string) => `${formatAmount(n, locale)} ${currencyOf(code)}`;
  const active = activeOpportunities(rows);
  const avgScore = rows.length === 0 ? 0 : Math.round(rows.reduce((a, o) => a + scoreOpportunity(o), 0) / rows.length);

  async function add() {
    if (!draft.reference.trim() || !draft.name.trim()) return;
    const rec = await landOpportunities.add({
      reference: draft.reference, name: draft.name, propertyType: draft.propertyType, countryCode: draft.countryCode,
      city: draft.city || null, totalSurface: digits(draft.totalSurface), buildableSurface: digits(draft.buildableSurface),
      priceAsked: digits(draft.priceAsked), estimatedValue: digits(draft.estimatedValue),
      probability: Math.min(1, digits(draft.probability) / 100),
    });
    setRows((r) => [rec, ...r]);
    setDraft(emptyDraft);
    setAdding(false);
    toast.push(t('landopp.added'), 'success');
  }
  async function patch(o: LandOpportunity, p: { status?: OpportunityStatus; decision?: Decision }) {
    const rec = await landOpportunities.update(o.id, p);
    setRows((r) => r.map((x) => (x.id === o.id ? rec : x)));
  }
  async function remove(o: LandOpportunity) {
    await landOpportunities.remove(o.id);
    setRows((r) => r.filter((x) => x.id !== o.id));
    toast.push(t('landopp.removed'), 'info');
  }
  async function convert(o: LandOpportunity) {
    // Passe par la création d'opération standard (RG-M1 : phase amont, devise héritée du pays).
    const op = await ops.create({ name: o.name, countryCode: o.countryCode, opType: 'residential' });
    if (o.priceAsked > 0) await bilan.addLine(op.id, { kind: 'cost', poste: 'foncier', amountPlanned: o.priceAsked });
    const rec = await landOpportunities.update(o.id, { operationId: op.id, status: 'acquise' });
    setRows((r) => r.map((x) => (x.id === o.id ? rec : x)));
    toast.push(t('landopp.converted'), 'success');
    navigate({ name: 'cockpit', id: op.id });
  }

  // ── Simulateur de charge foncière ──
  const simOpp = rows.find((o) => o.id === simId) ?? rows[0] ?? null;
  const simCur = simOpp ? currencyOf(simOpp.countryCode) : 'XOF';
  const simResult = simOpp && digits(sim.ca) > 0
    ? chargeFonciereAdmissible({
        caPrevisionnel: Money.of(digits(sim.ca), simCur),
        coutsConstruction: Money.of(digits(sim.construction), simCur),
        autresCouts: Money.of(digits(sim.autres), simCur),
        margeCibleRate: (Number(sim.marge.replace(',', '.')) || 0) / 100,
      })
    : null;
  const simM2 = simResult && simOpp ? chargeAuM2(simResult.chargeAdmissible, simOpp.buildableSurface) : null;
  const simNego = simResult && simOpp ? margeDeNegociation(simResult.chargeAdmissible, Money.of(simOpp.priceAsked, simCur)) : null;

  const tableRows: TableRowData[] = rows.map((o) => {
    const score = scoreOpportunity(o);
    return {
      cells: [
        <span>
          <span className="block font-medium">{o.name}</span>
          <span className="block text-[12px] text-ink-3">
            <span className="mono">{o.reference}</span> · {lbl('landopp.property', o.propertyType)} · {o.city ?? countryLabel(o.countryCode)}
          </span>
          <span className="block text-[12px] text-ink-3">
            {o.totalSurface.toLocaleString(locale)} m² · COS {constructibilityRatio(o).toFixed(2)} · {formatDate(o.discoveryDate, locale)}
          </span>
        </span>,
        <span className="text-right">
          <span className="mono block">{money(o.priceAsked, o.countryCode)}</span>
          <span className="block text-[11px] text-ink-3">{t('landopp.col.probability', { pct: formatPercent(o.probability, locale, 0) })}</span>
        </span>,
        <span className="text-right">
          <span className="mono block text-[15px]" style={{ color: 'var(--ax-accent-strong)' }}>{score}</span>
          <span className="block text-[11px] text-ink-3">{t('landopp.suggested', { d: lbl('landopp.decision', suggestedDecision(score)) })}</span>
        </span>,
        canEdit ? (
          <span className="flex flex-col gap-1">
            <Select id={`lo-st-${o.id}`} value={o.status} onChange={(e) => patch(o, { status: e.target.value as OpportunityStatus })} disabled={o.operationId !== null}>
              {OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{lbl('landopp.status', s)}</option>)}
            </Select>
            <Select id={`lo-dec-${o.id}`} value={o.decision} onChange={(e) => patch(o, { decision: e.target.value as Decision })} disabled={o.operationId !== null}>
              {DECISIONS.map((d) => <option key={d} value={d}>{lbl('landopp.decision', d)}</option>)}
            </Select>
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <Badge tone={STATUS_TONE[o.status]}>{lbl('landopp.status', o.status)}</Badge>
            <Badge tone={DECISION_TONE[o.decision]}>{lbl('landopp.decision', o.decision)}</Badge>
          </span>
        ),
        <span className="flex justify-end gap-1">
          {o.operationId ? (
            <Button variant="glass" size="sm" onClick={() => navigate({ name: 'cockpit', id: o.operationId as string })}><ArrowUpRight size={14} />{t('landopp.open')}</Button>
          ) : canEdit && canConvert(o) ? (
            <Button variant="primary" size="sm" onClick={() => convert(o)}><ArrowUpRight size={14} />{t('landopp.convert')}</Button>
          ) : null}
          {canEdit && o.operationId === null && (
            <Button variant="ghost" size="sm" icon aria-label={t('landopp.removed')} onClick={() => remove(o)}><Trash2 size={15} /></Button>
          )}
        </span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] text-ink-3"><MapPin size={12} className="mb-0.5 inline" /> {t('landopp.kicker')}</div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('landopp.title')}</h1>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setAdding((a) => !a)}><Plus size={16} />{t('landopp.add')}</Button>}
      </div>

      <KpiRow
        items={[
          { label: t('landopp.kpi.total'), value: rows.length },
          { label: t('landopp.kpi.active'), value: active.length },
          { label: t('landopp.kpi.go'), value: rows.filter((o) => canConvert(o)).length, accent: rows.some((o) => canConvert(o)) },
          { label: t('landopp.kpi.score'), value: avgScore },
        ]}
      />

      {adding && canEdit && (
        <Panel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="lo-ref" label={t('landopp.field.reference')} value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} placeholder="OPP-2026-003" />
            <Field id="lo-name" label={t('landopp.field.name')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Select id="lo-type" label={t('landopp.field.propertyType')} value={draft.propertyType} onChange={(e) => setDraft((d) => ({ ...d, propertyType: e.target.value as PropertyType }))}>
              {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{lbl('landopp.property', p)}</option>)}
            </Select>
            <Select id="lo-country" label={t('landopp.field.country')} value={draft.countryCode} onChange={(e) => setDraft((d) => ({ ...d, countryCode: e.target.value }))}>
              {countries.map((c) => <option key={c.code} value={c.code}>{countryLabel(c.code)}</option>)}
            </Select>
            <Field id="lo-city" label={t('landopp.field.city')} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
            <Field id="lo-prob" label={t('landopp.field.probability')} inputMode="numeric" value={draft.probability} onChange={(e) => setDraft((d) => ({ ...d, probability: e.target.value }))} />
            <Field id="lo-surf" label={t('landopp.field.totalSurface')} inputMode="numeric" value={draft.totalSurface} onChange={(e) => setDraft((d) => ({ ...d, totalSurface: e.target.value }))} />
            <Field id="lo-build" label={t('landopp.field.buildableSurface')} inputMode="numeric" value={draft.buildableSurface} onChange={(e) => setDraft((d) => ({ ...d, buildableSurface: e.target.value }))} />
            <Field id="lo-price" label={t('landopp.field.priceAsked', { cur: currencyOf(draft.countryCode) })} inputMode="numeric" value={draft.priceAsked} onChange={(e) => setDraft((d) => ({ ...d, priceAsked: e.target.value }))} />
            <Field id="lo-value" label={t('landopp.field.estimatedValue', { cur: currencyOf(draft.countryCode) })} inputMode="numeric" value={draft.estimatedValue} onChange={(e) => setDraft((d) => ({ ...d, estimatedValue: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={add}>{t('common.create')}</Button>
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 52 }} />)}</div></Panel>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t('landopp.title')} description={t('landopp.empty')} /></Card>
      ) : (
        <Panel title={t('landopp.pipeline')} meta="M2" bodyPadded={false}>
          <DataTable
            template="2.2fr 1.1fr 0.8fr 1.2fr auto"
            columns={[
              { label: t('landopp.col.opportunity') },
              { label: t('landopp.col.price'), align: 'right' },
              { label: t('landopp.col.score'), align: 'right' },
              { label: t('landopp.col.decision') },
              { label: '' },
            ]}
            rows={tableRows}
          />
        </Panel>
      )}

      {rows.length > 0 && (
        <Panel title={t('landopp.sim.title')} meta={t('landopp.sim.meta')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Select id="sim-opp" label={t('landopp.sim.pick')} value={simOpp?.id ?? ''} onChange={(e) => setSimId(e.target.value)}>
              {rows.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
            <Field id="sim-ca" label={t('landopp.sim.ca')} inputMode="numeric" value={sim.ca} onChange={(e) => setSim((s) => ({ ...s, ca: e.target.value }))} />
            <Field id="sim-constr" label={t('landopp.sim.construction')} inputMode="numeric" value={sim.construction} onChange={(e) => setSim((s) => ({ ...s, construction: e.target.value }))} />
            <Field id="sim-autres" label={t('landopp.sim.autres')} inputMode="numeric" value={sim.autres} onChange={(e) => setSim((s) => ({ ...s, autres: e.target.value }))} />
            <Field id="sim-marge" label={t('landopp.sim.marge')} inputMode="decimal" value={sim.marge} onChange={(e) => setSim((s) => ({ ...s, marge: e.target.value }))} />
          </div>
          {simResult && simOpp ? (
            <>
              <div className="mt-4">
                <KpiRow
                  items={[
                    { label: t('landopp.sim.result'), value: money(simResult.chargeAdmissible.toMajorNumber(), simOpp.countryCode), accent: simResult.chargeAdmissible.isNegative() },
                    { label: t('landopp.sim.perM2'), value: simM2 ? money(simM2.toMajorNumber(), simOpp.countryCode) : '—' },
                    { label: t('landopp.col.price'), value: money(simOpp.priceAsked, simOpp.countryCode) },
                    { label: t('landopp.sim.nego'), value: simNego ? money(simNego.toMajorNumber(), simOpp.countryCode) : '—', accent: simNego?.isNegative() ?? false },
                  ]}
                />
              </div>
              {simNego?.isNegative() && <div className="mt-3"><Banner tone="danger">{t('landopp.sim.tooExpensive')}</Banner></div>}
            </>
          ) : (
            <div className="mt-3 text-[13px] text-ink-3">{t('landopp.sim.hint')}</div>
          )}
        </Panel>
      )}

      <div className="text-[12px] text-ink-3">{t('landopp.subtitle')}</div>
    </div>
  );
}
