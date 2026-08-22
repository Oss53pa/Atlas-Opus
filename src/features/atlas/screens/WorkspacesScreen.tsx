import { Wordmark, Button, Badge, cx } from '../kit';
import { workspaces } from '../data';

export function WorkspacesScreen({ onPick, onSignOut }: { onPick: () => void; onSignOut: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ao-page)' }}>
      <div className="ao-topnav">
        <Wordmark />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--ao-muted)' }}>k.traore@atlas-mo.ci</span>
          <button onClick={onSignOut} style={{ color: 'var(--ao-accent)', background: 'none', border: 0, cursor: 'pointer', fontSize: 13 }}>Se déconnecter</button>
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <h1 className="ao-page-title">Choisir un espace de travail</h1>
          <p className="ao-page-sub">Vos droits et vos données sont isolés par espace.</p>
        </div>
        {workspaces.map((w) => (
          <button key={w.name} className={cx('ao-ws', w.current && 'is-current')} onClick={onPick}>
            <span className="ao-ws__avatar">{w.initials}</span>
            <div style={{ flex: 1 }}>
              <div className="ao-ws__name">{w.name}</div>
              <div className="ao-ws__sub">{w.sub}</div>
            </div>
            <Badge label={w.role} kind="neutral" />
            <span style={{ color: 'var(--ao-accent)', fontSize: 18 }}>→</span>
          </button>
        ))}
        <div className="ao-hr" style={{ marginTop: 8 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--ao-muted)' }}>Un espace manquant ? Demandez l’accès à son administrateur.</span>
          <Button variant="secondary">Créer un espace</Button>
        </div>
      </div>
    </div>
  );
}
