import { useMemo, useState } from 'react';
import { Wordmark, PhaseChip, cx } from '../kit';
import { useNav } from '../router';
import { families, type ScreenId } from '../nav';
import { menuMeta, operation, session } from '../data';

type Tier = 'all' | 'mvp' | 'v1' | 'v2';

export function MenuScreen() {
  const { navigate } = useNav();
  const [tier, setTier] = useState<Tier>('all');

  const counts = useMemo(() => {
    const c = { all: 0, mvp: 0, v1: 0, v2: 0 };
    for (const f of families) for (const m of f.modules) {
      c.all++;
      const t = menuMeta[m.id]?.tier ?? 'v1';
      c[t]++;
    }
    return c;
  }, []);

  const segments: { id: Tier; label: string; count: number }[] = [
    { id: 'all', label: 'tous', count: counts.all },
    { id: 'mvp', label: 'MVP', count: counts.mvp },
    { id: 'v1', label: 'V1', count: counts.v1 },
    { id: 'v2', label: 'V2', count: counts.v2 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ao-page)' }}>
      <div className="ao-topnav">
        <Wordmark />
        <span className="ao-topnav__sep">/</span>
        <span className="ao-topnav__crumb">{operation.name}</span>
        <PhaseChip label={operation.phase} current />
        <button className="ao-topnav__search" style={{ marginLeft: 'auto' }} onClick={() => navigate('m1')}>
          <span>Aller à un module…</span>
          <span className="ao-search__kbd">⌘K</span>
        </button>
        <span className="ao-avatar">{session.user.initials}</span>
      </div>

      <div className="ao-entry">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="ao-page-title">Menu principal</h1>
            <p className="ao-page-sub">Accès filtré par rôle — {session.user.role}. Les modules estompés arrivent en V2.</p>
          </div>
          <div className="ao-segments">
            {segments.map((s) => (
              <button key={s.id} className={cx('ao-segment', tier === s.id && 'is-active')} onClick={() => setTier(s.id)}>
                {s.label}<span className="ao-segment__count">{s.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
          {families.map((f) => {
            const visible = f.modules.filter((m) => tier === 'all' || (menuMeta[m.id]?.tier ?? 'v1') === tier);
            if (visible.length === 0) return null;
            const isCurrent = f.id === 'execution';
            return (
              <section key={f.id} className={cx('ao-menu-card', isCurrent && 'is-current')}>
                <header className="ao-menu-card__head">
                  <span className="ao-card__title">{f.label}</span>
                  <span className="ao-card__meta">{isCurrent ? 'phase en cours' : f.modules.map((m) => m.code).join(' · ')}</span>
                </header>
                {visible.map((m) => {
                  const meta = menuMeta[m.id];
                  const v2 = meta?.tier === 'v2';
                  return (
                    <button
                      key={m.id}
                      className={cx('ao-menu-item', v2 && 'is-v2')}
                      disabled={v2}
                      onClick={() => navigate(m.id as ScreenId)}
                    >
                      <div>
                        <div className="ao-menu-item__title">{m.title}</div>
                        <div className={cx('ao-menu-item__sub', meta?.accent && 'is-accent')}>{meta?.sub}</div>
                      </div>
                      <span className="ao-nav__code">{m.code}</span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
