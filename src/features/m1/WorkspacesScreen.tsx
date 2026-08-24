import { ArrowRight, Plus } from 'lucide-react';
import { Badge, Brand, Button } from '../../ui';
import { useAuth } from '../../app/auth';
import { useNav } from '../../app/router';
import { t, type MessageKey } from '../../i18n';

interface Workspace { id: string; initials: string; name: string; sub: string; role: string; active?: boolean }

/**
 * Handoff 02 — Choix de l'espace de travail. Écran plein cadre (sans barre
 * latérale) : les droits et les données sont isolés par espace (tenant, RLS).
 * Présentation : la sélection ouvre le tableau de bord de l'espace.
 */
export function WorkspacesScreen() {
  const { mode, user, signOut } = useAuth();
  const { navigate } = useNav();
  const email = mode === 'supabase' ? (user?.email ?? '') : 'k.traore@atlas-mo.ci';

  const workspaces: Workspace[] = [
    { id: 'w1', initials: 'AI', name: 'Atlas Immobilier CI', sub: t('ws.sub', { n: 6, city: 'Abidjan', currency: 'XOF' }), role: 'moa_director', active: true },
    { id: 'w2', initials: 'SG', name: 'SGI Développement', sub: t('ws.sub', { n: 2, city: 'Dakar', currency: 'XOF' }), role: 'amo' },
    { id: 'w3', initials: 'MB', name: 'Ministère — Bouaké', sub: t('ws.subPublic'), role: 'viewer' },
  ];
  const roleLabel = (r: string) => t(`role.${r}` as MessageKey);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-16 items-center gap-3 border-b px-4 sm:px-8" style={{ borderColor: 'var(--ax-border)' }}>
        <Brand size={20} />
        <div className="ml-auto flex items-center gap-4">
          <span className="mono text-[12px] text-ink-3">{email}</span>
          <button className="text-[13px]" style={{ color: 'var(--ax-accent)' }} onClick={() => void signOut()}>{t('auth.signout')}</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 py-16">
        <h1 className="text-[28px] font-semibold" style={{ letterSpacing: '-0.02em' }}>{t('ws.title')}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{t('ws.subtitle')}</p>

        <div className="mt-8 flex flex-col gap-3">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className="flex items-center gap-4 px-4 py-4 text-left"
              style={{ background: 'var(--ax-surface-card)', border: `1px solid ${w.active ? 'var(--ax-accent)' : 'var(--ax-border)'}` }}
              onClick={() => navigate({ name: 'dashboard' })}
            >
              <span className="ax-avatar" aria-hidden="true" style={{ borderRadius: 0, width: 44, height: 44 }}>{w.initials}</span>
              <span className="flex-1">
                <span className="block text-[16px] font-medium">{w.name}</span>
                <span className="block text-[13px] text-ink-3">{w.sub}</span>
              </span>
              <Badge tone={w.active ? 'accent' : 'neutral'}>{roleLabel(w.role)}</Badge>
              <ArrowRight size={18} className="text-ink-3" />
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-6" style={{ borderColor: 'var(--ax-border)' }}>
          <p className="text-[13px] text-ink-3">{t('ws.missing')}</p>
          <div className="flex gap-2">
            <Button variant="glass" size="sm" onClick={() => navigate({ name: 'invitation' })}>{t('ws.viewInvite')}</Button>
            <Button variant="primary" size="sm" onClick={() => navigate({ name: 'onboarding' })}><Plus size={16} />{t('ws.create')}</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
