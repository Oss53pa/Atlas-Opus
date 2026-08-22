import { useState } from 'react';
import { Topbar } from '../Shell';
import { Card, Button, StateBlock } from '../kit';

function Skeleton() {
  return (
    <div className="ao-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[80, 60, 70, 45].map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div className="ao-skel" style={{ width: `${w}%` }} />
          <div className="ao-skel" style={{ width: 48 }} />
        </div>
      ))}
    </div>
  );
}

function AmountField() {
  const [v, setV] = useState('-12000');
  const n = Number(v);
  const invalid = !Number.isNaN(n) && n < 0;
  return (
    <div className="ao-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="ao-field__label">Montant du décompte</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input className={`ao-input ao-input--amount ${invalid ? 'ao-input--invalid' : ''}`} value={v} onChange={(e) => setV(e.target.value)} style={{ paddingRight: 52 }} />
        <span className="ao-field__label" style={{ position: 'absolute', right: 11 }}>FCFA</span>
      </div>
      {invalid
        ? <div className="ao-field__error">Le net ne peut pas être négatif.</div>
        : <div className="ao-field__hint">Base HT − retenues − avance remboursée.</div>}
    </div>
  );
}

export function StatesScreen() {
  return (
    <>
      <Topbar title="États globaux" context="vide · chargement · erreur · accès refusé" />
      <div className="ao-content">
        <div className="ao-grid-2">
          <Card title="Vide">
            <StateBlock title="Aucune donnée pour l’instant" desc="Créez la première entrée pour démarrer." action={<Button variant="primary">Créer une entrée</Button>} />
          </Card>
          <Card title="Chargement">
            <Skeleton />
          </Card>
          <Card title="Erreur">
            <StateBlock title="Chargement impossible" desc="Le service n’a pas répondu. Vos données locales sont conservées." action={<Button variant="secondary">Réessayer</Button>} />
          </Card>
          <Card title="Accès refusé">
            <StateBlock title="Accès refusé" desc="Cet écran requiert le rôle finance ou moa_director." action={<Button variant="secondary">Demander l’accès</Button>} />
          </Card>
        </div>

        <div className="ao-grid-2">
          <Card title="Champ & montant — validation"><AmountField /></Card>
          <Card title="Carte KPI">
            <div className="ao-card__body">
              <div className="ao-kpi__label">Coût engagé</div>
              <div className="ao-kpi__value">3,42 Md</div>
              <div className="ao-kpi__sub">FCFA · 71 % du BAC</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
