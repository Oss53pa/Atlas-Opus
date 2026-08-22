import { Topbar } from '../Shell';
import { Card, Kpis, FactList } from '../kit';
import { useNav } from '../router';
import { bilanPostes, bilanTotal, bilanAlerts } from '../data';
import { millions, signedMoney, EMDASH } from '../format';

// Plan de trésorerie cumulé (12 mois) — décaissements / encaissements (millions).
const treso = [
  { m: 'S', out: 62, in: 40 }, { m: 'O', out: 78, in: 44 }, { m: 'N', out: 96, in: 30 },
  { m: 'D', out: 88, in: 52 }, { m: 'J', out: 72, in: 68 }, { m: 'F', out: 84, in: 74 },
  { m: 'M', out: 90, in: 96 }, { m: 'A', out: 76, in: 110 }, { m: 'M', out: 70, in: 128 },
  { m: 'J', out: 64, in: 120 }, { m: 'J', out: 58, in: 116 }, { m: 'A', out: 52, in: 132 },
];
const maxTreso = Math.max(...treso.flatMap((t) => [t.out, t.in]));

function num(v: number | null) {
  if (v === null) return EMDASH;
  if (v === 0) return EMDASH;
  return millions(v);
}

export function BilanScreen() {
  const { navigate } = useNav();
  const kpis = [
    { label: 'Coût prévu', value: '4,85 Md', sub: 'BAC' },
    { label: 'Engagé', value: '3,42 Md', sub: 'reste à engager 1,43 Md' },
    { label: 'Recettes', value: '5,46 Md', sub: 'réalisées 2,08 Md' },
    { label: 'Marge · TRI', value: '+612 M', sub: '12,6 % · TRI 14,2 %' },
    { label: 'Besoin tréso max', value: '−418 M', sub: 'point bas nov. 2026', accent: true },
  ];
  return (
    <>
      <Topbar
        title="Bilan d’opération"
        context="prévisionnel vivant · recalculé il y a 4 min"
        secondary={{ label: 'Comparer un arrêté', onClick: () => navigate('arretes') }}
        primary={{ label: 'Arrêter le bilan', onClick: () => navigate('arretes') }}
      />
      <div className="ao-content">
        <Kpis items={kpis} />
        <div className="ao-split">
          <Card title="" meta="">
            <div className="ao-table" style={{ ['--ao-cols' as string]: '1.6fr 1fr 1fr 1fr 0.8fr' }}>
              <div className="ao-thead">
                <div className="ao-th">Poste</div>
                <div className="ao-th ao-th--num">Prévu</div>
                <div className="ao-th ao-th--num">Engagé</div>
                <div className="ao-th ao-th--num">Réalisé</div>
                <div className="ao-th ao-th--num">Écart</div>
              </div>
              {bilanPostes.map((p) => (
                <button className="ao-row" key={p.poste} onClick={() => navigate('poste-bilan')}>
                  <div className="ao-cell__title">{p.poste}</div>
                  <div className="ao-cell--num">{millions(p.prevu)}</div>
                  <div className="ao-cell--num ao-cell--num-muted">{num(p.engage)}</div>
                  <div className="ao-cell--num ao-cell--num-muted">{num(p.realise)}</div>
                  <div className={`ao-cell--num ${p.ecart && p.ecart !== 0 ? (p.ecart > 0 ? 'ao-cell--num-accent' : '') : 'ao-cell--num-muted'}`}>
                    {p.ecart ? signedMoney(p.ecart) : EMDASH}
                  </div>
                </button>
              ))}
              <div className="ao-row ao-row--total" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 0.8fr' }}>
                <div className="ao-cell--strong">Total coûts</div>
                <div className="ao-cell--num ao-cell--strong">{millions(bilanTotal.prevu)}</div>
                <div className="ao-cell--num ao-cell--strong">{millions(bilanTotal.engage)}</div>
                <div className="ao-cell--num ao-cell--strong">{millions(bilanTotal.realise)}</div>
                <div className="ao-cell--num ao-cell--strong ao-cell--num-accent">{signedMoney(bilanTotal.ecart)}</div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Plan de trésorerie" right={<button className="ao-card__meta" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ao-accent)' }} onClick={() => navigate('plan-tresorerie')}>voir le détail →</button>}>
              <div className="ao-treso">
                {treso.map((t, i) => (
                  <div className="ao-treso__group" key={i} title={`${t.m}`}>
                    <div className="ao-treso__bar ao-treso__bar--out" style={{ height: `${(t.out / maxTreso) * 100}%` }} />
                    <div className="ao-treso__bar ao-treso__bar--in" style={{ height: `${(t.in / maxTreso) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {treso.map((t, i) => <div className="ao-treso__label" key={i} style={{ flex: 1 }}>{t.m}</div>)}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: 'var(--ao-font-mono)', fontSize: 10, color: 'var(--ao-faint)' }}>
                <span><span style={{ color: 'var(--ao-accent)' }}>▉</span> décaissements</span>
                <span><span style={{ color: 'var(--ao-chart-neutral)' }}>▉</span> encaissements</span>
              </div>
            </Card>
            <Card title="Alertes du bilan">
              <FactList items={bilanAlerts.map((a) => ({ label: a.title, sub: a.sub, sev: a.sev }))} />
            </Card>
          </div>
        </div>

        <Card title="Arrêtés de bilan" meta="snapshots scellés, comparables">
          <div className="ao-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div><div className="ao-field__label">Dernier arrêté</div><div style={{ fontSize: 15, marginTop: 6 }}>31 juillet 2026</div></div>
            <div><div className="ao-field__label">Marge à cette date</div><div className="num" style={{ fontSize: 15, marginTop: 6 }}>+648 M</div></div>
            <div><div className="ao-field__label">Écart depuis</div><div className="num" style={{ fontSize: 15, marginTop: 6, color: 'var(--ao-accent)' }}>−36 M</div></div>
            <div><div className="ao-field__label">Fréquence</div><div style={{ fontSize: 15, marginTop: 6 }}>mensuelle</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
