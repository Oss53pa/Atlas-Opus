/**
 * M21 — Reporting : snapshots datés & comparaison période à période (RG-M21-03).
 * Le snapshot fige les indicateurs déjà calculés par les modules (RG-M21-01) ;
 * aucune donnée financière n'est recalculée ici. Montants en unités majeures.
 */

export const REPORT_TYPES = ['hebdo', 'mensuel', 'deep_dive'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Cliché d'indicateurs figé à la génération (persisté en jsonb). */
export interface ReportData {
  coutTotal: number;
  recettes: number;
  recettesRealisees: number;
  marge: number;
  tauxMarge: number;
  tri: number | null;
  progress: number;
  alertsDanger: number;
  alertsEcheance: number;
}

export interface ReportSnapshot {
  id: string;
  tenantId: string;
  operationId: string;
  type: ReportType;
  period: string;
  data: ReportData;
  generatedAt: string;
}

export interface ReportInput {
  type: ReportType;
  period: string;
  data: ReportData;
}

/** Écart d'un indicateur entre deux clichés (RG-M21-03). */
export interface ReportDelta {
  coutTotal: number;
  recettes: number;
  recettesRealisees: number;
  marge: number;
  progress: number;
  alertsDanger: number;
  alertsEcheance: number;
}

/** Compare deux clichés (courant − précédent) pour la comparaison période à période. */
export function compareReports(previous: ReportData, current: ReportData): ReportDelta {
  return {
    coutTotal: current.coutTotal - previous.coutTotal,
    recettes: current.recettes - previous.recettes,
    recettesRealisees: current.recettesRealisees - previous.recettesRealisees,
    marge: current.marge - previous.marge,
    progress: current.progress - previous.progress,
    alertsDanger: current.alertsDanger - previous.alertsDanger,
    alertsEcheance: current.alertsEcheance - previous.alertsEcheance,
  };
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  hebdo: 'Hebdomadaire',
  mensuel: 'Mensuel',
  deep_dive: 'Deep Dive',
};

/** Formate un nombre en entier avec séparateur d'espace (export texte, indépendant du locale). */
function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Export Markdown d'un snapshot (RG-M21-04 : le contenu est déjà borné au
 * périmètre RLS par le repo qui a produit le snapshot). Pur : pas d'IO.
 */
export function reportToMarkdown(
  header: { operationName: string; currency: string },
  snapshot: ReportSnapshot,
): string {
  const d = snapshot.data;
  const pct = (r: number) => `${(r * 100).toFixed(1)} %`;
  return [
    `# Reporting ${REPORT_TYPE_LABEL[snapshot.type]} — ${header.operationName}`,
    ``,
    `Période : ${snapshot.period} · Généré le ${snapshot.generatedAt.slice(0, 10)}`,
    ``,
    `## Indicateurs`,
    ``,
    `| Indicateur | Valeur |`,
    `|---|---|`,
    `| Coût total | ${fmt(d.coutTotal)} ${header.currency} |`,
    `| Recettes prévues | ${fmt(d.recettes)} ${header.currency} |`,
    `| Recettes réalisées | ${fmt(d.recettesRealisees)} ${header.currency} |`,
    `| Marge | ${fmt(d.marge)} ${header.currency} |`,
    `| Taux de marge | ${pct(d.tauxMarge)} |`,
    `| TRI | ${d.tri != null ? pct(d.tri) : 'n/a'} |`,
    `| Avancement | ${pct(d.progress)} |`,
    ``,
    `## Alertes`,
    ``,
    `- Danger : ${d.alertsDanger}`,
    `- Échéance : ${d.alertsEcheance}`,
    ``,
  ].join('\n');
}
