import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { families, findModule, tenantEntries, type ScreenId } from './nav';
import { operation, session } from './data';
import { useNav } from './router';
import { Button, Wordmark, cx } from './kit';

// ── Barre latérale ───────────────────────────────────────────────────────────
function ContextCard() {
  const { context } = useNav();
  if (context === 'tenant') {
    return (
      <div className="ao-sidebar__context">
        <div className="ao-sidebar__context-title">{session.tenant.name}</div>
        <div className="ao-sidebar__context-sub">{session.tenant.kind} · {session.tenant.operations} opérations</div>
      </div>
    );
  }
  return (
    <div className="ao-sidebar__context">
      <div className="ao-sidebar__context-title">{operation.name}</div>
      <div className="ao-sidebar__context-sub">{operation.phase} · {operation.progress} %</div>
    </div>
  );
}

function OperationNav() {
  const { screen, navigate } = useNav();
  const activeFamily = findModule(screen)?.family.id ?? 'amont';
  const [open, setOpen] = useState<string>(activeFamily);
  // La famille du module courant est dépliée
  useEffect(() => { setOpen(activeFamily); }, [activeFamily]);

  return (
    <nav className="ao-nav">
      {families.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id}>
            <button className={cx('ao-nav__family', isOpen && 'is-open')} onClick={() => setOpen(isOpen ? '' : f.id)}>
              <span>{f.label}</span>
              <span className="ao-nav__family-count">{isOpen ? '▾' : `${f.modules.length} modules ▸`}</span>
            </button>
            {isOpen &&
              f.modules.map((m) => (
                <button key={m.id} className={cx('ao-nav__module', screen === m.id && 'is-active')} onClick={() => navigate(m.id)}>
                  <span>{m.short}</span>
                  {m.badge ? <span className="ao-badge ao-badge--accent">{m.badge}</span> : <span className="ao-nav__code">{m.code}</span>}
                </button>
              ))}
          </div>
        );
      })}
    </nav>
  );
}

function TenantNav() {
  const { screen, navigate } = useNav();
  return (
    <nav className="ao-nav">
      <button className={cx('ao-nav__family', screen === 'home' && 'is-open')} onClick={() => navigate('home')}>
        <span>Accueil</span>
      </button>
      <button className={cx('ao-nav__family', screen === 'menu' && 'is-open')} onClick={() => navigate('menu')}>
        <span>Menu principal</span>
      </button>
      <div className="ao-nav__spacer" />
      {tenantEntries.map((e) => (
        <button key={e.id} className={cx('ao-nav__module', screen === e.id && 'is-active')} onClick={() => navigate(e.id)}>
          <span>{e.title}</span>
          <span className="ao-nav__code">{e.code}</span>
        </button>
      ))}
    </nav>
  );
}

function Sidebar() {
  const { context, setPaletteOpen } = useNav();
  return (
    <aside className="ao-sidebar">
      <div className="ao-sidebar__brand"><Wordmark /></div>
      <ContextCard />
      <button className="ao-search" onClick={() => setPaletteOpen(true)}>
        <span>{context === 'tenant' ? 'Rechercher' : 'Aller à un module'}</span>
        <span className="ao-search__kbd">⌘K</span>
      </button>
      {context === 'tenant' ? <TenantNav /> : <OperationNav />}
      <div className="ao-nav__spacer" />
      <div className="ao-user">
        <span className="ao-avatar">{session.user.initials}</span>
        <div>
          <div className="ao-user__name">{session.user.name}</div>
          <div className="ao-user__role">{session.user.role}</div>
        </div>
      </div>
    </aside>
  );
}

// ── Barre supérieure ─────────────────────────────────────────────────────────
export function Topbar({ title, context, primary, secondary }: {
  title: string; context?: string;
  primary?: { label: string; onClick?: () => void; disabled?: boolean };
  secondary?: { label: string; onClick?: () => void };
}) {
  return (
    <header className="ao-topbar">
      <span className="ao-topbar__title">{title}</span>
      {context && <span className="ao-topbar__context">{context}</span>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
        {secondary && <Button variant="secondary" onClick={secondary.onClick}>{secondary.label}</Button>}
        {primary && <Button variant="primary" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</Button>}
      </div>
    </header>
  );
}

// ── Palette de commandes (⌘K) ────────────────────────────────────────────────
function CommandPalette() {
  const { paletteOpen, setPaletteOpen, navigate } = useNav();
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);
  useEffect(() => { if (!paletteOpen) setQ(''); }, [paletteOpen]);

  const entries = useMemo(() => {
    const mods = families.flatMap((f) => f.modules.map((m) => ({ id: m.id as ScreenId, label: m.title, code: m.code })));
    const extras: { id: ScreenId; label: string; code: string }[] = [
      { id: 'home', label: 'Accueil', code: '' },
      { id: 'menu', label: 'Menu principal', code: '' },
      { id: 'approvals', label: 'Boîte d’approbations', code: 'F7' },
      { id: 'notifications', label: 'Centre de notifications', code: 'F4' },
      { id: 'members', label: 'Membres & rôles', code: 'F1' },
      { id: 'create-wizard', label: 'Nouvelle opération (assistant)', code: 'M1' },
      { id: 'plan-tresorerie', label: 'Plan de trésorerie', code: 'M4' },
      { id: 'arretes', label: 'Arrêtés de bilan', code: 'M4' },
      { id: 'assurances', label: 'Tableau des assurances', code: 'M7' },
      { id: 'jalons', label: 'Jalons & baseline', code: 'M13' },
      { id: 'simulateur', label: 'Simulateur d’impact', code: 'M15' },
      { id: 'risques-raci', label: 'Registre des risques & RACI', code: 'M20' },
      { id: 'journal', label: 'Journal d’audit', code: 'M23' },
      { id: 'states', label: 'États globaux', code: '' },
    ];
    const all = [...extras, ...mods];
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((e) => e.label.toLowerCase().includes(needle) || e.code.toLowerCase().includes(needle)) : all;
  }, [q]);

  if (!paletteOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'center', paddingTop: 96, background: 'rgba(42,39,34,0.35)' }} onClick={() => setPaletteOpen(false)}>
      <div style={{ width: 560, maxWidth: '90vw', background: 'var(--ao-card)', border: '1px solid var(--ao-border-strong)', height: 'fit-content', maxHeight: '60vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="ao-input"
          placeholder="Aller à un module, une opération, un marché…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ border: 0, borderBottom: '1px solid var(--ao-border)', height: 48 }}
        />
        <div style={{ overflowY: 'auto' }}>
          {entries.length === 0 && <div style={{ padding: '16px 18px', color: 'var(--ao-muted)', fontSize: 13 }}>Aucun résultat.</div>}
          {entries.map((e) => (
            <button key={e.id} className="ao-nav__module" style={{ paddingLeft: 18 }} onClick={() => navigate(e.id)}>
              <span>{e.label}</span>
              {e.code && <span className="ao-nav__code">{e.code}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ao-shell">
      <Sidebar />
      <main className="ao-main">{children}</main>
      <CommandPalette />
    </div>
  );
}
