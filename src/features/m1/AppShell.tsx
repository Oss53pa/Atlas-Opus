import { useState, type ReactNode } from 'react';
import {
  Plus,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Building2,
  LayoutDashboard,
  Folder,
  Wallet,
  ListChecks,
  Gavel,
  Banknote,
  Users,
  ShieldCheck,
  Landmark,
  Settings,
  CalendarDays,
} from 'lucide-react';
import { Brand, Button } from '../../ui';
import { useNav, type Route } from '../../app/router';
import { useAuth } from '../../app/auth';
import { t } from '../../i18n';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { route, navigate } = useNav();
  const opId = route.name === 'cockpit' || route.name === 'program' ? route.id : null;
  const go = (r: Route) => {
    navigate(r);
    onNavigate?.();
  };

  return (
    <nav className="flex h-full flex-col gap-0.5">
      <div className="ax-nav-group">{t('nav.group.pilotage')}</div>
      <button className={cx('ax-nav-item', route.name === 'dashboard' && 'is-active')} onClick={() => go({ name: 'dashboard' })}>
        <LayoutDashboard size={18} />
        {t('nav.dashboard')}
      </button>
      <button className={cx('ax-nav-item', route.name === 'portfolio' && 'is-active')} onClick={() => go({ name: 'portfolio' })}>
        <Folder size={18} />
        {t('nav.portfolio')}
      </button>

      {opId && (
        <>
          <div className="ax-nav-group">{t('nav.group.operation')}</div>
          <button className={cx('ax-nav-item', route.name === 'cockpit' && 'is-active')} onClick={() => go({ name: 'cockpit', id: opId })}>
            <LayoutDashboard size={18} />
            {t('nav.cockpit')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'bilan' && 'is-active')} onClick={() => go({ name: 'bilan', id: opId })}>
            <Wallet size={18} />
            {t('nav.bilan')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'program' && 'is-active')} onClick={() => go({ name: 'program', id: opId })}>
            <ListChecks size={18} />
            {t('nav.program')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'planning' && 'is-active')} onClick={() => go({ name: 'planning', id: opId })}>
            <CalendarDays size={18} />
            {t('nav.planning')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'passation' && 'is-active')} onClick={() => go({ name: 'passation', id: opId })}>
            <Gavel size={18} />
            {t('nav.passation')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'financing' && 'is-active')} onClick={() => go({ name: 'financing', id: opId })}>
            <Landmark size={18} />
            {t('nav.financing')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'payments' && 'is-active')} onClick={() => go({ name: 'payments', id: opId })}>
            <Banknote size={18} />
            {t('nav.payments')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'stakeholders' && 'is-active')} onClick={() => go({ name: 'stakeholders', id: opId })}>
            <Users size={18} />
            {t('nav.stakeholders')}
          </button>
          <button className={cx('ax-nav-item', route.name === 'compliance' && 'is-active')} onClick={() => go({ name: 'compliance', id: opId })}>
            <ShieldCheck size={18} />
            {t('nav.compliance')}
          </button>
        </>
      )}

      <div className="mt-auto" />
      <div className="ax-nav-group">{t('nav.group.config')}</div>
      <button className="ax-nav-item" disabled>
        <Settings size={18} />
        {t('nav.settings')}
        <span className="ax-soon">{t('common.soon')}</span>
      </button>
    </nav>
  );
}

function UserMenu() {
  const { mode, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const label = mode === 'supabase' ? (user?.email ?? '') : t('nav.demoUser');

  return (
    <div className="relative">
      <button
        className="ax-btn ax-btn--glass ax-btn--sm"
        style={{ paddingLeft: 6 }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: 'var(--ax-accent-soft)', color: 'var(--ax-on-accent)', fontSize: 11, fontWeight: 500 }}
        >
          MO
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="ax-menu" role="menu">
            <div className="px-2.5 py-2">
              <div className="text-[12px] text-ink-3">{t('nav.tenant')}</div>
              <div className="truncate text-[13px] font-medium">{label || 'Atlas Opus'}</div>
            </div>
            <div className="ax-divider my-1" />
            {mode === 'supabase' ? (
              <button
                className="ax-menu-item"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <LogOut size={16} />
                {t('auth.signout')}
              </button>
            ) : (
              <div className="ax-menu-item" style={{ opacity: 0.6, cursor: 'default' }}>
                <Building2 size={16} />
                {t('nav.demoMode')}
              </div>
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar */}
      <header className="ax-glass sticky top-0 z-[50] border-b" style={{ borderColor: 'var(--ax-glass-border)' }}>
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" icon className="md:hidden" aria-label={t('common.menu')} onClick={() => setDrawer(true)}>
            <Menu size={18} />
          </Button>
          <button type="button" onClick={() => navigate({ name: 'dashboard' })} className="flex items-center" aria-label={t('app.name')}>
            <Brand size={26} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="sm" className="hidden sm:inline-flex" onClick={() => navigate({ name: 'create' })}>
              <Plus size={16} />
              {t('portfolio.new')}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside
          className="ax-glass sticky top-[57px] hidden h-[calc(100vh-57px)] w-[230px] shrink-0 border-r p-3 md:block"
          style={{ borderColor: 'var(--ax-glass-border)' }}
        >
          <NavLinks />
        </aside>

        {/* Contenu */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0" style={{ background: 'var(--ax-overlay)' }} onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="ax-glass absolute left-0 top-0 h-full w-[260px] overflow-auto p-3" style={{ borderRight: '1px solid var(--ax-glass-border)' }}>
            <div className="mb-2 flex items-center justify-between">
              <Brand size={24} />
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
