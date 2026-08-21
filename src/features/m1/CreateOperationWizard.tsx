import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Field, Money, Select, useToast } from '../../ui';
import { categoryLabel, countryLabel, opTypeLabel } from './labels';
import { useData } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { getCountry } from '../../domain/country';
import {
  OP_TYPES,
  PROGRAM_CATEGORIES,
  type OpType,
  type ProgramCategory,
  type ProgramItemDraft,
} from '../../domain/m1/types';
import { validateOperationInput } from '../../domain/m1/validation';
import { endDateValid } from '../../domain/m1/rules';

const STEPS = ['create.step.identity', 'create.step.scope', 'create.step.program'] as const;

export function CreateOperationWizard() {
  const { ops, countries } = useData();
  const { navigate } = useNav();
  const toast = useToast();

  const [step, setStep] = useState(0); // 0..2 étapes, 3 = récap
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Identité
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [opType, setOpType] = useState<OpType>('residential');
  // Cadrage
  const [budgetBac, setBudgetBac] = useState('');
  const [retentionPct, setRetentionPct] = useState('5');
  const [retentionTouched, setRetentionTouched] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Programme
  const [program, setProgram] = useState<ProgramItemDraft[]>([]);
  const [draft, setDraft] = useState<ProgramItemDraft>({ category: 'surface', label: '', targetValue: '', unit: '' });

  useEffect(() => {
    ops.existingNames().then(setExistingNames);
  }, [ops]);

  const country = getCountry(countryCode);

  function onCountryChange(code: string) {
    setCountryCode(code);
    const c = getCountry(code);
    if (c && !retentionTouched) setRetentionPct(String(Math.round(c.retentionDefault * 1000) / 10));
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      const v = validateOperationInput({ name, countryCode, opType }, { existingNames });
      if (v.name) e.name = v.name;
      if (v.countryCode) e.countryCode = v.countryCode;
      if (v.opType) e.opType = v.opType;
    }
    if (s === 1 && !endDateValid(startDate || null, endDate || null)) e.endDate = 'operation.error.endDate';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => s + 1);
  }
  function prev() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  function addDraft() {
    if (!draft.label.trim()) return;
    setProgram((p) => [...p, { ...draft, label: draft.label.trim() }]);
    setDraft({ category: 'surface', label: '', targetValue: '', unit: '' });
  }

  async function submit() {
    if (!validateStep(0) || !validateStep(1)) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      const op = await ops.create({
        name,
        countryCode,
        opType,
        budgetBac: budgetBac ? Number(budgetBac) : 0,
        retentionRate: Number(retentionPct) / 100,
        startDate: startDate || null,
        endDate: endDate || null,
        program,
      });
      toast.push(t('create.success', { name: op.name }), 'success');
      navigate({ name: 'cockpit', id: op.id });
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? <span className="mt-1 block text-[12px] text-danger">{t(errors[k] as MessageKey)}</span> : null;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'portfolio' })}>
          <ChevronLeft size={18} />
        </Button>
        <h1 className="text-[24px] font-medium">{t('create.title')}</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((key, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <div key={key} className="flex flex-1 items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]"
                style={{
                  background: state === 'todo' ? 'var(--ax-glass-subtle)' : 'var(--ax-accent)',
                  color: state === 'todo' ? 'var(--ax-text-3)' : 'var(--ax-on-accent)',
                  fontWeight: 500,
                }}
              >
                {state === 'done' ? <Check size={14} /> : i + 1}
              </span>
              <span className="hidden text-[13px] sm:inline" style={{ color: state === 'current' ? 'var(--ax-text)' : 'var(--ax-text-3)' }}>
                {t(key)}
              </span>
              {i < STEPS.length - 1 && <span className="ax-divider flex-1" />}
            </div>
          );
        })}
      </div>

      <Card tone="strong">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <Field id="op-name" label={t('operation.field.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              {err('name')}
            </div>
            <div>
              <Select id="op-country" label={t('operation.field.country')} value={countryCode} onChange={(e) => onCountryChange(e.target.value)}>
                <option value="">{t('operation.field.country.placeholder')}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryLabel(c.code)} · {c.zone}
                  </option>
                ))}
              </Select>
              {country && <span className="mt-1 block text-[12px] text-ink-3">{t('operation.field.inherited', { currency: country.currency })}</span>}
              {err('countryCode')}
            </div>
            <div>
              <Select id="op-type" label={t('operation.field.type')} value={opType} onChange={(e) => setOpType(e.target.value as OpType)}>
                {OP_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {opTypeLabel(o)}
                  </option>
                ))}
              </Select>
              {err('opType')}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field
              id="op-budget"
              label={`${t('operation.field.budget')} (${t('common.optional')})`}
              inputMode="numeric"
              value={budgetBac}
              onChange={(e) => setBudgetBac(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
            />
            <Field
              id="op-retention"
              label={`${t('operation.field.retention')} (%)`}
              inputMode="decimal"
              value={retentionPct}
              onChange={(e) => {
                setRetentionTouched(true);
                setRetentionPct(e.target.value.replace(/[^\d.,]/g, ''));
              }}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="op-start" type="date" label={t('operation.field.start')} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <div>
                <Field id="op-end" type="date" label={t('operation.field.end')} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                {err('endDate')}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select id="pi-cat" label={t('program.field.category')} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ProgramCategory }))}>
                {PROGRAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
              <Field id="pi-label" label={t('program.field.label')} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
              <Field id="pi-target" label={t('program.field.target')} value={draft.targetValue ?? ''} onChange={(e) => setDraft((d) => ({ ...d, targetValue: e.target.value }))} placeholder={t('program.field.target.ph')} />
              <Field id="pi-unit" label={t('program.field.unit')} value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder={t('program.field.unit.ph')} />
            </div>
            <div>
              <Button variant="glass" size="sm" onClick={addDraft}>
                <Plus size={16} />
                {t('create.program.add')}
              </Button>
            </div>
            {program.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t('create.program.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {program.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: 'var(--ax-glass-subtle)' }}>
                    <span className="text-[13px]">
                      <span className="text-ink-3">{categoryLabel(p.category)} · </span>
                      {p.label}
                      {p.targetValue ? <span className="mono text-ink-2"> — {p.targetValue} {p.unit}</span> : null}
                    </span>
                    <Button variant="ghost" size="sm" icon aria-label={t('program.removed')} onClick={() => setProgram((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-medium">{t('create.step.recap')}</h2>
            <dl className="grid grid-cols-1 gap-y-2 text-[14px] sm:grid-cols-2">
              <RecapRow label={t('operation.field.name')} value={name} />
              <RecapRow label={t('operation.field.country')} value={countryLabel(countryCode)} />
              <RecapRow label={t('operation.field.type')} value={opTypeLabel(opType)} />
              <RecapRow label={t('operation.field.currency')} value={country?.currency ?? '—'} />
              <RecapRow label={t('operation.field.budget')} value={<Money amount={budgetBac ? Number(budgetBac) : 0} currency={country?.currency} />} />
              <RecapRow label={t('operation.field.retention')} value={`${retentionPct} %`} />
              <RecapRow label={t('create.recap.program', { count: program.length })} value="" />
            </dl>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={prev} disabled={step === 0}>
          <ChevronLeft size={16} />
          {t('common.previous')}
        </Button>
        {step < 3 ? (
          <Button variant="primary" onClick={next}>
            {t('common.next')}
            <ChevronRight size={16} />
          </Button>
        ) : (
          <Button variant="primary" onClick={submit} disabled={submitting}>
            <Check size={16} />
            {t('create.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 sm:border-0" style={{ borderColor: 'var(--ax-border)' }}>
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
