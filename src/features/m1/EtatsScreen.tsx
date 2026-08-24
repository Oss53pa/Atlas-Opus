import { ChevronLeft, WifiOff, ShieldX, SearchX, AlertCircle, RefreshCw } from 'lucide-react';
import { Banner, Button, EmptyState, Panel, Skeleton } from '../../ui';
import { useNav } from '../../app/router';
import { t } from '../../i18n';

/**
 * Handoff 28 — États globaux. Écran de référence des états transverses de
 * l'application : hors-ligne, accès refusé (403), page introuvable (404),
 * chargement (squelette, jamais de spinner), erreur avec réessai, état vide.
 * C'est la direction à réutiliser partout — aucune donnée réelle ici.
 */
export function EtatsScreen() {
  const { navigate } = useNav();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon aria-label={t('common.back')} onClick={() => navigate({ name: 'dashboard' })}><ChevronLeft size={18} /></Button>
        <div>
          <div className="text-[13px] text-ink-3">{t('etats.context')}</div>
          <h1 className="text-[24px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{t('etats.title')}</h1>
        </div>
      </div>

      {/* Mode hors-ligne (F3) */}
      <Banner tone="info" icon={<WifiOff size={16} />} action={<Button size="sm" variant="glass">{t('etats.offline.sync')}</Button>}>
        {t('etats.offline')} · {t('etats.offline.pending', { n: 4 })}
      </Banner>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 403 */}
        <Panel title={t('etats.403.title')} meta={t('etats.403.meta')}>
          <div className="flex flex-col items-start gap-3">
            <ShieldX size={28} style={{ color: 'var(--ax-danger)' }} />
            <h2 className="text-[18px] font-semibold">{t('etats.403.heading')}</h2>
            <p className="text-[13px] text-ink-2">{t('etats.403.body')}</p>
            <div className="flex gap-2">
              <Button variant="primary" size="sm">{t('etats.403.request')}</Button>
              <Button variant="glass" size="sm">{t('etats.403.back')}</Button>
            </div>
          </div>
        </Panel>

        {/* 404 */}
        <Panel title={t('etats.404.title')} meta={t('etats.404.meta')}>
          <div className="flex flex-col items-start gap-3">
            <SearchX size={28} style={{ color: 'var(--ax-text-3)' }} />
            <h2 className="text-[18px] font-semibold">{t('etats.404.heading')}</h2>
            <p className="text-[13px] text-ink-2">{t('etats.404.body')}</p>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => navigate({ name: 'dashboard' })}>{t('etats.404.home')}</Button>
              <Button variant="glass" size="sm">{t('etats.404.search')}</Button>
            </div>
          </div>
        </Panel>

        {/* Chargement (skeleton) */}
        <Panel title={t('etats.loading.title')} meta={t('etats.loading.meta')}>
          <div className="flex flex-col gap-3">
            <Skeleton style={{ height: 12, width: '40%' }} />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 56 }} />)}
            </div>
            <Skeleton style={{ height: 12, width: '80%' }} />
            <Skeleton style={{ height: 12, width: '55%' }} />
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{t('etats.loading.note')}</p>
        </Panel>

        {/* Erreur + vide */}
        <Panel title={t('etats.error.title')} meta={t('etats.error.meta')}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 p-3" style={{ border: '1px solid var(--ax-danger)' }}>
              <span className="flex items-center gap-2 text-[14px]"><AlertCircle size={16} style={{ color: 'var(--ax-danger)' }} />{t('etats.error.body')}</span>
              <Button variant="glass" size="sm"><RefreshCw size={14} />{t('etats.error.retry')}</Button>
            </div>
            <div style={{ border: '1px dashed var(--ax-border-strong)' }}>
              <EmptyState title={t('etats.empty.title')} description={t('etats.empty.body')} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="text-[12px] text-ink-3">{t('etats.subtitle')}</div>
    </div>
  );
}
