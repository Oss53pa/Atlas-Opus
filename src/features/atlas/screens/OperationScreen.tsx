import { Topbar } from '../Shell';
import { Card, Kpis, Badge } from '../kit';
import { operation, programLines, phaseGates, programVersions } from '../data';

export function OperationScreen() {
  const kpis = [
    { label: 'Phase', value: operation.phase, sub: 'depuis le 04.02.2026' },
    { label: 'Budget à terminaison', value: '4,85 Md', sub: 'FCFA · XOF' },
    { label: 'Programme', value: operation.program, sub: 'validé le 18.01.2026' },
    { label: 'Exigences', value: String(operation.exigences), sub: '2 non couvertes', accent: true },
    { label: 'Retenue de garantie', value: '5 %', sub: 'contractuelle' },
  ];
  return (
    <>
      <Topbar
        title="Opération & programme"
        context={`phase ${operation.phase} · programme ${operation.program}`}
        secondary={{ label: 'Historique des versions' }}
        primary={{ label: 'Changer de phase' }}
      />
      <div className="ao-content">
        <Kpis items={kpis} />
        <div className="ao-split">
          <Card title="Programme de l’opération" meta="catégorie · cible · statut">
            <div className="ao-table" style={{ ['--ao-cols' as string]: '2fr 1.1fr 0.7fr 0.6fr 0.7fr' }}>
              <div className="ao-thead">
                <div className="ao-th">Libellé</div>
                <div className="ao-th">Catégorie</div>
                <div className="ao-th ao-th--num">Cible</div>
                <div className="ao-th">Unité</div>
                <div className="ao-th">Statut</div>
              </div>
              {programLines.map((p) => (
                <div className="ao-row" key={p.label}>
                  <div>
                    <div className="ao-cell__title">{p.label}</div>
                    {p.sub && <div className="ao-cell__sub">{p.sub}</div>}
                  </div>
                  <div className="ao-cell--sec">{p.cat}</div>
                  <div className="ao-cell--num">{p.cible}</div>
                  <div className="ao-cell--sec num">{p.unit}</div>
                  <div><Badge label={p.status} kind={p.status === 'validé' ? 'success' : 'accent'} /></div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Transition de phase" meta="gardes M2 · M7 · M18">
              <div className="ao-facts">
                {phaseGates.map((g) => (
                  <div className="ao-fact" key={g.title}>
                    <span className={`ao-fact__sev ${g.state === 'OK' ? '' : 'ao-fact__sev--accent'}`} />
                    <div className="ao-fact__main">
                      <div className="ao-fact__label">{g.title}</div>
                      <div className="ao-fact__sub num">{g.ref}</div>
                    </div>
                    <div className="ao-fact__value" style={g.state === 'OK' ? { color: 'var(--ao-success)' } : undefined}>{g.state}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Versions du programme">
              <div className="ao-facts">
                {programVersions.map((v) => (
                  <div className="ao-fact" key={v.v}>
                    <div className="ao-fact__main">
                      <div className="ao-fact__label">{v.v}</div>
                      <div className="ao-fact__sub">{v.sub}</div>
                    </div>
                    <div className="ao-fact__value">{v.date}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card title="Comparaison v3 / v2" meta="écarts de programme">
          <div className="ao-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div><div className="ao-field__label">Surface utile</div><div className="num" style={{ fontSize: 15, marginTop: 6 }}>7 770 m² · +120 m²</div></div>
            <div><div className="ao-field__label">Usages</div><div style={{ fontSize: 15, marginTop: 6 }}>inchangés</div></div>
            <div><div className="ao-field__label">Exigences ajoutées</div><div className="num" style={{ fontSize: 15, marginTop: 6, color: 'var(--ao-accent)' }}>2</div></div>
            <div><div className="ao-field__label">Exigences retirées</div><div className="num" style={{ fontSize: 15, marginTop: 6 }}>1</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
