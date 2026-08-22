import { useState } from 'react';
import { Wordmark, Button, Bar, PhaseChip, cx } from '../kit';
import { useNav } from '../router';
import { decisions, portfolio, portfolioSummary, blockingGates, session } from '../data';

function DecisionCard({ title, codes, value, valueSub, place, primary, secondary }: (typeof decisions)[number]) {
  return (
    <div className="ao-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ao-primary)' }}>{title}</span>
        <span className="ao-card__meta">{codes}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ao-primary)' }}>{value}</span>
        {valueSub && <span className="num" style={{ fontSize: 13, color: 'var(--ao-muted)' }}>{valueSub}</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ao-body)', flex: 1 }}>{place}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="primary">{primary}</Button>
        {secondary && <Button variant="secondary">{secondary}</Button>}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const { navigate } = useNav();
  const [tab, setTab] = useState<'actives' | 'pause' | 'closed'>('actives');
  const tabs = [
    { id: 'actives' as const, label: 'actives', count: 6 },
    { id: 'pause' as const, label: 'en pause', count: 1 },
    { id: 'closed' as const, label: 'clôturées', count: 3 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ao-page)' }}>
      <div className="ao-topnav">
        <Wordmark />
        <button className="ao-switcher" onClick={() => navigate('workspaces')}>{session.tenant.name} ▾</button>
        <button className="ao-topnav__search" style={{ marginLeft: 'auto' }} onClick={() => navigate('menu')}>
          <span>Rechercher une opération, un marché…</span>
          <span className="ao-search__kbd">⌘K</span>
        </button>
        <span className="ao-avatar" style={{ borderRadius: 999 }}>{session.user.initials}</span>
      </div>

      <div className="ao-entry">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="ao-page-title">Bonjour {session.user.firstName}</h1>
            <p className="ao-page-sub">Trois décisions vous attendent. Deux gardes bloquent une transition de phase.</p>
          </div>
          <Button variant="primary" onClick={() => navigate('create-wizard')}>Nouvelle opération</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {decisions.map((d) => <DecisionCard key={d.title} {...d} />)}
        </div>

        <div className="ao-split">
          {/* Mes opérations */}
          <section className="ao-card">
            <header className="ao-card__head">
              <span className="ao-card__title">Mes opérations</span>
              <div className="ao-segments">
                {tabs.map((t) => (
                  <button key={t.id} className={cx('ao-segment', tab === t.id && 'is-active')} onClick={() => setTab(t.id)}>
                    {t.label}<span className="ao-segment__count">{t.count}</span>
                  </button>
                ))}
              </div>
            </header>
            <div className="ao-table" style={{ ['--ao-cols' as string]: '2fr 0.9fr 0.8fr 1.1fr 0.6fr' }}>
              <div className="ao-thead">
                <div className="ao-th">Opération</div>
                <div className="ao-th">Phase</div>
                <div className="ao-th ao-th--num">BAC</div>
                <div className="ao-th">Avancement</div>
                <div className="ao-th ao-th--num">Alertes</div>
              </div>
              {portfolio.map((op) => (
                <button key={op.name} className="ao-row" onClick={() => navigate('m1')}>
                  <div>
                    <div className="ao-cell__title">{op.name}</div>
                    <div className="ao-cell__sub">{op.place}</div>
                  </div>
                  <div><PhaseChip label={op.phase} current={op.current} /></div>
                  <div className="ao-cell--num">{op.bacMd}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}><Bar value={op.progress} /></div>
                    <span className="num" style={{ fontSize: 13, color: 'var(--ao-body)', minWidth: 34, textAlign: 'right' }}>
                      {op.progress > 0 ? `${op.progress} %` : '—'}
                    </span>
                  </div>
                  <div className="ao-cell--num">
                    {op.alerts > 0
                      ? <span className={op.alerts >= 4 ? 'ao-badge ao-badge--accent' : 'ao-badge ao-badge--neutral'}>{op.alerts}</span>
                      : <span style={{ color: 'var(--ao-muted)' }}>0</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="ao-card">
              <header className="ao-card__head"><span className="ao-card__title">Gardes bloquantes</span></header>
              <div className="ao-facts">
                {blockingGates.map((g) => (
                  <div className="ao-fact" key={g.title}>
                    <span className="ao-fact__sev ao-fact__sev--accent" />
                    <div className="ao-fact__main">
                      <div className="ao-fact__label">{g.title}</div>
                      <div className="ao-fact__sub">{g.sub}</div>
                      <div className="ao-fact__sub num" style={{ marginTop: 4 }}>{g.ref}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="ao-card">
              <header className="ao-card__head"><span className="ao-card__title">Portefeuille</span></header>
              <div className="ao-facts">
                {portfolioSummary.map((s) => (
                  <div className="ao-fact" key={s.label}>
                    <div className="ao-fact__main"><div className="ao-fact__label">{s.label}</div></div>
                    <div className="ao-fact__value" style={s.accent ? { color: 'var(--ao-accent)' } : undefined}>{s.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
