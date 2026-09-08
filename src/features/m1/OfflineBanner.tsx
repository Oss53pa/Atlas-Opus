/**
 * F3 — bannière d'état hors-ligne / file de synchro (branchement UI).
 * Visible hors-ligne, s'il reste des mutations en attente, ou si des mutations
 * ont échoué de façon terminale (conflit/rejet). Textes via i18n (aucun libellé
 * en dur). « Synchroniser » : en ligne, avec des éléments en attente et un
 * transport branché. « Ignorer » : présent dès qu'il y a des échecs à trancher.
 */
import { CloudOff, RefreshCw, X } from 'lucide-react';
import { Banner, Button } from '../../ui';
import { useOffline } from '../../app/offline';
import { t } from '../../i18n';

export function OfflineBanner() {
  const { online, pendingCount, conflictCount, rejectedCount, canSync, flush, discardResolved } = useOffline();
  const failed = conflictCount + rejectedCount;
  if (online && pendingCount === 0 && failed === 0) return null;

  const parts: string[] = [];
  if (!online) parts.push(t('etats.offline'));
  if (pendingCount > 0) parts.push(t('etats.offline.pending', { n: pendingCount }));
  if (conflictCount > 0) parts.push(t('etats.offline.conflict', { n: conflictCount }));
  if (rejectedCount > 0) parts.push(t('etats.offline.rejected', { n: rejectedCount }));
  const message = parts.join(' · ');

  // Un échec terminal (conflit/rejet) prime : sévérité danger.
  const tone = failed > 0 ? 'danger' : online ? 'warning' : 'info';

  return (
    <div style={{ marginBottom: 12 }}>
      <Banner
        tone={tone}
        icon={<CloudOff size={16} aria-hidden />}
        action={
          <span className="flex items-center gap-2">
            {online && pendingCount > 0 && canSync && (
              <Button variant="ghost" size="sm" onClick={() => void flush()}>
                <RefreshCw size={14} aria-hidden style={{ marginRight: 6 }} />
                {t('etats.offline.sync')}
              </Button>
            )}
            {failed > 0 && (
              <Button variant="ghost" size="sm" onClick={() => discardResolved()}>
                <X size={14} aria-hidden style={{ marginRight: 6 }} />
                {t('etats.offline.discard')}
              </Button>
            )}
          </span>
        }
      >
        {message}
      </Banner>
    </div>
  );
}
