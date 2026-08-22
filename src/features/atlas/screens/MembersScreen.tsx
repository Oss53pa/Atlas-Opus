import { Topbar } from '../Shell';
import { Card, Badge } from '../kit';
import { members, roles } from '../data';

export function MembersScreen() {
  return (
    <>
      <Topbar
        title="Membres & rôles"
        context={`${members.length} membres · ${roles.length} rôles · périmètre par opération`}
        secondary={{ label: 'Journal des accès' }}
        primary={{ label: 'Inviter un membre' }}
      />
      <div className="ao-content">
        <div className="ao-split">
          <Card title="Membres" meta="périmètre + délégation">
            <div className="ao-table" style={{ ['--ao-cols' as string]: '2fr 1.1fr 1.3fr 0.8fr' }}>
              <div className="ao-thead">
                <div className="ao-th">Membre</div>
                <div className="ao-th">Rôle</div>
                <div className="ao-th">Périmètre</div>
                <div className="ao-th">Statut</div>
              </div>
              {members.map((m) => (
                <div className="ao-row" key={m.email}>
                  <div>
                    <div className="ao-cell__title">{m.name}</div>
                    <div className="ao-cell__sub num">{m.email}</div>
                  </div>
                  <div className="ao-cell--sec num">{m.role}</div>
                  <div className="ao-cell--sec">{m.scope}</div>
                  <div><Badge label={m.status} kind={m.status === 'actif' ? 'success' : 'accent'} /></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Rôles" meta="matrice rôle × action">
            <div className="ao-facts">
              {roles.map((r) => (
                <div className="ao-fact" key={r.code}>
                  <div className="ao-fact__main">
                    <div className="ao-fact__label num">{r.code}</div>
                    <div className="ao-fact__sub">{r.can}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
