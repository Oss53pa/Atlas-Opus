import { useState } from 'react';
import { Check } from 'lucide-react';
import { Brand, Button, ReadField, Select, useToast } from '../../ui';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';
import { COUNTRIES, getCountry } from '../../domain/country';
import { formatPercent } from '../../lib/format';
import { locale } from '../../i18n';

const STEPS: { n: number; key: MessageKey }[] = [
  { n: 1, key: 'onb.step.org' },
  { n: 2, key: 'onb.step.country' },
  { n: 3, key: 'onb.step.firstOp' },
];

/**
 * Handoff 30 — Onboarding tenant (création d'espace). Écran plein cadre,
 * assistant 3 étapes ; l'étape 2 fixe le pays et le cadre réglementaire, qui
 * conditionnent les calculs financiers et les gardes de passation
 * (country_config, invariant CLAUDE.md §3). Présentation : étape 2 active.
 */
export function OnboardingScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const [countryCode, setCountryCode] = useState('CI');
  const country = getCountry(countryCode);
  const active = 2;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-16 items-center px-4 sm:px-8" style={{ borderBottom: '1px solid var(--ax-border)' }}>
        <Brand size={20} />
        <span className="mono ml-auto text-[12px] text-ink-3">{t('onb.progress', { n: active, total: 3 })}</span>
      </header>

      <main className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-10 px-4 py-14 lg:grid-cols-[240px_1fr]">
        {/* Stepper */}
        <div className="flex flex-col gap-4">
          {STEPS.map((s) => {
            const done = s.n < active;
            const current = s.n === active;
            return (
              <div key={s.n} className="flex items-center gap-3">
                <span
                  className="mono flex h-7 w-7 items-center justify-center text-[12px]"
                  style={{
                    background: done ? 'var(--ax-accent)' : current ? 'var(--ax-surface-active)' : 'transparent',
                    color: done ? 'var(--ax-on-accent, #F8F6F0)' : current ? 'var(--ax-accent)' : 'var(--ax-text-disabled)',
                    border: `1px solid ${done || current ? 'var(--ax-accent)' : 'var(--ax-border)'}`,
                  }}
                >
                  {done ? <Check size={14} /> : s.n}
                </span>
                <span className="text-[14px]" style={{ color: current ? 'var(--ax-text)' : done ? 'var(--ax-text-2)' : 'var(--ax-text-disabled)', fontWeight: current ? 600 : 400 }}>
                  {t(s.key)}
                </span>
              </div>
            );
          })}
          <p className="mt-2 text-[12px] text-ink-3">{t('onb.hint')}</p>
        </div>

        {/* Form step 2 */}
        <div>
          <h1 className="text-[24px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('onb.country.title')}</h1>
          <p className="mt-1 text-[14px] text-ink-2">{t('onb.country.subtitle')}</p>

          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Select id="onb-country" label={t('onb.field.country')} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{t(c.nameKey as MessageKey)}</option>)}
            </Select>
            <ReadField label={t('onb.field.currency')} value={`${country?.currency ?? '—'} · ${country?.zone ?? ''}`} mono />
            <ReadField label={t('onb.field.regime')} value={t(country?.defaultProcurementMode === 'public' ? 'mode.public' : 'mode.private')} />
            <ReadField label={t('onb.field.vat')} value="18,00 %" mono />
            <ReadField label={t('onb.field.wht')} value="2,50 %" mono />
            <ReadField label={t('onb.field.retention')} value={formatPercent(country?.retentionDefault ?? 0.05, locale)} mono />
          </div>

          <div className="mt-5 px-4 py-3" style={{ background: 'var(--ax-surface-card)', border: '1px solid var(--ax-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium">{t('onb.holidays.title', { country: t((country?.nameKey ?? 'country.CI') as MessageKey) })}</span>
              <span className="mono text-[11px] text-ink-3">country_config</span>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">{t('onb.holidays.body', { n: 14 })}</p>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button variant="glass" size="sm" onClick={() => navigate({ name: 'workspaces' })}>{t('onb.back')}</Button>
            <div className="flex gap-2">
              <Button variant="glass" size="sm" onClick={() => { toast.push(t('onb.saved'), 'info'); navigate({ name: 'workspaces' }); }}>{t('onb.saveExit')}</Button>
              <Button variant="primary" size="sm" onClick={() => { toast.push(t('onb.continued'), 'success'); navigate({ name: 'create' }); }}>{t('onb.continue')}</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
