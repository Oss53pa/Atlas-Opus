import { useState } from 'react';
import { Wordmark, Button } from '../kit';

export function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ao-page)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '32px 40px' }}><Wordmark /></div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form
          style={{ width: 424, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 18 }}
          onSubmit={(e) => { e.preventDefault(); onEnter(); }}
        >
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>Connexion</h1>
            <p style={{ color: 'var(--ao-muted)', fontSize: 14, marginTop: 4 }}>Accédez à vos opérations.</p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--ao-secondary)' }}>Adresse professionnelle</span>
            <input className="ao-input" type="email" defaultValue="k.traore@atlas-mo.ci" style={{ height: 44 }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--ao-secondary)' }}>Mot de passe</span>
              <button type="button" style={{ fontSize: 13, color: 'var(--ao-accent)', background: 'none', border: 0, cursor: 'pointer' }}>Oublié ?</button>
            </span>
            <span style={{ position: 'relative', display: 'flex' }}>
              <input className="ao-input" type={show ? 'text' : 'password'} defaultValue="motdepasse" style={{ height: 44, borderColor: 'var(--ao-accent)' }} />
              <button type="button" onClick={() => setShow((s) => !s)} style={{ position: 'absolute', right: 11, top: 0, height: 44, fontSize: 13, color: 'var(--ao-muted)', background: 'none', border: 0, cursor: 'pointer' }}>
                {show ? 'masquer' : 'afficher'}
              </button>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ao-body)' }}>
            <span
              onClick={() => setKeep((k) => !k)}
              style={{ width: 18, height: 18, border: '1px solid var(--ao-border-control)', background: keep ? 'var(--ao-accent)' : 'var(--ao-input)', color: 'var(--ao-on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
            >{keep ? '✓' : ''}</span>
            Garder cette session 30 jours
          </label>

          <Button type="submit" variant="primary" block>Se connecter</Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ao-faint)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--ao-border)' }} />
            ou
            <span style={{ flex: 1, height: 1, background: 'var(--ao-border)' }} />
          </div>

          <Button type="button" variant="secondary" block onClick={onEnter}>SSO de mon organisation</Button>
        </form>
      </div>
      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ao-font-mono)', fontSize: 12, color: 'var(--ao-faint)' }}>
        <span>Français · Côte d’Ivoire</span>
        <span>Hébergement souverain</span>
      </div>
    </div>
  );
}
