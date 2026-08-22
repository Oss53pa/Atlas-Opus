/**
 * Écran-module générique piloté par données (gabarit unique du handoff).
 * Rendu : barre supérieure (titre + contexte + 1 action primaire) puis
 * rangée de KPI · grille 1.55fr/1fr (tableau principal + liste de faits).
 */
import { Topbar } from '../Shell';
import { Card, DataTable, FactList, Kpis, StateBlock } from '../kit';
import { findModule, type ScreenId } from '../nav';
import { moduleContent } from '../data';
import { useNav } from '../router';

export function ModuleScreen({ id }: { id: ScreenId }) {
  const { navigate } = useNav();
  const meta = findModule(id);
  const data = moduleContent[id];
  const title = meta?.module.title ?? 'Module';

  if (!data) {
    return (
      <>
        <Topbar title={title} context={meta ? `${meta.module.code} · ${meta.family.label}` : undefined} />
        <div className="ao-content">
          <StateBlock title="Écran en cours de câblage" desc="Ce module reprend le gabarit unique ; son contenu sera raccordé aux données de l’opération." />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={title}
        context={data.context}
        secondary={data.secondary ? { label: data.secondary } : undefined}
        primary={data.primary ? { label: data.primary } : undefined}
      />
      <div className="ao-content">
        <Kpis items={data.kpis} />
        <div className="ao-split">
          <Card title={data.table.title} meta={data.rowLink ? data.rowLinkHint ?? 'ouvrir le détail' : data.table.meta}>
            <DataTable cols={data.table.cols} rows={data.table.rows} onRow={data.rowLink ? () => navigate(data.rowLink!) : undefined} />
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title={data.facts.title} meta={data.facts.meta}>
              <FactList items={data.facts.items} />
            </Card>
            {data.facts2 && (
              <Card title={data.facts2.title} meta={data.facts2.meta}>
                <FactList items={data.facts2.items} />
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
