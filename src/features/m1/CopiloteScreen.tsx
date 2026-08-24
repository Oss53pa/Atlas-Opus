import { ChevronLeft, History, MessageSquarePlus, Send, FileText, ExternalLink } from 'lucide-react';
import { Button, FactList, Panel, StatCard, useToast, type Fact } from '../../ui';
import { useOperation, useBilan } from '../../app/providers';
import { useNav } from '../../app/router';
import { t, locale } from '../../i18n';
import { formatPercent } from '../../lib/format';

/**
 * Handoff 27 — Copilote PROPH3T (M22). Assistance contextuelle : l'IA ne prend
 * aucune décision et ne recalcule jamais un montant — les chiffres sont cités
 * depuis les modules (Bilan M4), jamais produits par le LLM (invariant CLAUDE.md
 * §5). IA locale d'abord (Ollama, sans rétention). Écran de présentation :
 * la conversation illustre le comportement attendu, l'envoi est simulé.
 */
export function CopiloteScreen({ id }: { id: string }) {
  const { navigate } = useNav();
  const toast = useToast();
  const { data: op } = useOperation(id);
  const { data: bilan } = useBilan(id);

  const marge = bilan ? bilan.summary.marge.format(locale) : '—';
  const tauxMarge = bilan ? formatPercent(bilan.summary.tauxMarge, locale) : '—';
  const tri = bilan && bilan.tri != null ? formatPercent(bilan.tri, locale) : '—';

  const guardFacts: Fact[] = [
    { label: t('copilote.guard.money'), sub: t('copilote.guard.money.sub'), severity: 'accent' },
    { label: t('copilote.guard.sovereign'), sub: t('copilote.guard.sovereign.sub'), severity: 'neutral' },
    { label: t('copilote.guard.citation'), sub: t('copilote.guard.citation.sub'), severity: 'neutral' },
    { label: t('copilote.guard.draft'), sub: t('copilote.guard.draft.sub'), severity: 'neutral' },
  ];

  const templates: { label: string; count: number }[] = [
    { label: t('copilote.tpl.pv'), count: 12 },
    { label: t('copilote.tpl.relance'), count: 4 },
    { label: t('copilote.tpl.synthese'), count: 6 },
    { label: t('copilote.tpl.analyse'), count: 1 },
  ];

  const Bubble = ({ from, children }: { from: 'user' | 'ai'; children: React.ReactNode }) => (
    <div className={from === 'user' ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed"
        style={from === 'user'
          ? { background: 'var(--ax-surface-active)', color: 'var(--ax-text)' }
          : { background: 'var(--ax-surface-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
      >
        {children}
      </div>
    </div>
  );

  const SourceChip = ({ children }: { children: React.ReactNode }) => (
    <span className="mono inline-block px-2 py-0.5 text-[11px] text-ink-3" style={{ border: '1px solid var(--ax-border)' }}>{children}</span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'cockpit', id })}><ChevronLeft size={18} /></Button>
          <div>
            <div className="text-[13px] text-ink-3">{t('copilote.context')}</div>
            <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('copilote.title')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" size="sm" onClick={() => toast.push(t('copilote.history.soon'), 'info')}><History size={15} />{t('copilote.history')}</Button>
          <Button variant="primary" size="sm" onClick={() => toast.push(t('copilote.new.soon'), 'info')}><MessageSquarePlus size={15} />{t('copilote.new')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel title={t('copilote.panel.title', { op: op?.name ?? '' })} meta={t('copilote.panel.meta')}>
          <div className="flex flex-col gap-3">
            <Bubble from="user">{t('copilote.q1')}</Bubble>
            <Bubble from="ai">
              <p>{t('copilote.a1.line1', { marge, taux: tauxMarge, tri })}</p>
              <p className="mt-2">{t('copilote.a1.line2')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <SourceChip>M4 · bilan_lines</SourceChip>
                <SourceChip>M14 · change_orders</SourceChip>
                <SourceChip>M12 · baseline</SourceChip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="glass" size="sm" onClick={() => toast.push(t('copilote.note.soon'), 'info')}><FileText size={14} />{t('copilote.action.note')}</Button>
                <Button variant="glass" size="sm" onClick={() => navigate({ name: 'bilan', id })}><ExternalLink size={14} />{t('copilote.action.bilan')}</Button>
              </div>
            </Bubble>
            <Bubble from="user">{t('copilote.q2')}</Bubble>
            <Bubble from="ai">
              <p>{t('copilote.a2')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => toast.push(t('copilote.draft.soon'), 'info')}>{t('copilote.action.openDraft')}</Button>
                <Button variant="glass" size="sm" onClick={() => toast.push(t('copilote.diffuse.soon'), 'info')}>{t('copilote.action.diffuse')}</Button>
              </div>
            </Bubble>
          </div>

          <div className="mt-4 flex gap-2">
            <input className="ax-input flex-1" placeholder={t('copilote.input.placeholder')} aria-label={t('copilote.input.placeholder')} readOnly onFocus={() => toast.push(t('copilote.input.soon'), 'info')} />
            <Button variant="primary" size="sm" onClick={() => toast.push(t('copilote.input.soon'), 'info')}><Send size={15} />{t('copilote.send')}</Button>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t('copilote.guardrails')} meta="RG-M22-01 à 05" bodyPadded={false}>
            <FactList items={guardFacts} />
          </Panel>
          <Panel title={t('copilote.templates')} meta={t('copilote.templates.meta')} bodyPadded={false}>
            <FactList items={templates.map((tp) => ({ label: tp.label, value: <span className="mono">{t('copilote.templates.count', { n: tp.count })}</span> }))} />
          </Panel>
        </div>
      </div>

      <Panel title={t('copilote.executions')} meta={t('copilote.executions.meta')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('copilote.exec.requests')}>214</StatCard>
          <StatCard label={t('copilote.exec.local')} emphasis>100 %</StatCard>
          <StatCard label={t('copilote.exec.fallback')}>0</StatCard>
          <StatCard label={t('copilote.exec.breaker')}>{t('copilote.exec.breaker.closed')}</StatCard>
        </div>
      </Panel>

      <div className="text-[12px] text-ink-3">{t('copilote.subtitle')}</div>
    </div>
  );
}
