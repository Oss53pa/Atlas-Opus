/**
 * F3 — bannière d'état hors-ligne / file en attente (branchement UI).
 * Visible dès que le réseau est coupé OU qu'il reste des mutations à
 * synchroniser. Textes via i18n (aucun libellé en dur). Bouton « Synchroniser »
 * uniquement en ligne, avec des éléments en attente et un transport branché.
 */
import { CloudOff, RefreshCw } from 'lucide-react';
import { Banner, Button } from '../../ui';
import { useOffline } from '../../app/offline';
import { t } from '../../i18n';

export function OfflineBanner() {
  const { online, pendingCount, canSync, flush } = useOffline();
  if (online && pendingCount === 0) return null;

  const parts = [online ? null : t('etats.offline')];
  if (pendingCount > 0) parts.push(t('etats.offline.pending', { n: pendingCount }));
  const message = parts.filter(Boolean).join(' · ');

  return (
    <div style={{ marginBottom: 12 }}>
      <Banner
        tone={online ? 'warning' : 'info'}
        icon={<CloudOff size={16} aria-hidden />}
        action={
          online && pendingCount > 0 && canSync ? (
            <Button variant="ghost" size="sm" onClick={() => void flush()}>
              <RefreshCw size={14} aria-hidden style={{ marginRight: 6 }} />
              {t('etats.offline.sync')}
            </Button>
          ) : undefined
        }
      >
        {message}
      </Banner>
    </div>
  );
}
