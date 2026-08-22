/**
 * Écrans de détail Atlas Opus (34–50). Tous suivent le gabarit « détail » :
 * barre supérieure (titre + contexte + une action primaire) puis rangée de KPI
 * et grille 1.55fr/1fr (carte principale + listes de faits).
 */
import type { ReactNode } from 'react';
import { Topbar } from '../Shell';
import { Card, DataTable, FactList, Kpis, ReadField, cx } from '../kit';
import { detailMeta, type ScreenId } from '../nav';
import type { FactItem, Kpi, TableCell, TableCol } from '../data';

// ── Utilitaires locaux ───────────────────────────────────────────────────────
function DetailTop({ id, primary, secondary }: { id: string; primary?: string; secondary?: string }) {
  const m = detailMeta[id];
  return (
    <Topbar title={m.title} context={m.context} secondary={secondary ? { label: secondary } : undefined} primary={primary ? { label: primary } : undefined} />
  );
}
function Right({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>;
}
function Table({ cols, rows }: { cols: TableCol[]; rows: TableCell[][] }) {
  return <DataTable cols={cols} rows={rows} />;
}
const c = {
  t: (text: string, sub?: string): TableCell => ({ text, sub }),
  s: (sec: string): TableCell => ({ sec }),
  n: (num: string, o?: { accent?: boolean; muted?: boolean }): TableCell => ({ num, accentNum: o?.accent, mutedNum: o?.muted }),
  b: (label: string, kind: NonNullable<TableCell['badge']>['kind']): TableCell => ({ badge: { label, kind } }),
};

// ── 34 · Assistant de création d'opération ───────────────────────────────────
function CreateWizard() {
  const steps = [
    { n: '01', title: 'Identité', state: 'terminé', s: 'done' },
    { n: '02', title: 'Périmètre & programme', state: 'terminé', s: 'done' },
    { n: '03', title: 'Montage & financement', state: 'en cours', s: 'current' },
    { n: '04', title: 'Équipe & rôles', state: 'à venir', s: 'todo' },
    { n: '05', title: 'Bilan initial', state: 'à venir', s: 'todo' },
  ];
  const created: FactItem[] = [
    { label: 'Bilan prévisionnel', sub: '8 postes préremplis par gabarit', value: 'M4' },
    { label: 'Plan de trésorerie', sub: 'mensuel sur 36 mois', value: 'M4' },
    { label: 'Trame de planning', sub: '7 jalons contractuels', value: 'M13' },
    { label: 'Registre des risques', sub: '12 risques types VEFA', value: 'M20' },
    { label: 'Espace documentaire', sub: 'arborescence normalisée', value: 'M22' },
  ];
  const gates: FactItem[] = [
    { label: 'Unicité du nom', value: 'ok' },
    { label: 'Référence foncière renseignée', value: 'ok' },
    { label: 'Apport ≥ 20 % du coût', sub: '23,1 % — seuil RG-M5-01', value: 'ok' },
    { label: 'Directeur d’opération désigné', sub: 'obligatoire pour créer', value: 'étape 4', sev: 'accent' },
  ];
  return (
    <>
      <DetailTop id="create-wizard" secondary="Enregistrer et quitter" primary="Étape suivante" />
      <div className="ao-content">
        <Card title="Étapes" meta="les données saisies alimentent M1 à M4">
          <div className="ao-stepper">
            {steps.map((s) => (
              <div key={s.n} className={cx('ao-step', s.s === 'current' && 'is-current', s.s === 'todo' && 'is-todo')}>
                <div className="ao-step__num">{s.n}</div>
                <div className="ao-step__title">{s.title}</div>
                <div className="ao-step__state">{s.state}</div>
              </div>
            ))}
          </div>
        </Card>
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Montage & financement" meta="étape 3">
              <div className="ao-card__body ao-grid-2">
                <ReadField label="Structure porteuse" value="SCI Bellevue Développement" />
                <ReadField label="Régime" value="VEFA — vente en état futur d’achèvement" />
                <ReadField label="Apport fonds propres" value={<span className="num">1 120 M FCFA</span>} />
                <ReadField label="Crédit promoteur sollicité" value={<span className="num">2 600 M FCFA</span>} />
                <ReadField label="Banque chef de file" value="BICI Côte d’Ivoire" />
                <ReadField label="Taux prévisionnel" value={<span className="num">8,4 % · 36 mois</span>} />
              </div>
              <div style={{ padding: '0 18px 16px', fontSize: 13, color: 'var(--ao-muted)' }}>
                Le plan de déblocage sera généré dans M5 à partir de ces montants ; il reste modifiable jusqu’au premier appel de fonds.
              </div>
            </Card>
            <Card title="Récapitulatif des étapes validées" meta="modifiable jusqu’à la création">
              <Table
                cols={[{ label: 'Étape', grow: 1.2 }, { label: 'Saisie', grow: 2 }, { label: 'Cible module' }]}
                rows={[
                  [c.t('Identité'), c.s('Résidence Bellevue · Cocody, Abidjan'), c.s('M1')],
                  [c.t('Périmètre'), c.s('3 bâtiments · 84 logements · 9 240 m² SDP'), c.s('M1')],
                  [c.t('Programme'), c.s('T2 à T4 · 12 commerces en RDC'), c.s('M1 / M6')],
                  [c.t('Foncier'), c.s('TF 12 448 · promesse signée 14.02.2026'), c.s('M2')],
                  [c.t('Calendrier cible'), c.s('livraison T4 2027 · 22 mois travaux'), c.s('M13')],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Ce qui sera créé"><FactList items={created} /></Card>
            <Card title="Contrôles bloquants" meta="avant création"><FactList items={gates} /></Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 35 · Détail d'un poste de bilan ──────────────────────────────────────────
function PosteBilan() {
  const kpis: Kpi[] = [
    { label: 'Prévu', value: '2 940 M' },
    { label: 'Engagé', value: '1 862 M', sub: '63 % du prévu' },
    { label: 'Réalisé', value: '1 204 M', sub: 'situations visées' },
    { label: 'Reste à engager', value: '1 078 M' },
    { label: 'Écart projeté', value: '+42 M', sub: 'avenant lot 02', accent: true },
  ];
  return (
    <>
      <DetailTop id="poste-bilan" secondary="Historique du poste" primary="Ajouter une ligne" />
      <div className="ao-content">
        <Kpis items={kpis} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Lignes du poste" meta="marché · avenants · situations">
              <Table
                cols={[{ label: 'Ligne', grow: 2 }, { label: 'Prévu', num: true }, { label: 'Engagé', num: true }, { label: 'Réalisé', num: true }, { label: 'Écart', num: true }]}
                rows={[
                  [c.t('Lot 01 — terrassement / VRD', 'ETP Sahel · marché 03/2026'), c.n('310 M'), c.n('310 M', { muted: true }), c.n('298 M', { muted: true }), c.n('—', { muted: true })],
                  [c.t('Lot 02 — gros œuvre', 'EGCI Bâtiment · avenant 1 en cours'), c.n('1 240 M'), c.n('1 282 M', { muted: true }), c.n('694 M', { muted: true }), c.n('+42 M', { accent: true })],
                  [c.t('Lot 03 — clos couvert', 'attribution en approbation'), c.n('486 M'), c.n('—', { muted: true }), c.n('—', { muted: true }), c.n('—', { muted: true })],
                  [c.t('Lot 04 — corps d’état techniques', 'consultation lancée 02.08'), c.n('520 M'), c.n('—', { muted: true }), c.n('—', { muted: true }), c.n('—', { muted: true })],
                  [c.t('Lot 05 — finitions', 'non consulté'), c.n('284 M'), c.n('—', { muted: true }), c.n('—', { muted: true }), c.n('—', { muted: true })],
                  [c.t('Compte prorata & installations', 'réparti sur lots'), c.n('100 M'), c.n('270 M', { muted: true }), c.n('212 M', { muted: true }), c.n('—', { muted: true })],
                ]}
              />
            </Card>
            <Card title="Rattachements" meta="toute ligne renvoie à sa source">
              <div className="ao-card__body ao-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[['Marchés', '2 signés · 1 en attribution'], ['Situations', '7 · dont 3 à valider'], ['Avenants', '1 · +42 M'], ['Pièces liées', '34 documents']].map(([l, v]) => (
                  <div key={l}><div className="ao-field__label">{l}</div><div style={{ fontSize: 14, marginTop: 6 }}>{v}</div></div>
                ))}
              </div>
            </Card>
          </div>
          <Right>
            <Card title="Écriture sélectionnée" meta="lot 02 — gros œuvre">
              <FactList items={[
                { label: 'Marché initial', sub: 'notifié le 11.03.2026', value: '1 240 M' },
                { label: 'Avenant n° 1', sub: 'reprise de fondations spéciales', value: '+42 M', sev: 'accent' },
                { label: 'Engagé total', value: '1 282 M' },
                { label: 'Réalisé cumulé', sub: '54 % — situations 1 à 6', value: '694 M' },
                { label: 'Retenue de garantie', sub: '5 % · libération à la GPA', value: '34,7 M' },
              ]} />
            </Card>
            <Card title="Contrôles" meta="RG-M4">
              <FactList items={[
                { label: 'Somme des lignes = poste', value: 'ok' },
                { label: 'Engagé ≤ prévu + aléas', sub: 'dépassement absorbé par aléas', value: 'alerte', sev: 'accent' },
                { label: 'Réalisé ≤ engagé', value: 'ok' },
                { label: 'Verrouillage arrêté', sub: 'dernier arrêté 30.06.2026', value: 'libre' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 36 · Plan de trésorerie ──────────────────────────────────────────────────
const tresoMonths = [
  { m: 'S 26', out: 62, in: 40 }, { m: 'O', out: 78, in: 44 }, { m: 'N', out: 96, in: 30 },
  { m: 'D', out: 88, in: 52 }, { m: 'J 27', out: 72, in: 68 }, { m: 'F', out: 84, in: 74 },
  { m: 'M', out: 90, in: 96 }, { m: 'A', out: 76, in: 110 }, { m: 'M', out: 70, in: 128 },
  { m: 'J', out: 64, in: 120 }, { m: 'J', out: 58, in: 116 }, { m: 'A', out: 52, in: 132 },
];
function PlanTresorerie() {
  const max = Math.max(...tresoMonths.flatMap((t) => [t.out, t.in]));
  const kpis: Kpi[] = [
    { label: 'Point bas', value: '−418 M', sub: 'novembre 2026', accent: true },
    { label: 'Encaissé à date', value: '2,08 Md', sub: '38 % des ventes' },
    { label: 'Décaissé à date', value: '2,65 Md' },
    { label: 'Solde projeté fin', value: '+612 M', sub: 'à la livraison' },
    { label: 'Horizon', value: '36 mois', sub: 'cumulé' },
  ];
  return (
    <>
      <DetailTop id="plan-tresorerie" secondary="Exporter" primary="Simuler un flux" />
      <div className="ao-content">
        <Kpis items={kpis} />
        <div className="ao-split">
          <Card title="Flux mensuels" meta="décaissements ▉ · encaissements ▨">
            <div className="ao-card__body">
              <div className="ao-treso">
                {tresoMonths.map((t, i) => (
                  <div className="ao-treso__group" key={i}>
                    <div className="ao-treso__bar ao-treso__bar--out" style={{ height: `${(t.out / max) * 100}%` }} />
                    <div className="ao-treso__bar ao-treso__bar--in" style={{ height: `${(t.in / max) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {tresoMonths.map((t, i) => <div className="ao-treso__label" key={i} style={{ flex: 1 }}>{t.m}</div>)}
              </div>
            </div>
          </Card>
          <Right>
            <Card title="Besoin de financement">
              <FactList items={[
                { label: 'Pic de besoin', sub: 'novembre 2026', value: '−418 M', sev: 'accent' },
                { label: 'Découvert autorisé', sub: 'ligne BICI', value: '500 M' },
                { label: 'Marge de sécurité', value: '82 M' },
              ]} />
            </Card>
            <Card title="Sensibilité">
              <FactList items={[
                { label: 'Avenant lot 02 intégré', sub: 'point bas −384 M → −418 M', value: '−34 M', sev: 'accent' },
                { label: 'Retard ventes 1 mois', value: '−120 M', sev: 'neutral' },
                { label: 'Appel de fonds S4 avancé', value: '+96 M', sev: 'neutral' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 37 · Arrêtés de bilan ────────────────────────────────────────────────────
function Arretes() {
  return (
    <>
      <DetailTop id="arretes" secondary="Comparer deux arrêtés" primary="Arrêter le bilan" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Arrêtés scellés', value: '6', sub: 'depuis le montage' },
          { label: 'Dernier arrêté', value: '31.07.2026' },
          { label: 'Marge figée', value: '+648 M', sub: 'à cette date' },
          { label: 'Écart depuis', value: '−36 M', sub: 'bilan vivant', accent: true },
          { label: 'Fréquence', value: 'mensuelle' },
        ]} />
        <div className="ao-split">
          <Card title="Historique des arrêtés" meta="snapshots scellés, comparables">
            <Table
              cols={[{ label: 'Arrêté', grow: 1.6 }, { label: 'Coût figé', num: true }, { label: 'Marge', num: true }, { label: 'Auteur' }, { label: 'Statut' }]}
              rows={[
                [c.t('31 juillet 2026', 'semestriel'), c.n('4 808 M'), c.n('+648 M'), c.s('K. Traoré'), c.b('scellé', 'success')],
                [c.t('30 juin 2026', 'mensuel'), c.n('4 792 M'), c.n('+660 M'), c.s('K. Traoré'), c.b('scellé', 'success')],
                [c.t('31 mai 2026', 'mensuel'), c.n('4 780 M'), c.n('+668 M'), c.s('A. Koné'), c.b('scellé', 'success')],
                [c.t('30 avril 2026', 'trimestriel'), c.n('4 765 M'), c.n('+675 M'), c.s('A. Koné'), c.b('scellé', 'success')],
              ]}
            />
          </Card>
          <Right>
            <Card title="Bilan vivant vs figé" meta="RG-M4-10">
              <FactList items={[
                { label: 'Coût vivant', sub: 'recalculé il y a 4 min', value: '4 850 M' },
                { label: 'Écart vs dernier arrêté', sub: 'avenant +42 M non figé', value: '+42 M', sev: 'accent' },
                { label: 'Marge vivante', value: '+612 M' },
                { label: 'Érosion de marge', value: '−36 M', sev: 'accent' },
              ]} />
            </Card>
            <Card title="Procédure">
              <FactList items={[
                { label: 'Irréversible', sub: 'confirmation + motif obligatoires', sev: 'neutral' },
                { label: 'Horodatage serveur', sub: 'UTC+0 · précision seconde', sev: 'neutral' },
                { label: 'Lecture seule ensuite', sub: 'version figée non modifiable', sev: 'neutral' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 38 · Fiche intervenant ───────────────────────────────────────────────────
function Intervenant() {
  return (
    <>
      <DetailTop id="intervenant" secondary="Contrats liés" primary="Suspendre le paiement" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Marché', value: '1 282 M', sub: 'lot 02 gros œuvre' },
          { label: 'Réalisé', value: '694 M', sub: '54 %' },
          { label: 'Conformité', value: 'expirée', sub: 'décennale · bloquant', accent: true },
          { label: 'Retenue de garantie', value: '34,7 M' },
          { label: 'Litiges', value: '0' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Identité & contrat">
              <div className="ao-card__body ao-grid-2">
                <ReadField label="Raison sociale" value="EGCI Bâtiment SA" />
                <ReadField label="Rôle" value="Entreprise — gros œuvre" />
                <ReadField label="RCCM" value={<span className="num">CI-ABJ-2019-B-4412</span>} />
                <ReadField label="Marché" value={<span className="num">MA-2025-02 · lot 02</span>} />
                <ReadField label="Contact" value="B. Kouamé · direction travaux" />
                <ReadField label="Notifié le" value={<span className="num">11.03.2026</span>} />
              </div>
            </Card>
            <Card title="Conformités" meta="F6 · RG-M7-04">
              <Table
                cols={[{ label: 'Pièce', grow: 2 }, { label: 'Référence' }, { label: 'Échéance', num: true }, { label: 'Statut' }]}
                rows={[
                  [c.t('Attestation décennale', 'assureur AXA CI'), c.s('DEC-2024-118'), c.n('31.07.2026'), c.b('expirée', 'danger')],
                  [c.t('Attestation fiscale', 'DGI'), c.s('AF-2026-Q3'), c.n('30.09.2026'), c.b('à jour', 'success')],
                  [c.t('CNPS', 'cotisations'), c.s('T2 2026'), c.n('—'), c.b('à jour', 'success')],
                  [c.t('RC professionnelle', 'NSIA'), c.s('RC-2026-77'), c.n('31.12.2026'), c.b('valide', 'success')],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Impact du blocage" meta="M16">
              <FactList items={[
                { label: 'Situation n° 7 suspendue', sub: '184 M en attente', value: '184 M', sev: 'danger' },
                { label: 'Risque associé', sub: 'R-11 · criticité 16', value: 'R-11', sev: 'accent' },
                { label: 'Action de chantier', sub: '24.1 — régulariser', value: 'en retard', sev: 'accent' },
              ]} />
            </Card>
            <Card title="Historique">
              <FactList items={[
                { label: 'Attestation expirée', sub: 'détectée le 19.08.2026', value: '19.08' },
                { label: 'Dernier paiement', sub: 'situation n° 6', value: '171,2 M' },
                { label: 'Ancienneté', sub: 'depuis mars 2026', value: '5 mois' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 39 · Tableau des assurances ──────────────────────────────────────────────
function Assurances() {
  return (
    <>
      <DetailTop id="assurances" secondary="Relancer" primary="Ajouter une police" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Polices', value: '9', sub: '2 obligatoires' },
          { label: 'Valides', value: '8 / 9', sub: '1 expirée', accent: true },
          { label: 'Dommages-ouvrage', value: 'valide' },
          { label: 'TRC', value: 'valide' },
          { label: 'Prochaine échéance', value: '30.09' },
        ]} />
        <Card title="Polices & attestations" meta="F6 · échéances suivies">
          <Table
            cols={[{ label: 'Garantie', grow: 2 }, { label: 'Souscripteur' }, { label: 'Assureur' }, { label: 'Échéance', num: true }, { label: 'Statut' }]}
            rows={[
              [c.t('Décennale', 'EGCI Bâtiment — lot 02'), c.s('Entreprise'), c.s('AXA CI'), c.n('31.07.2026'), c.b('expirée', 'danger')],
              [c.t('Dommages-ouvrage', 'opération'), c.s('MOA'), c.s('NSIA'), c.n('30.06.2027'), c.b('valide', 'success')],
              [c.t('Tous risques chantier', 'opération'), c.s('MOA'), c.s('Saham'), c.n('31.12.2026'), c.b('valide', 'success')],
              [c.t('RC maître d’ouvrage', 'opération'), c.s('MOA'), c.s('NSIA'), c.n('31.12.2026'), c.b('valide', 'success')],
              [c.t('Décennale', 'Sotraci — VRD'), c.s('Entreprise'), c.s('Allianz CI'), c.n('30.11.2026'), c.b('valide', 'success')],
              [c.t('RC décennale MOE', 'Atelier K2M'), c.s('MOE'), c.s('AXA CI'), c.n('30.09.2026'), c.b('à jour', 'success')],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

// ── 40 · Registre des risques & RACI ─────────────────────────────────────────
function RisquesRaci() {
  return (
    <>
      <DetailTop id="risques-raci" secondary="Matrice RACI" primary="Déclarer un risque" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Risques ouverts', value: '11', sub: '2 majeurs', accent: true },
          { label: 'Criticité max', value: '16', sub: 'R-11' },
          { label: 'Plans d’action', value: '8', sub: 'en cours' },
          { label: 'HSSE', value: '0', sub: 'accident déclarable' },
          { label: 'Revue', value: 'hebdo', sub: 'comité risques' },
        ]} />
        <div className="ao-split">
          <Card title="Registre" meta="tri par criticité (P × G)">
            <Table
              cols={[{ label: 'Risque', grow: 2 }, { label: 'P', num: true }, { label: 'G', num: true }, { label: 'Criticité', num: true }, { label: 'Statut' }]}
              rows={[
                [c.t('R-11 — décennale EGCI expirée', 'blocage de paiement'), c.n('4'), c.n('4'), c.n('16', { accent: true }), c.b('majeur', 'danger')],
                [c.t('R-08 — dérive gros œuvre', 'chemin critique +16 j'), c.n('3'), c.n('4'), c.n('12', { accent: true }), c.b('majeur', 'accent')],
                [c.t('R-05 — nappe / fondations', 'reprise en cours'), c.n('3'), c.n('3'), c.n('9'), c.b('suivi', 'neutral')],
                [c.t('R-04 — écoulement T4', 'commercial lent'), c.n('2'), c.n('3'), c.n('6'), c.b('suivi', 'neutral')],
                [c.t('R-02 — intempéries', 'saison des pluies'), c.n('2'), c.n('2'), c.n('4'), c.b('accepté', 'neutral')],
              ]}
            />
          </Card>
          <Right>
            <Card title="RACI — R-11">
              <FactList items={[
                { label: 'Responsable', sub: 'régularise la conformité', value: 'Finance' },
                { label: 'Approbateur', sub: 'lève le blocage de paiement', value: 'MOA' },
                { label: 'Consulté', value: 'MOE · CT' },
                { label: 'Informé', value: 'EGCI Bâtiment' },
              ]} />
            </Card>
            <Card title="Plan d’action R-11">
              <FactList items={[
                { label: 'Régulariser la décennale', sub: 'action 24.1 · échéance 22.08', value: 'en retard', sev: 'danger' },
                { label: 'Suspendre la situation n° 7', sub: 'appliqué', value: 'fait', sev: 'neutral' },
                { label: 'Arbitrage comité', sub: '05.09.2026', value: 'planifié', sev: 'accent' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 41 · Simulateur d'impact ─────────────────────────────────────────────────
function Simulateur() {
  return (
    <>
      <DetailTop id="simulateur" secondary="Comparer à la baseline" primary="Soumettre à approbation" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Coût', value: '4 850 M', sub: 'avant 4 808 M', accent: true },
          { label: 'Délai', value: '+12 j', sub: 'livraison T4 2027 tenue', accent: true },
          { label: 'Marge', value: '+612 M', sub: 'avant +654 M', accent: true },
          { label: 'TRI', value: '14,2 %', sub: '−0,4 pt' },
          { label: 'Point bas tréso', value: '−418 M', sub: '−34 M', accent: true },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Modification simulée" meta="reprise de fondations spéciales — lot 02">
              <div className="ao-card__body ao-grid-2">
                <ReadField label="Origine" value="étude de sol complémentaire G5" />
                <ReadField label="Nature" value="travaux supplémentaires" />
                <ReadField label="Montant demandé" value={<span className="num">42 M FCFA</span>} />
                <ReadField label="Impact planning" value={<span className="num">12 jours ouvrés</span>} />
                <ReadField label="Imputation proposée" value={<span className="num">aléas travaux (80 M)</span>} />
                <ReadField label="Décision requise" value={<span className="num">moa_director · RG-M14-03</span>} />
              </div>
            </Card>
            <Card title="Propagation" meta="ce que la validation modifierait">
              <Table
                cols={[{ label: 'Module', grow: 1 }, { label: 'Objet', grow: 1.4 }, { label: 'Avant', num: true }, { label: 'Après', num: true }]}
                rows={[
                  [c.s('M4 — Bilan'), c.s('poste travaux'), c.n('2 898 M', { muted: true }), c.n('2 940 M')],
                  [c.s('M4 — Trésorerie'), c.s('point bas nov.'), c.n('−384 M', { muted: true }), c.n('−418 M', { accent: true })],
                  [c.s('M8 — Marché lot 02'), c.s('montant engagé'), c.n('1 240 M', { muted: true }), c.n('1 282 M')],
                  [c.s('M13 — Planning'), c.s('fin gros œuvre'), c.n('14.11.2026', { muted: true }), c.n('30.11.2026')],
                  [c.s('M17 — Cautions'), c.s('bonne fin 5 %'), c.n('62,0 M', { muted: true }), c.n('64,1 M')],
                  [c.s('M20 — Risques'), c.s('R-04 criticité'), c.n('moyenne', { muted: true }), c.n('élevée', { accent: true })],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Scénarios" meta="comparaison">
              <FactList items={[
                { label: 'Validation intégrale', sub: 'marge +612 M · 12 j', value: '+42 M', sev: 'accent' },
                { label: 'Prise en charge partielle', sub: 'marge +630 M · négociation', value: '+24 M' },
                { label: 'Refus', sub: 'risque de réclamation', value: '0 M' },
                { label: 'Report en fin de chantier', sub: 'délai porté à 21 j', value: '+46 M' },
              ]} />
            </Card>
            <Card title="Marge de manœuvre">
              <FactList items={[
                { label: 'Aléas disponibles', sub: 'après avenant : 38 M', value: '80 M' },
                { label: 'Marge cible actionnaire', sub: 'projetée 12,6 %', value: '12,0 %' },
                { label: 'Flottement au planning', sub: 'chemin critique', value: '9 j' },
                { label: 'Seuil d’alerte marge', sub: 'non atteint', value: '11,5 %' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 42 · Jalons & baseline ───────────────────────────────────────────────────
interface Jalon { label: string; refStart: number; refW: number; projStart: number; projW: number; drift: boolean; state: string; baseline: string; proj: string; }
const jalons: Jalon[] = [
  { label: 'Acquisition du foncier', refStart: 4, refW: 10, projStart: 4, projW: 10, drift: false, state: 'tenu', baseline: '14.02.2026', proj: '14.02.2026' },
  { label: 'Permis de construire', refStart: 14, refW: 12, projStart: 16, projW: 12, drift: true, state: '+15 j', baseline: '18.05.2026', proj: '02.06.2026' },
  { label: 'Ordre de service lot 02', refStart: 26, refW: 10, projStart: 26, projW: 10, drift: false, state: 'tenu', baseline: '11.06.2026', proj: '11.06.2026' },
  { label: 'Achèvement fondations', refStart: 34, refW: 12, projStart: 37, projW: 12, drift: true, state: '+12 j', baseline: '30.07.2026', proj: '11.08.2026' },
  { label: 'Achèvement gros œuvre', refStart: 46, refW: 14, projStart: 50, projW: 14, drift: true, state: '+16 j', baseline: '14.11.2026', proj: '30.11.2026' },
  { label: 'Clos couvert', refStart: 60, refW: 12, projStart: 64, projW: 12, drift: true, state: '+15 j', baseline: '28.02.2027', proj: '15.03.2027' },
  { label: 'Réception', refStart: 74, refW: 12, projStart: 74, projW: 12, drift: false, state: 'tenu', baseline: '30.09.2027', proj: '30.09.2027' },
];
function Jalons() {
  return (
    <>
      <DetailTop id="jalons" secondary="Historique des baselines" primary="Replanifier" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Jalons', value: '7', sub: '3 tenus' },
          { label: 'Dérive maximale', value: '+16 j', sub: 'gros œuvre', accent: true },
          { label: 'Marge consommée', value: '16 / 45 j', sub: 'flottement contractuel' },
          { label: 'Livraison', value: 'T4 2027', sub: 'inchangée' },
          { label: 'Pénalités exposées', value: '0 M', sub: 'seuil à 30 j' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Jalons contractuels" meta="baseline v2 ▨ · projeté ▉">
              <div className="ao-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {jalons.map((j) => (
                  <div key={j.label} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 0.4fr', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 14, color: 'var(--ao-primary)' }}>{j.label}</div>
                    <div className="ao-milestone">
                      <div className="ao-milestone__bar ao-milestone__bar--ref" style={{ left: `${j.refStart}%`, width: `${j.refW}%` }} />
                      <div className={cx('ao-milestone__bar', j.drift ? 'ao-milestone__bar--drift' : 'ao-milestone__bar--ontime')} style={{ left: `${j.projStart}%`, width: `${j.projW}%` }} />
                    </div>
                    <div className="num" style={{ textAlign: 'right', fontSize: 13, color: j.drift ? 'var(--ao-accent)' : 'var(--ao-muted)' }}>{j.state}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Détail" meta="baseline / projeté">
              <Table
                cols={[{ label: 'Jalon', grow: 2 }, { label: 'Baseline v2', num: true }, { label: 'Projeté', num: true }, { label: 'Écart', num: true }]}
                rows={jalons.map((j) => [c.t(j.label), c.n(j.baseline, { muted: true }), c.n(j.proj), c.n(j.state, j.drift ? { accent: true } : { muted: true })])}
              />
            </Card>
          </div>
          <Right>
            <Card title="Baselines" meta="figées · comparables">
              <FactList items={[
                { label: 'v2 — 11.06.2026', sub: 'ordre de service lot 02', value: 'active', sev: 'accent' },
                { label: 'v1 — 02.06.2026', sub: 'obtention du permis', value: 'archivée' },
                { label: 'v0 — 31.03.2025', sub: 'planning de montage', value: 'référence' },
              ]} />
            </Card>
            <Card title="Causes de dérive" meta="analysées">
              <FactList items={[
                { label: 'Étude de sol complémentaire', sub: 'fondations spéciales — R-04', value: '+12 j', sev: 'accent' },
                { label: 'Instruction du permis', sub: 'absorbée par le flottement', value: '+15 j', sev: 'accent' },
                { label: 'Intempéries juin', sub: 'reprise sur nuits', value: '+4 j' },
                { label: 'Replanification à décider', sub: '05.09.2026', value: 'comité', sev: 'neutral' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 43 · Détail d'un marché ──────────────────────────────────────────────────
function Marche() {
  return (
    <>
      <DetailTop id="marche" secondary="Pièces du marché" primary="Établir un avenant" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Montant initial', value: '1 240 M' },
          { label: 'Avenants', value: '+42 M', sub: '1 en approbation', accent: true },
          { label: 'Payé', value: '694 M', sub: '54 % de l’engagé' },
          { label: 'Retenue de garantie', value: '34,7 M', sub: '5 % · libérée à la GPA' },
          { label: 'Avancement', value: '58 %', sub: 'situation n° 7 en cours' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Conditions contractuelles" meta="CCAP · CCAG travaux">
              <div className="ao-card__body ao-grid-2">
                <ReadField label="Type de marché" value="forfaitaire · lot séparé" />
                <ReadField label="Notification" value={<span className="num">11.03.2026</span>} />
                <ReadField label="Délai d’exécution" value={<span className="num">8 mois · fin 14.11.2026</span>} />
                <ReadField label="Pénalités de retard" value={<span className="num">1/1000 par jour · plafond 5 %</span>} />
                <ReadField label="Révision de prix" value={<span className="num">index BT01 · trimestriel</span>} />
                <ReadField label="Retenue de garantie" value={<span className="num">5 % · cautionnable</span>} />
              </div>
            </Card>
            <Card title="Situations" meta="cumul des paiements">
              <Table
                cols={[{ label: 'N°', grow: 0.4 }, { label: 'Période', grow: 1.4 }, { label: 'Montant', num: true }, { label: 'Cumul', num: true }, { label: 'Statut' }]}
                rows={[
                  [c.s('05'), c.s('mai 2026'), c.n('142 M'), c.n('412 M', { muted: true }), c.b('payée', 'success')],
                  [c.s('06'), c.s('juin – juillet 2026'), c.n('282 M'), c.n('694 M', { muted: true }), c.b('payée', 'success')],
                  [c.s('07'), c.s('août 2026'), c.n('184 M'), c.n('878 M', { muted: true }), c.b('à valider', 'accent')],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Avenants">
              <FactList items={[{ label: 'N° 1 — fondations spéciales', sub: 'en approbation moa_director', value: '+42 M', sev: 'accent' }]} />
            </Card>
            <Card title="Garanties & conformité" meta="M7 / M17">
              <FactList items={[
                { label: 'Cautionnement de bonne fin', sub: 'BICI · CBF-0043', value: '62,0 M' },
                { label: 'Attestation décennale', sub: 'bloque le paiement', value: 'expirée', sev: 'danger' },
                { label: 'Attestation fiscale', value: '30.09.2026' },
                { label: 'CNPS', sub: 'T2 2026', value: 'à jour' },
              ]} />
            </Card>
            <Card title="Exécution" meta="M14">
              <FactList items={[
                { label: 'Réserves ouvertes', value: '2' },
                { label: 'Ordres de service', value: '3' },
                { label: 'Dernier constat', value: '18.08.2026' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 44 · Situation de travaux ────────────────────────────────────────────────
function Situation() {
  return (
    <>
      <DetailTop id="situation" secondary="Pièces jointes" primary="Mettre en paiement" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Brut travaux', value: '198 M', sub: 'période août 2026' },
          { label: 'Net à payer', value: '184 M', sub: 'après retenues' },
          { label: 'Statut', value: 'suspendu', sub: 'contrôle bloquant', accent: true },
          { label: 'Retenue de garantie', value: '9,2 M', sub: '5 %' },
          { label: 'Visa MOE', value: 'obtenu', sub: 'le 17.08.2026' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Décompte" meta="net = base HT + TVA − retenues">
              <Table
                cols={[{ label: 'Ligne', grow: 2 }, { label: 'Base', num: true }, { label: 'Montant', num: true }]}
                rows={[
                  [c.t('Brut travaux', 'période'), c.n('198 M', { muted: true }), c.n('198 M')],
                  [c.t('TVA', 'récupérable'), c.n('18 %', { muted: true }), c.n('—', { muted: true })],
                  [c.t('Retenue de garantie', '5 % du brut'), c.n('198 M', { muted: true }), c.n('−9,2 M', { accent: true })],
                  [c.t('Avance remboursée', 'quote-part'), c.n('—', { muted: true }), c.n('−4,8 M')],
                  [c.t('Pénalités de retard', 'néant'), c.n('—', { muted: true }), c.n('—', { muted: true })],
                ]}
              />
              <div className="ao-row ao-row--total" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div className="ao-cell--strong">Net à payer</div>
                <div />
                <div className="ao-cell--num ao-cell--strong">184,0 M</div>
              </div>
            </Card>
          </div>
          <Right>
            <Card title="Contrôles de mise en paiement">
              <FactList items={[
                { label: 'Attestation décennale', sub: 'expirée le 31.07.2026', value: 'bloquant', sev: 'danger' },
                { label: 'Visa MOE', sub: 'obtenu', value: 'ok' },
                { label: 'Marché en cours', sub: 'lot 02 gros œuvre', value: 'ok' },
                { label: 'Seuil d’approbation', sub: '> 50 M → comité', value: 'comité', sev: 'accent' },
              ]} />
            </Card>
            <Card title="Levée du blocage" meta="M7">
              <FactList items={[
                { label: 'Régulariser la décennale', sub: 'EGCI Bâtiment', value: 'requis', sev: 'danger' },
                { label: 'Fiche intervenant', sub: 'voir la conformité', value: 'M7', sev: 'neutral' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 45 · Détail d'une offre ──────────────────────────────────────────────────
function Offre() {
  return (
    <>
      <DetailTop id="offre" secondary="Grille de notation" primary="Proposer l’attribution" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Prix', value: '612 M', sub: '−4,4 % / estim.' },
          { label: 'Note technique', value: '82 / 100' },
          { label: 'Note globale', value: '88,4', sub: 'rang 1 sur 4', accent: true },
          { label: 'Délai', value: '8 mois' },
          { label: 'Rapport', value: 'scellé', sub: 'ouverture 24.08' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Analyse critère par critère" meta="pondération 60 / 40">
              <Table
                cols={[{ label: 'Critère', grow: 2 }, { label: 'Poids', num: true }, { label: 'Note', num: true }, { label: 'Pondérée', num: true }]}
                rows={[
                  [c.t('Valeur technique', 'mémoire · moyens'), c.n('35 %'), c.n('82 / 100'), c.n('28,7')],
                  [c.t('Délai', 'planning proposé'), c.n('15 %'), c.n('90 / 100'), c.n('13,5')],
                  [c.t('Prix', 'moins-disant'), c.n('40 %'), c.n('96 / 100'), c.n('38,4')],
                  [c.t('Références', 'similaires'), c.n('10 %'), c.n('78 / 100'), c.n('7,8')],
                ]}
              />
              <div className="ao-row ao-row--total" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <div className="ao-cell--strong">Total</div>
                <div /><div />
                <div className="ao-cell--num ao-cell--strong ao-cell--num-accent">88,4</div>
              </div>
            </Card>
          </div>
          <Right>
            <Card title="Classement" meta="lot 03 · CVC">
              <FactList items={[
                { label: 'Clima CI', sub: '612 M · 8 mois', value: '88,4', sev: 'accent' },
                { label: 'Froid Services', sub: '628 M · 9 mois', value: '85,1' },
                { label: 'Techni-Air', sub: '655 M · 8 mois', value: '83,0' },
                { label: 'Bâti-Clim', sub: '689 M · 10 mois', value: '74,2' },
              ]} />
            </Card>
            <Card title="Recevabilité">
              <FactList items={[
                { label: 'Candidature conforme', value: 'ok' },
                { label: 'Garanties fournies', sub: 'bonne fin · avance', value: 'ok' },
                { label: 'Offre anormalement basse', sub: 'test non déclenché', value: 'non' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 46 · Fiche de RFI ────────────────────────────────────────────────────────
function Rfi() {
  return (
    <>
      <DetailTop id="rfi" secondary="Fil de discussion" primary="Répondre" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Statut', value: 'bloquante', sub: 'ouverte le 12.08', accent: true },
          { label: 'Délai écoulé', value: '10 j', sub: 'objectif 5 j', accent: true },
          { label: 'Émetteur', value: 'EGCI', sub: 'lot 02' },
          { label: 'Impact', value: '+2 j', sub: 'chemin critique' },
          { label: 'Documents liés', value: '3' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Demande" meta="RFI-042">
              <div className="ao-card__body ao-grid-2">
                <ReadField label="Objet" value="Réservation de gaine / voile porteur" />
                <ReadField label="Localisation" value="R+2 · voile file C" />
                <ReadField label="Émetteur" value="EGCI Bâtiment · B. Kouamé" />
                <ReadField label="Destinataire" value="Atelier K2M · MOE structure" />
                <ReadField label="Ouverte le" value={<span className="num">12.08.2026</span>} />
                <ReadField label="Échéance" value={<span className="num">17.08.2026 · dépassée</span>} />
              </div>
              <div style={{ padding: '0 18px 16px', fontSize: 13, color: 'var(--ao-body)' }}>
                La réservation prévue au plan CVC traverse un voile porteur. Confirmer le report de la réservation ou fournir un
                renfort validé par le BET structure avant coulage.
              </div>
            </Card>
          </div>
          <Right>
            <Card title="Chaîne d’impact">
              <FactList items={[
                { label: 'Bloque le visa STR-EXE-118', sub: 'indice C', value: 'M11', sev: 'danger' },
                { label: 'Reporte le coulage R+2', sub: 'au 28.08.2026', value: '+2 j', sev: 'accent' },
                { label: 'Dérive gros œuvre', sub: 'jalon +16 j', value: 'M13', sev: 'accent' },
                { label: 'Décision actée', sub: 'CR de chantier du 19.08', value: 'M14' },
              ]} />
            </Card>
            <Card title="Historique">
              <FactList items={[
                { label: 'Ouverte', value: '12.08 · 09 h' },
                { label: 'Relance MOE', value: '16.08 · 11 h' },
                { label: 'Escaladée', sub: 'délai dépassé', value: '17.08', sev: 'accent' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 47 · Visa d'un document ──────────────────────────────────────────────────
function Visa() {
  return (
    <>
      <DetailTop id="visa" secondary="Indices précédents" primary="Émettre un visa" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Document', value: 'STR-EXE-118', sub: 'voile porteur R+2' },
          { label: 'Indice', value: 'C', sub: 'déposé le 14.08' },
          { label: 'Visa demandé', value: 'A', sub: 'bon pour exécution', accent: true },
          { label: 'Émetteur', value: 'K2M', sub: 'MOE structure' },
          { label: 'Statut', value: 'bloqué', sub: 'RFI-042', accent: true },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Circuit de visa" meta="RG-M11">
              <Table
                cols={[{ label: 'Intervenant', grow: 2 }, { label: 'Rôle' }, { label: 'Visa', num: true }, { label: 'Statut' }]}
                rows={[
                  [c.t('Bureau Veritas', 'contrôle technique'), c.s('CT'), c.n('B'), c.b('avec observations', 'accent')],
                  [c.t('BET Sol', 'note de calcul'), c.s('BET'), c.n('A'), c.b('favorable', 'success')],
                  [c.t('Atelier K2M', 'MOE structure'), c.s('MOE'), c.n('A'), c.b('en attente RFI', 'danger')],
                  [c.t('MOA', 'diffusion contrôlée'), c.s('MOA'), c.n('—'), c.b('à venir', 'neutral')],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Blocage" meta="M12">
              <FactList items={[
                { label: 'RFI-042 en attente', sub: 'gaine / voile porteur', value: 'ouverte', sev: 'danger' },
                { label: 'Visa A impossible', sub: 'tant que RFI ouverte', value: 'bloqué', sev: 'danger' },
                { label: 'Alternative', sub: 'visa B avec réserve', value: 'possible', sev: 'accent' },
              ]} />
            </Card>
            <Card title="Diffusion">
              <FactList items={[
                { label: 'Indice courant', value: 'C' },
                { label: 'Destinataires', sub: 'EGCI · CT · BET', value: '4' },
                { label: 'Dernière diffusion', value: '14.08.2026' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 48 · Compte rendu de chantier ────────────────────────────────────────────
function CrChantier() {
  return (
    <>
      <DetailTop id="cr-chantier" secondary="CR précédents" primary="Diffuser le compte rendu" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Réunion', value: '19.08.2026', sub: 'hebdomadaire' },
          { label: 'Actions ouvertes', value: '17', sub: '3 en retard', accent: true },
          { label: 'Effectif', value: '82', sub: 'compagnons' },
          { label: 'Avancement', value: '58 %', sub: 'physique' },
          { label: 'Présents', value: '9', sub: 'MOA · MOE · entreprises' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Actions" meta="CR n° 31">
              <Table
                cols={[{ label: 'Action', grow: 2 }, { label: 'Pilote' }, { label: 'Échéance', num: true }, { label: 'Statut' }]}
                rows={[
                  [c.t('24.1 — régulariser la décennale', 'EGCI Bâtiment'), c.s('Finance'), c.n('22.08'), c.b('en retard', 'danger')],
                  [c.t('24.2 — arbitrer avenant lot 02', 'reprise fondations'), c.s('MOA'), c.n('05.09'), c.b('à traiter', 'accent')],
                  [c.t('24.3 — replanifier coulage R+2', 'RFI-042'), c.s('MOE'), c.n('28.08'), c.b('en cours', 'neutral')],
                  [c.t('23.7 — réception ferraillage', 'lot 02'), c.s('Contrôle'), c.n('20.08'), c.b('soldée', 'success')],
                  [c.t('23.4 — plan de synthèse réseaux', 'concessionnaires'), c.s('MOE'), c.n('30.08'), c.b('en cours', 'neutral')],
                ]}
              />
            </Card>
            <Card title="Décisions actées">
              <div className="ao-card__body" style={{ fontSize: 13, color: 'var(--ao-body)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>· Report du coulage du R+2 au 28.08.2026 suite à la RFI-042.</div>
                <div>· Suspension de la mise en paiement de la situation n° 7 jusqu’à régularisation de la décennale.</div>
                <div>· Passage de l’avenant n° 1 (+42 M) au comité du 05.09.2026.</div>
              </div>
            </Card>
          </div>
          <Right>
            <Card title="Faits marquants">
              <FactList items={[
                { label: 'Décennale expirée', sub: 'suspend le paiement', value: 'bloquant', sev: 'danger' },
                { label: 'Avenant fondations', sub: 'en attente d’arbitrage', value: '+42 M', sev: 'accent' },
                { label: 'Coulage R+2 reporté', sub: 'RFI-042', value: '28.08', sev: 'accent' },
              ]} />
            </Card>
            <Card title="Météo & sécurité">
              <FactList items={[
                { label: 'Intempéries', sub: 'ce mois', value: '2 j' },
                { label: 'Presque-accidents', value: '0' },
                { label: 'Visite HSSE', sub: 'conforme', value: '18.08' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 49 · Réserves & levées ───────────────────────────────────────────────────
function Reserves() {
  return (
    <>
      <DetailTop id="reserves" secondary="OPR" primary="Prononcer la réception" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Réception', value: 'non prononcée', sub: 'OPR à planifier', accent: true },
          { label: 'Réserves', value: '—', sub: 'avant OPR' },
          { label: 'GPA', value: '12 mois', sub: 'après réception' },
          { label: 'DOE', value: '0 / 9', sub: 'lots remis' },
          { label: 'Quitus décennale', value: 'bloqué', sub: 'conformité', accent: true },
        ]} />
        <div className="ao-split">
          <Card title="Préparation & réserves types" meta="process GPA">
            <Table
              cols={[{ label: 'Élément', grow: 2 }, { label: 'Lot' }, { label: 'Cible', num: true }, { label: 'Statut' }]}
              rows={[
                [c.t('Opérations préalables (OPR)', 'visite contradictoire'), c.s('Lot 02'), c.n('T4 2027'), c.b('à planifier', 'neutral')],
                [c.t('Réserves gros œuvre', 'anticipées'), c.s('Lot 02'), c.n('—'), c.b('à venir', 'neutral')],
                [c.t('Remise des DOE', 'dossier exécuté'), c.s('MOE'), c.n('T4 2027'), c.b('en préparation', 'accent')],
                [c.t('Quitus décennale', 'attestations'), c.s('Entreprises'), c.n('—'), c.b('bloqué', 'danger')],
              ]}
            />
          </Card>
          <Right>
            <Card title="Conditions de réception">
              <FactList items={[
                { label: 'Décennale EGCI', sub: 'bloque le quitus', value: 'expirée', sev: 'danger' },
                { label: 'Levée des réserves', sub: 'process GPA', value: 'à venir' },
                { label: 'Raccordement CIE', sub: 'condition d’exploitation', value: 'M18', sev: 'accent' },
              ]} />
            </Card>
            <Card title="GPA">
              <FactList items={[
                { label: 'Durée', sub: 'à compter de la réception', value: '12 mois' },
                { label: 'Retenue libérée', sub: 'à la levée', value: '132 M' },
                { label: 'Suivi', sub: 'registre des levées', value: 'M19' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── 50 · Journal d'audit ─────────────────────────────────────────────────────
function Journal() {
  return (
    <>
      <DetailTop id="journal" secondary="Filtres avancés" primary="Exporter la sélection" />
      <div className="ao-content">
        <Kpis items={[
          { label: 'Écritures', value: '2 418', sub: 'depuis le 31.03.2025' },
          { label: 'Aujourd’hui', value: '46' },
          { label: 'Auteurs distincts', value: '9' },
          { label: 'Approbations tracées', value: '218' },
          { label: 'Export', value: 'CSV signé', sub: 'horodaté' },
        ]} />
        <div className="ao-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Écritures récentes" meta="horodatage · auteur · objet · avant / après">
              <Table
                cols={[{ label: 'Horodatage', grow: 1 }, { label: 'Auteur', grow: 1 }, { label: 'Objet', grow: 2.4 }, { label: 'Module' }]}
                rows={[
                  [c.t('19.08 · 14 h 02'), c.s('système'), c.t('Alerte écart physique / financier', 'lot 02 · 6 points'), c.s('M14')],
                  [c.t('19.08 · 11 h 40'), c.s('système'), c.t('Blocage de paiement', 'attestation décennale expirée'), c.s('M7')],
                  [c.t('18.08 · 17 h 21'), c.s('M. Bamba'), c.t('Dépôt de la situation n° 7', '184 M'), c.s('M16')],
                  [c.t('18.08 · 09 h 55'), c.s('A. Kouadio'), c.t('Visa A — plan STR-EXE-118 ind. B'), c.s('M11')],
                  [c.t('11.08 · 16 h 08'), c.s('S. Renard'), c.t('Soumission de l’avenant n° 1', '1 240 M → 1 282 M'), c.s('M15')],
                  [c.t('30.06 · 18 h 00'), c.s('K. Traoré'), c.t('Arrêté de bilan semestriel', 'coût figé 4 808 M'), c.s('M4')],
                ]}
              />
            </Card>
            <Card title="Garanties" meta="conformité">
              <Table
                cols={[{ label: 'Propriété', grow: 1 }, { label: 'Mise en œuvre', grow: 2 }]}
                rows={[
                  [c.t('Append-only'), c.s('aucune écriture ne peut être supprimée ni modifiée')],
                  [c.t('Horodatage'), c.s('serveur, fuseau UTC+0, précision seconde')],
                  [c.t('Portée'), c.s('création, modification, approbation, export, accès')],
                ]}
              />
            </Card>
          </div>
          <Right>
            <Card title="Filtres actifs">
              <FactList items={[
                { label: 'Période', value: '30 derniers jours' },
                { label: 'Module', value: 'tous' },
                { label: 'Auteur', value: 'tous' },
                { label: 'Type', value: 'approbations et montants' },
              ]} />
            </Card>
            <Card title="Activité par module" meta="30 jours">
              <FactList items={[
                { label: 'M16 — Paiements', value: '412' },
                { label: 'M11 — Conception & GED', value: '286' },
                { label: 'M14 — Pilotage', value: '204' },
                { label: 'M4 — Bilan', value: '188' },
                { label: 'M7 — Parties prenantes', value: '96' },
              ]} />
            </Card>
          </Right>
        </div>
      </div>
    </>
  );
}

// ── Répartiteur ──────────────────────────────────────────────────────────────
const registry: Partial<Record<ScreenId, () => JSX.Element>> = {
  'create-wizard': CreateWizard,
  'poste-bilan': PosteBilan,
  'plan-tresorerie': PlanTresorerie,
  'arretes': Arretes,
  'intervenant': Intervenant,
  'assurances': Assurances,
  'risques-raci': RisquesRaci,
  'simulateur': Simulateur,
  'jalons': Jalons,
  'marche': Marche,
  'situation': Situation,
  'offre': Offre,
  'rfi': Rfi,
  'visa': Visa,
  'cr-chantier': CrChantier,
  'reserves': Reserves,
  'journal': Journal,
};

export function isDetail(id: ScreenId): boolean {
  return id in registry;
}

export function DetailScreen({ id }: { id: ScreenId }) {
  const Cmp = registry[id];
  if (!Cmp) return null;
  return <Cmp />;
}
