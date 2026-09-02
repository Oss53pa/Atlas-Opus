import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Menu, X, LogOut, ChevronRight, Search, Users } from 'lucide-react';
import { Brand, Button } from '../../ui';
import { useNav, type Route } from '../../app/router';
import { useAuth } from '../../app/auth';
import { useOperation, useOperations } from '../../app/providers';
import { t, locale, type MessageKey } from '../../i18n';
import { formatPercent } from '../../lib/format';
import { phaseLabel } from './labels';
import type { Role } from '../../domain/m1/types';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** Route names portant un id d'opération. */
type OpRouteName = Exclude<Route['name'], 'dashboard' | 'portfolio' | 'create'>;

interface ModuleDef {
  code: string;
  labelKey: MessageKey;
  /** Route cible si l'écran existe ; sinon « à venir ». */
  route?: OpRouteName;
}
interface FamilyDef {
  key: string;
  labelKey: MessageKey;
  modules: ModuleDef[];
}

/** Les 6 familles du handoff → modules mappés aux écrans existants. */
const FAMILIES: FamilyDef[] = [
  {
    key: 'amont',
    labelKey: 'nav.family.amont',
    modules: [
      { code: 'M1', labelKey: 'mod.m1', route: 'program' },
      { code: 'M2', labelKey: 'mod.m2', route: 'compliance' },
      { code: 'M3', labelKey: 'mod.m3', route: 'etudes' },
    ],
  },
  {
    key: 'finance',
    labelKey: 'nav.family.finance',
    modules: [
      { code: 'M4', labelKey: 'mod.m4', route: 'bilan' },
      { code: 'M5', labelKey: 'mod.m5', route: 'financing' },
      { code: 'M6', labelKey: 'mod.m6', route: 'commercialisation' },
      { code: 'M16', labelKey: 'mod.m16', route: 'payments' },
      { code: 'M17', labelKey: 'mod.m17', route: 'cautions' },
    ],
  },
  {
    key: 'contractuel',
    labelKey: 'nav.family.contractuel',
    modules: [
      { code: 'M7', labelKey: 'mod.m7', route: 'stakeholders' },
      { code: 'M8', labelKey: 'mod.m8', route: 'passation' },
      { code: 'M9', labelKey: 'mod.m9', route: 'analyse' },
      { code: 'M10', labelKey: 'mod.m10', route: 'achats' },
    ],
  },
  {
    key: 'conception',
    labelKey: 'nav.family.conception',
    modules: [
      { code: 'M11', labelKey: 'mod.m11', route: 'conception' },
      { code: 'M12', labelKey: 'mod.m12', route: 'rfi' },
    ],
  },
  {
    key: 'execution',
    labelKey: 'nav.family.execution',
    modules: [
      { code: 'M13', labelKey: 'mod.m13', route: 'planning' },
      { code: 'M14', labelKey: 'mod.m14', route: 'pilotage' },
      { code: 'M15', labelKey: 'mod.m15', route: 'modifications' },
      { code: 'M18', labelKey: 'mod.m18', route: 'raccordements' },
      { code: 'M19', labelKey: 'mod.m19', route: 'reception' },
    ],
  },
  {
    key: 'transverse',
    labelKey: 'nav.family.transverse',
    modules: [
      { code: 'M20', labelKey: 'mod.m20', route: 'risques' },
      { code: 'EXP', labelKey: 'mod.bascule', route: 'bascule' },
      { code: 'M21', labelKey: 'mod.m21', route: 'reporting' },
      { code: 'M22', labelKey: 'mod.m22', route: 'documents' },
      { code: 'IA', labelKey: 'mod.copilote', route: 'copilote' },
      { code: 'M23', labelKey: 'mod.m23', route: 'journal' },
    ],
  },
];

/** Famille contenant la route active (pour le dépliage par défaut). */
function familyOfRoute(name: string): string | null {
  for (const f of FAMILIES) if (f.modules.some((m) => m.route === name)) return f.key;
  return null;
}

const roleLabel = (r: Role) => t(`role.${r}` as MessageKey);

/** Carte de contexte — opération (nom · phase · avancement). */
function OperationContextCard({ opId }: { opId: string }) {
  const { data: op } = useOperation(opId);
  return (
    <div className="ax-ctx">
      <div className="ax-ctx__name">{op?.name ?? '—'}</div>
      <div className="ax-ctx__sub mono">
        {op ? `${phaseLabel(op.phase)} · ${formatPercent(op.progress ?? 0, locale, 0)}` : t('shell.context.overview')}
      </div>
    </div>
  );
}

/** Carte de contexte — espace de travail (locataire). */
function TenantContextCard() {
  const { data: ops } = useOperations({});
  return (
    <div className="ax-ctx">
      <div className="ax-ctx__name">{t('shell.workspace.name')}</div>
      <div className="ax-ctx__sub mono">
        {t('shell.workspace.sub')} · {t('shell.workspace.count', { count: ops?.length ?? 0 })}
      </div>
    </div>
  );
}

function SearchField({ operation }: { operation: boolean }) {
  return (
    <div className="ax-search" aria-hidden="true">
      <Search size={14} className="text-ink-3" />
      <span className="flex-1 truncate text-[13px] text-ink-3">
        {t(operation ? 'shell.search.operation' : 'shell.search.tenant')}
      </span>
      <span className="mono text-[11px] text-ink-3">{t('shell.search.hint')}</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { route, navigate } = useNav();
  const opId = 'id' in route ? route.id : null;
  const activeFamily = familyOfRoute(route.name);
  const [open, setOpen] = useState<string | null>(activeFamily);
  const go = (r: Route) => {
    navigate(r);
    onNavigate?.();
  };

  return (
    <nav className="flex h-full flex-col">
      {/* Carte de contexte */}
      {opId ? <OperationContextCard opId={opId} /> : <TenantContextCard />}
      <SearchField operation={!!opId} />

      {/* Pilotage — toujours visible */}
      <div className="ax-nav-group">{t('nav.group.pilotage')}</div>
      <button className={cx('ax-nav-item', route.name === 'dashboard' && 'is-active')} aria-current={route.name === 'dashboard' ? 'page' : undefined} onClick={() => go({ name: 'dashboard' })}>
        {t('nav.dashboard')}
      </button>
      <button className={cx('ax-nav-item', route.name === 'portfolio' && 'is-active')} aria-current={route.name === 'portfolio' ? 'page' : undefined} onClick={() => go({ name: 'portfolio' })}>
        {t('nav.portfolio')}
      </button>

      {/* Contexte opération — familles de modules (handoff) */}
      {opId && (
        <>
          <div className="ax-nav-group">{t('nav.group.operation')}</div>
          <button className={cx('ax-nav-item', route.name === 'cockpit' && 'is-active')} aria-current={route.name === 'cockpit' ? 'page' : undefined} onClick={() => go({ name: 'cockpit', id: opId })}>
            {t('nav.cockpit')}
          </button>

          {FAMILIES.map((fam) => {
            const expanded = open === fam.key;
            const count = fam.modules.length;
            return (
              <div key={fam.key}>
                <button
                  className="ax-fam"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : fam.key)}
                >
                  <ChevronRight size={13} className={cx('ax-fam__chev', expanded && 'is-open')} />
                  <span className="flex-1 text-left">{t(fam.labelKey)}</span>
                  <span className="mono text-[10px] text-ink-3">{t('shell.family.count', { count })}</span>
                </button>
                {expanded &&
                  fam.modules.map((mod) => {
                    const isActive = mod.route === route.name;
                    const disabled = !mod.route;
                    return (
                      <button
                        key={mod.code}
                        className={cx('ax-nav-item ax-nav-item--child', isActive && 'is-active')}
                        aria-current={isActive ? 'page' : undefined}
                        disabled={disabled}
                        onClick={() => mod.route && go({ name: mod.route, id: opId } as Route)}
                      >
                        <span className="mono text-[10px] text-ink-3" style={{ minWidth: 26 }}>{mod.code}</span>
                        <span className="flex-1 truncate">{t(mod.labelKey)}</span>
                        {disabled && <span className="ax-soon">{t('common.soon')}</span>}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </>
      )}

      <div className="mt-auto" />
      {([
        { name: 'approbations', labelKey: 'appro.title' },
        { name: 'notifications', labelKey: 'notif.title' },
        { name: 'membres', labelKey: 'membres.title' },
        { name: 'etats', labelKey: 'etats.title' },
      ] as const).map((link) => (
        <button
          key={link.name}
          className={cx('ax-nav-item', route.name === link.name && 'is-active')}
          aria-current={route.name === link.name ? 'page' : undefined}
          onClick={() => go({ name: link.name })}
        >
          <span className="flex-1 text-left">{t(link.labelKey)}</span>
        </button>
      ))}
      <UserCard />
    </nav>
  );
}

function UserCard() {
  const { mode, user, signOut } = useAuth();
  const { navigate } = useNav();
  const [open, setOpen] = useState(false);
  const name = mode === 'supabase' ? (user?.email ?? t('shell.workspace.name')) : t('nav.demoUser');

  return (
    <div className="ax-usercard">
      <button className="ax-usercard__btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="ax-avatar" aria-hidden="true">MO</span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
          <span className="block truncate text-[11px] text-ink-3">{roleLabel('moa_director')}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="ax-menu" role="menu" style={{ right: 12, left: 12, bottom: 64, top: 'auto' }}>
            <button className="ax-menu-item" onClick={() => { setOpen(false); navigate({ name: 'workspaces' }); }}>
              <Users size={16} />
              {t('shell.switchWorkspace')}
            </button>
            {mode === 'supabase' ? (
              <button className="ax-menu-item" onClick={() => { setOpen(false); void signOut(); }}>
                <LogOut size={16} />
                {t('auth.signout')}
              </button>
            ) : (
              <div className="ax-menu-item" style={{ opacity: 0.6, cursor: 'default' }}>{t('nav.demoMode')}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { navigate } = useNav();
  const [drawer, setDrawer] = useState(false);

  // Ferme le tiroir mobile à la touche Échap (WCAG 2.1.2 — pas de piège clavier).
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="ax-skip">{t('a11y.skip')}</a>
      {/* Topbar 64 px */}
      <header className="sticky top-0 z-[50] flex h-16 items-center gap-3 border-b bg-bg px-4 sm:px-8"
        style={{ borderColor: 'var(--ax-border)' }}>
        <Button variant="ghost" size="sm" icon className="md:hidden" aria-label={t('common.menu')} onClick={() => setDrawer(true)}>
          <Menu size={18} />
        </Button>
        <button type="button" onClick={() => navigate({ name: 'dashboard' })} className="flex items-center md:hidden" aria-label={t('app.name')}>
          <Brand size={20} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => navigate({ name: 'create' })}>
            <Plus size={16} />
            {t('portfolio.new')}
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) 250 px */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-[250px] shrink-0 flex-col border-r bg-bg p-3 md:flex"
          style={{ borderColor: 'var(--ax-border)' }}>
          <div className="mb-2 px-2 pt-1"><Brand size={21} /></div>
          <NavLinks />
        </aside>

        {/* Contenu — padding handoff 18px 32px */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1" style={{ padding: '18px 32px', outline: 'none' }}>
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0" style={{ background: 'var(--ax-overlay)' }} onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label={t('common.menu')} className="absolute left-0 top-0 flex h-full w-[270px] flex-col overflow-auto bg-bg p-3" style={{ borderRight: '1px solid var(--ax-border)' }}>
            <div className="mb-2 flex items-center justify-between px-2">
              <Brand size={21} />
              <Button variant="ghost" size="sm" icon aria-label={t('common.close')} onClick={() => setDrawer(false)}>
                <X size={16} />
              </Button>
            </div>
            <NavLinks onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
