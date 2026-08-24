import { Badge, Brand, Button, useToast } from '../../ui';
import { useNav } from '../../app/router';
import { t } from '../../i18n';

/**
 * Handoff 29 — Acceptation d'invitation. Écran plein cadre d'entrée d'un
 * nouvel utilisateur : espace, rôle proposé et périmètre d'opérations.
 * Présentation : accepter ouvre l'espace, refuser revient au choix d'espace.
 */
export function InvitationScreen() {
  const { navigate } = useNav();
  const toast = useToast();

  const ops: { name: string; phase: string }[] = [
    { name: 'Résidence Bellevue', phase: t('operation.phase.realisation') },
    { name: 'Centre d’affaires Plateau', phase: t('operation.phase.passation') },
  ];

  const Row = ({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) => (
    <div className="flex items-center justify-between gap-3 px-4 py-3" style={last ? undefined : { borderBottom: '1px solid var(--ax-border-subtle)' }}>
      <span className="text-[14px] text-ink-2">{label}</span>
      <span className="text-[14px] font-medium">{value}</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-16 items-center px-4 sm:px-8" style={{ borderBottom: '1px solid var(--ax-border)' }}>
        <Brand size={20} />
      </header>

      <main className="mx-auto w-full max-w-[560px] px-4 py-16">
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{t('invite.label')}</div>
        <h1 className="mt-2 text-[26px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('invite.title', { org: 'Atlas Immobilier CI' })}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{t('invite.subtitle', { by: 'K. Traoré' })}</p>

        <div className="mt-6" style={{ background: 'var(--ax-surface-card)', border: '1px solid var(--ax-border)' }}>
          <Row label={t('invite.space')} value="Atlas Immobilier CI · Abidjan" />
          <Row label={t('invite.role')} value={<Badge tone="accent">{t('role.amo')}</Badge>} />
          <Row label={t('invite.scope')} value={t('invite.scopeValue', { n: 2 })} last />
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--ax-border-subtle)' }}>
            {ops.map((o) => (
              <div key={o.name} className="flex items-center justify-between py-1 text-[13px]">
                <span>{o.name}</span>
                <span className="mono text-ink-3">{o.phase}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[13px] text-ink-3">{t('invite.roleNote')}</p>

        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { toast.push(t('invite.accepted'), 'success'); navigate({ name: 'dashboard' }); }}>{t('invite.accept')}</Button>
          <Button variant="glass" onClick={() => navigate({ name: 'workspaces' })}>{t('invite.decline')}</Button>
        </div>
        <p className="mono mt-4 text-[12px] text-ink-3">{t('invite.footer', { date: '19.08.2026', days: 12 })}</p>
      </main>
    </div>
  );
}
