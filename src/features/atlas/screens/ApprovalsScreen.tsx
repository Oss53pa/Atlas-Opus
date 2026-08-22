import { useState } from 'react';
import { Topbar } from '../Shell';
import { Card, Badge, cx } from '../kit';
import { approvals } from '../data';

export function ApprovalsScreen() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });

  return (
    <>
      <Topbar
        title="Boîte d’approbations"
        context={`${approvals.length} tâches · routage par seuil`}
        secondary={{ label: 'Filtrer' }}
        primary={{ label: `Traiter la sélection${selected.size ? ` (${selected.size})` : ''}` }}
      />
      <div className="ao-content">
        <Card title="File unifiée" meta="≤ 10 M → AMO · 10–50 M → directeur · > 50 M → comité">
          <div className="ao-table" style={{ ['--ao-cols' as string]: '0.3fr 2.4fr 1fr 1.3fr 0.9fr' }}>
            <div className="ao-thead">
              <div className="ao-th" />
              <div className="ao-th">Objet</div>
              <div className="ao-th ao-th--num">Montant</div>
              <div className="ao-th">Seuil applicable</div>
              <div className="ao-th">Sévérité</div>
            </div>
            {approvals.map((a, i) => (
              <div className="ao-row" key={i} style={{ paddingLeft: 18 }}>
                <div>
                  <span
                    role="checkbox"
                    aria-checked={selected.has(i)}
                    tabIndex={0}
                    onClick={() => toggle(i)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(i)}
                    className={cx('ao-fact__sev')}
                    style={{ width: 18, height: 18, cursor: 'pointer', border: '1px solid var(--ao-border-control)', background: selected.has(i) ? 'var(--ao-accent)' : 'var(--ao-input)', color: 'var(--ao-on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                  >{selected.has(i) ? '✓' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span className={cx('ao-fact__sev', a.sev === 'accent' && 'ao-fact__sev--accent', a.sev === 'danger' && 'ao-fact__sev--danger')} style={{ alignSelf: 'stretch', minHeight: 34 }} />
                  <div>
                    <div className="ao-cell__title">{a.title}</div>
                    <div className="ao-cell__sub"><span className="num">{a.ref}</span> · {a.sub}</div>
                  </div>
                </div>
                <div className="ao-cell--num">{a.amount}</div>
                <div className="ao-cell--sec num">{a.threshold}</div>
                <div>
                  <Badge label={a.sev === 'danger' ? 'bloquant' : a.sev === 'accent' ? 'à décider' : 'à instruire'} kind={a.sev === 'danger' ? 'danger' : a.sev === 'accent' ? 'accent' : 'neutral'} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <p style={{ fontSize: 12, color: 'var(--ao-muted)' }}>
          Un motif est obligatoire pour tout renvoi ou rejet. Un contrôle bloquant désactive la validation et affiche la cause,
          avec un lien vers l’écran qui permet de la lever.
        </p>
      </div>
    </>
  );
}
