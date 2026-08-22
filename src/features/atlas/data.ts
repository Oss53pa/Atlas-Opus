/**
 * Jeu de données de démonstration — opération « Résidence Bellevue ».
 * Toutes les maquettes partagent cette opération et la même chaîne de faits
 * (réf handoff § « Cohérence narrative »). Les chiffres de référence sont conservés.
 */
import type { ScreenId } from './nav';

// ─────────────────────────────────────────────────────────────────────────────
// Session / contexte
// ─────────────────────────────────────────────────────────────────────────────
export const session = {
  user: { name: 'K. Traoré', firstName: 'Kouassi', initials: 'KT', role: 'moa_director' },
  tenant: { name: 'Atlas Immobilier CI', kind: 'espace de travail', operations: 6 },
};

export const operation = {
  id: 'bellevue',
  name: 'Résidence Bellevue',
  place: 'Cocody, Abidjan',
  phase: 'réalisation',
  progress: 58,
  program: 'v3',
  lots: 84,
  // Chiffres de référence (millions FCFA sauf indication)
  bac: 4850, // budget à terminaison / coût prévu
  engage: 3484,
  realise: 2653,
  recettes: 5462,
  recettesRealisees: 2076,
  marge: 612,
  tauxMarge: 12.6,
  tri: 14.2,
  tresoLow: -418, // point bas novembre 2026
  retentionRate: 5,
  exigences: 34,
  exigencesNonCouvertes: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Portefeuille (écran Accueil)
// ─────────────────────────────────────────────────────────────────────────────
export interface PortfolioRow {
  name: string; place: string; phase: string; bacMd: string; progress: number; alerts: number; current?: boolean;
}
export const portfolio: PortfolioRow[] = [
  { name: 'Résidence Bellevue', place: 'Abidjan · résidentiel · 84 lots', phase: 'réalisation', bacMd: '4,85 Md', progress: 58, alerts: 5, current: true },
  { name: 'Centre d’affaires Plateau', place: 'Abidjan · tertiaire · 14 200 m²', phase: 'passation', bacMd: '7,20 Md', progress: 17, alerts: 3 },
  { name: 'Lotissement Yamoussoukro', place: 'Yamoussoukro · mixte · 12 ha', phase: 'conception', bacMd: '2,64 Md', progress: 9, alerts: 2 },
  { name: 'Marché couvert Bouaké', place: 'Bouaké · public · marchés réglementés', phase: 'réception', bacMd: '1,45 Md', progress: 95, alerts: 1 },
  { name: 'Entrepôt Vridi', place: 'Abidjan · logistique · 6 800 m²', phase: 'amont', bacMd: '1,10 Md', progress: 0, alerts: 0 },
  { name: 'Clinique Cocody', place: 'Abidjan · santé · en GPA', phase: 'exploitation', bacMd: '1,16 Md', progress: 100, alerts: 0 },
];

export const portfolioSummary = [
  { label: 'Budget cumulé', value: '18,4 Md' },
  { label: 'Engagé', value: '11,7 Md · 63 %' },
  { label: 'Marge prévue', value: '+1,92 Md' },
  { label: 'Trésorerie, point bas', value: '−418 M', accent: true },
];

/** Trois décisions en tête d'accueil. */
export interface Decision { title: string; codes: string; value: string; valueSub?: string; place: string; primary: string; secondary: string; }
export const decisions: Decision[] = [
  { title: 'Situation à valider', codes: 'M13', value: '184,0 M', valueSub: 'FCFA', place: 'Bellevue · gros œuvre lot 02 · visa MOE obtenu', primary: 'Valider', secondary: 'Renvoyer' },
  { title: 'Avenant à arbitrer', codes: 'M14', value: '+20,0 M', valueSub: '+12 j', place: 'Bellevue · reprise de fondations · seuil moa_director', primary: 'Arbitrer', secondary: 'Voir l’impact' },
  { title: 'Attribution à décider', codes: 'M8 · M23', value: '4 offres', place: 'Plateau · lot 03 · rapport d’analyse scellé', primary: 'Ouvrir le rapport', secondary: '' },
];

/** Gardes bloquantes (portefeuille). */
export const blockingGates = [
  { title: 'Permis de construire non accordé', sub: 'Yamoussoukro — bloque le passage en réalisation', ref: 'M2 · RG-M2-07' },
  { title: 'Police dommages-ouvrage absente', sub: 'Yamoussoukro — bloque l’ouverture de chantier', ref: 'M7 · RG-M7-04' },
];

// ─────────────────────────────────────────────────────────────────────────────
// M4 — Bilan (postes)
// ─────────────────────────────────────────────────────────────────────────────
export interface BilanPoste { poste: string; prevu: number; engage: number | null; realise: number | null; ecart: number | null; }
export const bilanPostes: BilanPoste[] = [
  { poste: 'Foncier', prevu: 920, engage: 920, realise: 920, ecart: 0 },
  { poste: 'Études & honoraires', prevu: 388, engage: 371, realise: 268, ecart: -17 },
  { poste: 'Travaux', prevu: 2940, engage: 1862, realise: 1204, ecart: 42 },
  { poste: 'Frais financiers', prevu: 212, engage: 148, realise: 96, ecart: 0 },
  { poste: 'Assurances & taxes', prevu: 186, engage: 121, realise: 121, ecart: 0 },
  { poste: 'Commercialisation', prevu: 124, engage: 62, realise: 44, ecart: 0 },
  { poste: 'Aléas', prevu: 80, engage: null, realise: null, ecart: 0 },
];
export const bilanTotal = { prevu: 4850, engage: 3484, realise: 2653, ecart: 25 };

export const bilanAlerts = [
  { sev: 'accent' as const, title: 'Poste travaux : +42 M au-delà du prévu', sub: 'RG-M4-07' },
  { sev: 'accent' as const, title: 'Avenants en attente : +20 M non intégrés', sub: 'M14 · à arbitrer' },
  { sev: 'neutral' as const, title: 'Dernier arrêté : 31 juillet 2026', sub: 'snapshot scellé' },
];

// ─────────────────────────────────────────────────────────────────────────────
// M1 — Programme + transition de phase + versions
// ─────────────────────────────────────────────────────────────────────────────
export interface ProgramLine { label: string; sub?: string; cat: string; cible: string; unit: string; status: 'validé' | 'non couvert'; }
export const programLines: ProgramLine[] = [
  { label: 'Logements T3', sub: '66 unités', cat: 'surface', cible: '4 620', unit: 'm²', status: 'validé' },
  { label: 'Logements T4', sub: '30 unités', cat: 'surface', cible: '3 150', unit: 'm²', status: 'validé' },
  { label: 'Commerces en pied d’immeuble', cat: 'usage', cible: '820', unit: 'm²', status: 'validé' },
  { label: 'Stationnement', cat: 'exigence fonct.', cible: '112', unit: 'places', status: 'validé' },
  { label: 'Groupe électrogène de secours', cat: 'exigence tech.', cible: '250', unit: 'kVA', status: 'non couvert' },
  { label: 'Récupération des eaux de pluie', cat: 'exigence env.', cible: '40', unit: 'm³', status: 'non couvert' },
];
export const phaseGates = [
  { title: 'Permis de construire accordé', ref: 'M2 · RG-M2-07', state: 'OK' },
  { title: 'Police dommages-ouvrage valide', ref: 'M7 · RG-M7-04', state: 'OK' },
  { title: 'Réception prononcée', ref: 'M18 · condition d’exploitation', state: 'à venir' },
  { title: 'Bilan définitif validé', ref: 'M4 · RG-M4-10', state: 'clôture' },
];
export const programVersions = [
  { v: 'v3 — ajout du GE de secours', sub: 'validée par K. Traoré', date: '18.01.2026' },
  { v: 'v2 — révision des surfaces T4', sub: 'validée', date: '02.12.2025' },
  { v: 'v1 — programme initial', sub: 'validée', date: '14.09.2025' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Approbations (file unifiée, routage par seuil)
// ─────────────────────────────────────────────────────────────────────────────
export interface Approval { ref: string; title: string; sub: string; amount: string; threshold: string; sev: 'accent' | 'neutral' | 'danger'; }
export const approvals: Approval[] = [
  { ref: 'M13', title: 'Situation n° 7 — gros œuvre lot 02', sub: 'EGCI Bâtiment · visa MOE obtenu', amount: '184,0 M', threshold: 'comité (> 50 M)', sev: 'accent' },
  { ref: 'M14', title: 'Avenant n° 1 — lot 02 fondations spéciales', sub: 'reprise de fondations · +12 j', amount: '+42,0 M', threshold: 'moa_director (10–50 M)', sev: 'accent' },
  { ref: 'M8', title: 'Attribution lot 03 — Plateau', sub: 'rapport d’analyse scellé · 4 offres', amount: '612,0 M', threshold: 'comité (> 50 M)', sev: 'neutral' },
  { ref: 'M16', title: 'Décompte n° 4 — corps d’état secondaires', sub: 'Sotraci · retenue de garantie 5 %', amount: '38,5 M', threshold: 'moa_director (10–50 M)', sev: 'neutral' },
  { ref: 'M5', title: 'Appel de fonds stade 4 — banque', sub: 'VEFA · 25 % à la mise hors d’eau', amount: '9,2 M', threshold: 'AMO (≤ 10 M)', sev: 'neutral' },
  { ref: 'M2', title: 'Mainlevée hypothèque — parcelle B', sub: 'Yamoussoukro · pièce manquante', amount: '—', threshold: 'moa_director', sev: 'danger' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (groupées par sévérité)
// ─────────────────────────────────────────────────────────────────────────────
export interface Notif { sev: 'danger' | 'accent' | 'neutral'; title: string; sub: string; time: string; }
export const notifGroups: { day: string; items: Notif[] }[] = [
  {
    day: 'Aujourd’hui',
    items: [
      { sev: 'danger', title: 'Attestation décennale EGCI Bâtiment expirée', sub: 'Expirée le 31.07.2026 · suspend la mise en paiement de la situation n° 7', time: '09 h 14' },
      { sev: 'accent', title: 'Avenant n° 1 lot 02 en attente d’arbitrage', sub: '+42 M · comité du 05.09 · seuil moa_director', time: '08 h 02' },
      { sev: 'accent', title: 'RFI-042 bloque le visa du plan STR-EXE-118', sub: 'réservation de gaine incompatible avec un voile porteur', time: '07 h 41' },
    ],
  },
  {
    day: 'Hier · 21.08.2026',
    items: [
      { sev: 'neutral', title: 'Décompte n° 4 corps d’état secondaires déposé', sub: 'Sotraci · 38,5 M · visa MOE en attente', time: '17 h 20' },
      { sev: 'neutral', title: 'Nouvelle version programme v3 publiée', sub: 'ajout du groupe électrogène de secours', time: '11 h 05' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Membres & rôles
// ─────────────────────────────────────────────────────────────────────────────
export interface Member { name: string; email: string; role: string; scope: string; status: 'actif' | 'invité'; }
export const members: Member[] = [
  { name: 'Kouassi Traoré', email: 'k.traore@atlas-mo.ci', role: 'moa_director', scope: 'Toutes les opérations', status: 'actif' },
  { name: 'Awa Koné', email: 'a.kone@atlas-mo.ci', role: 'finance', scope: 'Bellevue · Plateau', status: 'actif' },
  { name: 'Yao N’Guessan', email: 'y.nguessan@atlas-mo.ci', role: 'operation_manager', scope: 'Bellevue', status: 'actif' },
  { name: 'Fatou Diallo', email: 'f.diallo@amo-ci.com', role: 'amo', scope: 'Bellevue', status: 'actif' },
  { name: 'Ibrahim Cissé', email: 'i.cisse@atlas-mo.ci', role: 'controle', scope: 'Toutes les opérations', status: 'actif' },
  { name: 'Marie Bamba', email: 'm.bamba@atlas-mo.ci', role: 'viewer', scope: 'Plateau', status: 'invité' },
];
export const roles = [
  { code: 'moa_director', label: 'Directeur d’opération', can: 'Arbitre, valide les seuils > 50 M, arrête le bilan' },
  { code: 'finance', label: 'Finance', can: 'Décomptes, appels de fonds, écritures, fiscalité' },
  { code: 'operation_manager', label: 'Chef de projet', can: 'Pilotage réalisation, planning, modifications' },
  { code: 'amo', label: 'AMO', can: 'Valide sous seuil ≤ 10 M, instruit les dossiers' },
  { code: 'controle', label: 'Contrôle', can: 'Lecture étendue, audit, conformité' },
  { code: 'viewer', label: 'Observateur', can: 'Lecture seule sur périmètre attribué' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Espaces de travail (écran Workspaces)
// ─────────────────────────────────────────────────────────────────────────────
export const workspaces = [
  { initials: 'AI', name: 'Atlas Immobilier CI', sub: '6 opérations actives · Abidjan · XOF', role: 'moa_director', current: true },
  { initials: 'SG', name: 'SGI Développement', sub: '2 opérations actives · Dakar · XOF', role: 'amo' },
  { initials: 'MB', name: 'Ministère — Bouaké', sub: '1 opération publique · marchés réglementés', role: 'viewer' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Menu principal — sous-ligne, palier et signalement par module
// ─────────────────────────────────────────────────────────────────────────────
export const menuMeta: Partial<Record<ScreenId, { sub: string; tier: 'mvp' | 'v1' | 'v2'; accent?: boolean }>> = {
  m1: { sub: 'programme v3 · 34 exigences', tier: 'mvp' },
  m2: { sub: '1 point de due diligence critique', tier: 'mvp', accent: true },
  m3: { sub: 'disponible en V2', tier: 'v2' },
  m4: { sub: 'marge +612 M · TRI 14,2 %', tier: 'mvp' },
  m5: { sub: '2 tranches à demander', tier: 'v1', accent: true },
  m6: { sub: '41 lots vendus sur 84', tier: 'v1' },
  m16: { sub: '3 décomptes à mandater', tier: 'mvp', accent: true },
  m17: { sub: 'une échéance dans 21 jours', tier: 'v1', accent: true },
  m7: { sub: '1 attestation expirée', tier: 'mvp', accent: true },
  m8: { sub: 'régime privé · 9 marchés notifiés', tier: 'v1' },
  m9: { sub: '1 dépouillement en cours', tier: 'v1' },
  m10: { sub: 'ETA ascenseurs −15 jours', tier: 'v1', accent: true },
  m11: { sub: '318 documents · 2 exigences non couvertes', tier: 'v1', accent: true },
  m12: { sub: '2 RFI en retard, escaladées', tier: 'mvp', accent: true },
  m13: { sub: 'dérive +16 j sur tâche critique', tier: 'mvp', accent: true },
  m14: { sub: '4 situations dans la file', tier: 'mvp', accent: true },
  m15: { sub: 'avenants cumulés 8,4 %', tier: 'mvp' },
  m18: { sub: 'disponible en V2', tier: 'v2' },
  m19: { sub: 'disponible en V2', tier: 'v2' },
  m20: { sub: 'disponible en V2', tier: 'v2' },
  m21: { sub: 'disponible en V2', tier: 'v2' },
  m22: { sub: 'reporting hebdo · lundi 8 h', tier: 'v1' },
  m23: { sub: 'local · sans rétention de données', tier: 'v1' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Contenu générique des modules (écran-module piloté par données)
// ─────────────────────────────────────────────────────────────────────────────
export interface Kpi { label: string; value: string; sub?: string; accent?: boolean; }
export interface TableCol { label: string; num?: boolean; grow?: number; }
export interface TableCell { text?: string; sub?: string; num?: string; sec?: string; badge?: { label: string; kind: 'neutral' | 'accent' | 'wash' | 'danger' | 'success' }; phase?: { label: string; current?: boolean }; accentNum?: boolean; mutedNum?: boolean; }
export interface FactItem { label: string; sub?: string; value?: string; sev?: 'accent' | 'danger' | 'neutral'; }
export interface ModuleData {
  context: string; // fil de contexte de la barre supérieure
  primary?: string; // action primaire (une seule)
  secondary?: string;
  kpis: Kpi[];
  table: { title: string; meta?: string; cols: TableCol[]; rows: TableCell[][] };
  facts: { title: string; meta?: string; items: FactItem[] };
  facts2?: { title: string; meta?: string; items: FactItem[] };
}

export const moduleContent: Partial<Record<ScreenId, ModuleData>> = {
  m2: {
    context: 'montage juridique · 1 garde bloquante',
    primary: 'Lever la garde',
    secondary: 'Historique',
    kpis: [
      { label: 'Assiette foncière', value: '2,4 ha', sub: 'parcelles A + B' },
      { label: 'Régime', value: 'TF', sub: 'titre foncier · Cocody' },
      { label: 'Coût foncier', value: '920 M', sub: 'acquitté' },
      { label: 'Autorisations', value: '4 / 5', sub: '1 en instance', accent: true },
      { label: 'Servitudes', value: '2', sub: 'réseau · passage' },
    ],
    table: {
      title: 'Autorisations & pièces',
      meta: 'RG-M2-07',
      cols: [{ label: 'Pièce', grow: 2 }, { label: 'Autorité' }, { label: 'Échéance', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Permis de construire', sub: 'PC-2025-0412' }, { sec: 'Mairie de Cocody' }, { num: '12.09.2025' }, { badge: { label: 'accordé', kind: 'success' } }],
        [{ text: 'Certificat de propriété', sub: 'TF 24 189' }, { sec: 'Conservation foncière' }, { num: '—' }, { badge: { label: 'valide', kind: 'success' } }],
        [{ text: 'Mainlevée hypothèque', sub: 'parcelle B' }, { sec: 'Notaire' }, { num: '30.09.2026' }, { badge: { label: 'en instance', kind: 'accent' } }],
        [{ text: 'Autorisation de voirie', sub: 'raccordement' }, { sec: 'District d’Abidjan' }, { num: '05.10.2026' }, { badge: { label: 'déposé', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Montage & sûretés',
      items: [
        { label: 'Structure', value: 'SCI Bellevue', sub: 'promotion pour compte propre' },
        { label: 'Hypothèque de 1er rang', value: '1,20 Md', sub: 'banque · garantie du crédit' },
        { label: 'Garde bloquante', sub: 'mainlevée parcelle B — pièce manquante', sev: 'danger' },
      ],
    },
  },
  m3: {
    context: 'études amont · indice C',
    primary: 'Déposer une étude',
    secondary: 'Comparer les indices',
    kpis: [
      { label: 'Études', value: '18', sub: '3 en cours' },
      { label: 'Sol', value: 'G2 AVP', sub: 'portance reconnue' },
      { label: 'Aléas identifiés', value: '4', sub: '1 majeur', accent: true },
      { label: 'Budget études', value: '388 M', sub: 'engagé 371 M' },
      { label: 'Indice courant', value: 'C', sub: 'déposé le 14.08.2026' },
    ],
    table: {
      title: 'Études & diagnostics',
      cols: [{ label: 'Étude', grow: 2 }, { label: 'Prestataire' }, { label: 'Indice', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Étude géotechnique', sub: 'G2 AVP' }, { sec: 'Geotec CI' }, { num: 'C' }, { badge: { label: 'validée', kind: 'success' } }],
        [{ text: 'Étude d’impact environnemental', sub: 'ANDE' }, { sec: 'Envi Conseil' }, { num: 'B' }, { badge: { label: 'validée', kind: 'success' } }],
        [{ text: 'Diagnostic hydrogéologique', sub: 'nappe à −4 m' }, { sec: 'Geotec CI' }, { num: 'A' }, { badge: { label: 'en cours', kind: 'accent' } }],
        [{ text: 'Relevé topographique', sub: 'assiette complète' }, { sec: 'Cabinet Assi' }, { num: 'C' }, { badge: { label: 'validée', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Aléas amont',
      items: [
        { label: 'Fondations spéciales requises', value: '+42 M', sub: 'nappe haute — pieux', sev: 'accent' },
        { label: 'Reprise en sous-œuvre voisin', sub: 'sous surveillance', sev: 'neutral' },
        { label: 'Sujétions ANDE', value: 'levées', sub: 'récupération eaux de pluie', sev: 'neutral' },
      ],
    },
  },
  m5: {
    context: 'financement · plan de déblocage VEFA',
    primary: 'Émettre un appel de fonds',
    secondary: 'Plan de trésorerie',
    kpis: [
      { label: 'Crédit promoteur', value: '1,20 Md', sub: 'tiré 0,74 Md' },
      { label: 'Fonds propres', value: '1,45 Md', sub: 'apportés' },
      { label: 'Préventes', value: '5,46 Md', sub: '38 % encaissés' },
      { label: 'Intérêts intercalaires', value: '96 M', sub: 'cumulés', accent: true },
      { label: 'Prochain stade', value: 'S4', sub: 'mise hors d’eau · 25 %' },
    ],
    table: {
      title: 'Appels de fonds VEFA',
      meta: 'appel = prix × % réglementaire',
      cols: [{ label: 'Stade', grow: 2 }, { label: '% cumulé', num: true }, { label: 'Montant', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Fondations', sub: 'stade 1' }, { num: '15 %' }, { num: '819 M' }, { badge: { label: 'encaissé', kind: 'success' } }],
        [{ text: 'Plancher haut RDC', sub: 'stade 2' }, { num: '35 %' }, { num: '1 092 M' }, { badge: { label: 'encaissé', kind: 'success' } }],
        [{ text: 'Mise hors d’eau', sub: 'stade 3' }, { num: '70 %' }, { num: '1 911 M' }, { badge: { label: 'en cours', kind: 'accent' } }],
        [{ text: 'Achèvement', sub: 'stade 4' }, { num: '95 %' }, { num: '1 365 M' }, { badge: { label: 'à venir', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Déblocages & intérêts',
      items: [
        { label: 'Capital décaissé', value: '740 M', sub: 'taux 8,5 % · base 360 j' },
        { label: 'Intérêts du mois', value: '5,2 M', sub: 'intercalaires' },
        { label: 'Covenant LTC', value: '62 %', sub: 'plafond 75 %', sev: 'neutral' },
      ],
    },
  },
  m6: {
    context: 'commercialisation · 84 lots',
    primary: 'Enregistrer une réservation',
    secondary: 'Grille de prix',
    kpis: [
      { label: 'Lots', value: '84', sub: '96 lots au programme' },
      { label: 'Réservés', value: '52', sub: '62 % du stock' },
      { label: 'Actés', value: '31', sub: 'VEFA signées' },
      { label: 'Recettes', value: '5,46 Md', sub: 'réalisées 2,08 Md' },
      { label: 'Prix moyen', value: '64,8 M', sub: 'par lot', accent: false },
    ],
    table: {
      title: 'Stock commercial',
      cols: [{ label: 'Typologie', grow: 2 }, { label: 'Stock', num: true }, { label: 'Réservés', num: true }, { label: 'Prix moyen', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'T3', sub: '66 lots' }, { num: '66' }, { num: '44' }, { num: '58,0 M' }, { badge: { label: 'actif', kind: 'accent' } }],
        [{ text: 'T4', sub: '30 lots' }, { num: '30' }, { num: '8' }, { num: '82,0 M' }, { badge: { label: 'actif', kind: 'accent' } }],
        [{ text: 'Commerces', sub: 'pied d’immeuble' }, { num: '6' }, { num: '0' }, { num: '—' }, { badge: { label: 'lancement', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Recettes & encaissement',
      items: [
        { label: 'Encaissé', value: '2,08 Md', sub: '38 % des ventes actées' },
        { label: 'Reste à encaisser', value: '3,38 Md', sub: 'appels VEFA en cours' },
        { label: 'Délai moyen d’acte', value: '48 j', sub: 'réservation → notaire' },
      ],
    },
  },
  m7: {
    context: 'parties prenantes · 1 conformité expirée',
    primary: 'Ajouter un intervenant',
    secondary: 'Tableau des assurances',
    kpis: [
      { label: 'Intervenants', value: '23', sub: '9 contrats actifs' },
      { label: 'Contrats', value: '9', sub: '3,42 Md engagés' },
      { label: 'Conformités', value: '8 / 9', sub: '1 expirée', accent: true },
      { label: 'Retenue de garantie', value: '5 %', sub: 'contractuelle' },
      { label: 'Litiges', value: '0', sub: 'aucun en cours' },
    ],
    table: {
      title: 'Intervenants & contrats',
      meta: 'RG-M7-04',
      cols: [{ label: 'Intervenant', grow: 2 }, { label: 'Rôle' }, { label: 'Marché', num: true }, { label: 'Conformité' }],
      rows: [
        [{ text: 'EGCI Bâtiment', sub: 'gros œuvre lot 02' }, { sec: 'Entreprise' }, { num: '1 862 M' }, { badge: { label: 'décennale expirée', kind: 'danger' } }],
        [{ text: 'Sotraci', sub: 'corps d’état secondaires' }, { sec: 'Entreprise' }, { num: '640 M' }, { badge: { label: 'à jour', kind: 'success' } }],
        [{ text: 'Atelier K2M', sub: 'maîtrise d’œuvre' }, { sec: 'MOE' }, { num: '388 M' }, { badge: { label: 'à jour', kind: 'success' } }],
        [{ text: 'Bureau Veritas', sub: 'contrôle technique' }, { sec: 'CT' }, { num: '96 M' }, { badge: { label: 'à jour', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Assurances',
      meta: 'F6',
      items: [
        { label: 'Décennale EGCI Bâtiment', value: 'expirée', sub: 'depuis le 31.07.2026 — bloquant', sev: 'danger' },
        { label: 'Dommages-ouvrage', value: 'valide', sub: 'échéance 30.06.2027', sev: 'neutral' },
        { label: 'Tous risques chantier', value: 'valide', sub: 'échéance 31.12.2026', sev: 'neutral' },
      ],
    },
  },
  m8: {
    context: '7 marchés · routage par seuil',
    primary: 'Lancer une consultation',
    secondary: 'Registre des marchés',
    kpis: [
      { label: 'Marchés', value: '7', sub: '2 en passation' },
      { label: 'Montant attribué', value: '3,42 Md', sub: 'sur 9 lots' },
      { label: 'Offres reçues', value: '4', sub: 'lot 03 · scellées', accent: true },
      { label: 'Régime', value: 'privé', sub: 'gré à gré encadré' },
      { label: 'Délai moyen', value: '38 j', sub: 'consultation → attribution' },
    ],
    table: {
      title: 'Marchés & consultations',
      cols: [{ label: 'Lot', grow: 2 }, { label: 'Attributaire' }, { label: 'Montant', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Lot 02 — gros œuvre', sub: 'MA-2025-02' }, { sec: 'EGCI Bâtiment' }, { num: '1 862 M' }, { badge: { label: 'notifié', kind: 'success' } }],
        [{ text: 'Lot 03 — CVC / plomberie', sub: 'MA-2026-03' }, { sec: '4 offres' }, { num: '612 M' }, { badge: { label: 'analyse', kind: 'accent' } }],
        [{ text: 'Lot 04 — électricité', sub: 'MA-2026-04' }, { sec: 'consultation' }, { num: '—' }, { badge: { label: 'ouvert', kind: 'neutral' } }],
        [{ text: 'Lot 01 — VRD', sub: 'MA-2025-01' }, { sec: 'Sotraci' }, { num: '312 M' }, { badge: { label: 'notifié', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Passation en cours',
      items: [
        { label: 'Lot 03 — 4 offres scellées', value: '612 M', sub: 'ouverture le 24.08 · comité', sev: 'accent' },
        { label: 'Seuil applicable', value: '> 50 M', sub: 'décision comité' },
        { label: 'Lot 04 — consultation', sub: 'clôture le 02.09.2026', sev: 'neutral' },
      ],
    },
  },
  m9: {
    context: 'analyse des offres · lot 03',
    primary: 'Ouvrir le rapport',
    secondary: 'Grille de notation',
    kpis: [
      { label: 'Offres', value: '4', sub: 'lot 03 · CVC' },
      { label: 'Estimation', value: '640 M', sub: 'MOE' },
      { label: 'Mieux-disant', value: '612 M', sub: '−4,4 % / estim.', accent: true },
      { label: 'Écart type', value: '9 %', sub: 'prix' },
      { label: 'Rapport', value: 'scellé', sub: 'ouverture 24.08' },
    ],
    table: {
      title: 'Offres reçues',
      cols: [{ label: 'Soumissionnaire', grow: 2 }, { label: 'Prix', num: true }, { label: 'Technique', num: true }, { label: 'Note', num: true }, { label: 'Rang' }],
      rows: [
        [{ text: 'Clima CI', sub: 'délai 8 mois' }, { num: '612 M' }, { num: '82 / 100' }, { num: '88,4' }, { badge: { label: '1er', kind: 'accent' } }],
        [{ text: 'Froid Services', sub: 'délai 9 mois' }, { num: '628 M' }, { num: '79 / 100' }, { num: '85,1' }, { badge: { label: '2e', kind: 'neutral' } }],
        [{ text: 'Techni-Air', sub: 'délai 8 mois' }, { num: '655 M' }, { num: '80 / 100' }, { num: '83,0' }, { badge: { label: '3e', kind: 'neutral' } }],
        [{ text: 'Bâti-Clim', sub: 'délai 10 mois' }, { num: '689 M' }, { num: '71 / 100' }, { num: '74,2' }, { badge: { label: '4e', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Recevabilité',
      items: [
        { label: 'Offres conformes', value: '4 / 4', sub: 'candidatures recevables' },
        { label: 'Pondération', value: '60 / 40', sub: 'technique / prix' },
        { label: 'Proposition', value: 'Clima CI', sub: 'sous réserve comité', sev: 'accent' },
      ],
    },
  },
  m10: {
    context: 'achats & logistique · appro chantier',
    primary: 'Créer une commande',
    secondary: 'Plan d’appro',
    kpis: [
      { label: 'Commandes', value: '46', sub: '5 en cours' },
      { label: 'Engagé achats', value: '1,24 Md', sub: 'hors marchés' },
      { label: 'En retard', value: '2', sub: 'livraisons', accent: true },
      { label: 'Stock chantier', value: '18 réf.', sub: 'suivies' },
      { label: 'Délai moyen', value: '21 j', sub: 'commande → livraison' },
    ],
    table: {
      title: 'Commandes & livraisons',
      cols: [{ label: 'Article', grow: 2 }, { label: 'Fournisseur' }, { label: 'Montant', num: true }, { label: 'Livraison' }],
      rows: [
        [{ text: 'Acier HA — tranche 3', sub: 'BC-2026-118' }, { sec: 'Sib Métal' }, { num: '84 M' }, { badge: { label: 'en retard', kind: 'accent' } }],
        [{ text: 'Béton prêt à l’emploi', sub: 'planning R+2' }, { sec: 'CIM Ivoire' }, { num: '62 M' }, { badge: { label: 'planifié', kind: 'neutral' } }],
        [{ text: 'Menuiseries aluminium', sub: 'BC-2026-102' }, { sec: 'Alu Concept' }, { num: '148 M' }, { badge: { label: 'livré', kind: 'success' } }],
        [{ text: 'Groupe électrogène 250 kVA', sub: 'exigence programme' }, { sec: 'Energ CI' }, { num: '46 M' }, { badge: { label: 'à commander', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Logistique chantier',
      items: [
        { label: 'Aciers en retard', value: '+6 j', sub: 'impacte le ferraillage R+2', sev: 'accent' },
        { label: 'Aire de stockage', value: '82 %', sub: 'saturation' },
        { label: 'Rotations grue', value: '14 / j', sub: 'moyenne semaine' },
      ],
    },
  },
  m11: {
    context: 'conception & GED · indice C',
    primary: 'Déposer un document',
    secondary: 'Circuit de visa',
    kpis: [
      { label: 'Documents', value: '412', sub: '38 en visa' },
      { label: 'Indice courant', value: 'C', sub: 'lot structure' },
      { label: 'Visas en attente', value: '6', sub: '1 bloqué', accent: true },
      { label: 'Plans EXE', value: '128', sub: 'diffusés' },
      { label: 'Volume GED', value: '4,6 Go', sub: 'archivé' },
    ],
    table: {
      title: 'Documents & visas',
      cols: [{ label: 'Document', grow: 2 }, { label: 'Émetteur' }, { label: 'Indice', num: true }, { label: 'Visa' }],
      rows: [
        [{ text: 'Plan STR-EXE-118', sub: 'voile porteur R+2' }, { sec: 'Atelier K2M' }, { num: 'C' }, { badge: { label: 'visa A bloqué', kind: 'danger' } }],
        [{ text: 'Plan ARC-EXE-054', sub: 'façade sud' }, { sec: 'Atelier K2M' }, { num: 'B' }, { badge: { label: 'visa A', kind: 'success' } }],
        [{ text: 'CVC-EXE-031', sub: 'réseaux techniques' }, { sec: 'Clima CI' }, { num: 'A' }, { badge: { label: 'en visa', kind: 'accent' } }],
        [{ text: 'Note de calcul NC-07', sub: 'descente de charges' }, { sec: 'BET Sol' }, { num: 'C' }, { badge: { label: 'visa B', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Circuit de visa',
      items: [
        { label: 'STR-EXE-118 bloqué', sub: 'RFI-042 · gaine / voile porteur', sev: 'danger' },
        { label: 'Délai de visa moyen', value: '4,2 j', sub: 'objectif 5 j' },
        { label: 'Diffusion contrôlée', value: 'active', sub: 'indice suivi', sev: 'neutral' },
      ],
    },
  },
  m12: {
    context: 'RFI & collaboration · 1 bloquante',
    primary: 'Ouvrir une RFI',
    secondary: 'Registre RFI',
    kpis: [
      { label: 'RFI ouvertes', value: '11', sub: '1 bloquante', accent: true },
      { label: 'Délai moyen', value: '3,8 j', sub: 'réponse' },
      { label: 'En retard', value: '2', sub: '> 5 j' },
      { label: 'Intervenants', value: '6', sub: 'externes' },
      { label: 'Ce mois', value: '9', sub: 'ouvertes' },
    ],
    table: {
      title: 'Demandes d’information (RFI)',
      cols: [{ label: 'RFI', grow: 2 }, { label: 'Émetteur' }, { label: 'Ouverte', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'RFI-042', sub: 'réservation de gaine / voile' }, { sec: 'EGCI Bâtiment' }, { num: '12.08' }, { badge: { label: 'bloquante', kind: 'danger' } }],
        [{ text: 'RFI-041', sub: 'calepinage carrelage RDC' }, { sec: 'Sotraci' }, { num: '10.08' }, { badge: { label: 'répondue', kind: 'success' } }],
        [{ text: 'RFI-040', sub: 'niveau seuil PMR' }, { sec: 'Atelier K2M' }, { num: '08.08' }, { badge: { label: 'répondue', kind: 'success' } }],
        [{ text: 'RFI-039', sub: 'attente réseau ENEO' }, { sec: 'Clima CI' }, { num: '05.08' }, { badge: { label: 'en retard', kind: 'accent' } }],
      ],
    },
    facts: {
      title: 'Impact RFI-042',
      items: [
        { label: 'Bloque le visa STR-EXE-118', sub: 'indice C', sev: 'danger' },
        { label: 'Reporte le coulage R+2', value: '28.08', sub: '+2 j chemin critique', sev: 'accent' },
        { label: 'Décision', value: 'actée', sub: 'réunion de chantier du 19.08', sev: 'neutral' },
      ],
    },
  },
  m13: {
    context: 'planning · chemin critique +16 j',
    primary: 'Publier une baseline',
    secondary: 'Diagramme de jalons',
    kpis: [
      { label: 'Avancement', value: '58 %', sub: 'physique' },
      { label: 'Chemin critique', value: '+16 j', sub: 'dérive gros œuvre', accent: true },
      { label: 'Jalons tenus', value: '9 / 12', sub: 'baseline v2' },
      { label: 'Tâches', value: '214', sub: '38 en cours' },
      { label: 'Livraison', value: 'T4 2027', sub: 'contractuelle · tenue' },
    ],
    table: {
      title: 'Jalons & baseline',
      meta: 'RG-M13-06',
      cols: [{ label: 'Jalon', grow: 2 }, { label: 'Baseline', num: true }, { label: 'Projeté', num: true }, { label: 'Écart', num: true }],
      rows: [
        [{ text: 'Achèvement gros œuvre', sub: 'R+5' }, { num: '30.11.2026' }, { num: '16.12.2026' }, { num: '+16 j', accentNum: true }],
        [{ text: 'Mise hors d’eau', sub: 'stade VEFA 3' }, { num: '28.02.2027' }, { num: '10.03.2027' }, { num: '+10 j', accentNum: true }],
        [{ text: 'Mise hors d’air', sub: 'menuiseries' }, { num: '30.04.2027' }, { num: '30.04.2027' }, { num: '—', mutedNum: true }],
        [{ text: 'Livraison', sub: 'contractuelle' }, { num: '15.11.2027' }, { num: '15.11.2027' }, { num: '—', mutedNum: true }],
      ],
    },
    facts: {
      title: 'Dérive du chemin critique',
      items: [
        { label: 'RFI-042 → coulage R+2', value: '+2 j', sub: 'reporté au 28.08', sev: 'accent' },
        { label: 'Aciers en retard', value: '+6 j', sub: 'ferraillage R+2', sev: 'accent' },
        { label: 'Marge sur livraison', value: '46 j', sub: 'absorbe la dérive', sev: 'neutral' },
      ],
    },
  },
  m14: {
    context: 'pilotage réalisation · CR du 19.08',
    primary: 'Rédiger un compte rendu',
    secondary: 'Actions en retard',
    kpis: [
      { label: 'Avancement', value: '58 %', sub: 'physique' },
      { label: 'Actions ouvertes', value: '17', sub: '3 en retard', accent: true },
      { label: 'Effectif chantier', value: '82', sub: 'compagnons' },
      { label: 'Comptes rendus', value: '31', sub: 'hebdomadaires' },
      { label: 'Météo', value: '2 j', sub: 'intempéries / mois' },
    ],
    table: {
      title: 'Actions de chantier',
      meta: 'CR n° 31 · 19.08.2026',
      cols: [{ label: 'Action', grow: 2 }, { label: 'Pilote' }, { label: 'Échéance', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: '24.1 — régulariser la décennale', sub: 'EGCI Bâtiment' }, { sec: 'Finance' }, { num: '22.08' }, { badge: { label: 'en retard', kind: 'danger' } }],
        [{ text: '24.2 — arbitrer avenant lot 02', sub: 'reprise fondations' }, { sec: 'MOA' }, { num: '05.09' }, { badge: { label: 'à traiter', kind: 'accent' } }],
        [{ text: '24.3 — replanifier coulage R+2', sub: 'RFI-042' }, { sec: 'MOE' }, { num: '28.08' }, { badge: { label: 'en cours', kind: 'neutral' } }],
        [{ text: '23.7 — réception ferraillage', sub: 'lot 02' }, { sec: 'Contrôle' }, { num: '20.08' }, { badge: { label: 'soldée', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Faits marquants',
      items: [
        { label: 'Décennale expirée', sub: 'suspend le paiement de la situation n° 7', sev: 'danger' },
        { label: 'Avenant fondations', value: '+42 M', sub: 'en attente d’arbitrage', sev: 'accent' },
        { label: 'Coulage R+2 reporté', value: '28.08', sub: 'RFI-042', sev: 'accent' },
      ],
    },
  },
  m15: {
    context: 'maîtrise des modifications · 1 avenant',
    primary: 'Simuler l’impact',
    secondary: 'Registre des avenants',
    kpis: [
      { label: 'Modifications', value: '6', sub: '1 en arbitrage', accent: true },
      { label: 'Impact coût', value: '+42 M', sub: 'avenant n° 1' },
      { label: 'Impact délai', value: '+12 j', sub: 'reprise fondations' },
      { label: 'Impact marge', value: '−0,9 pt', sub: 'projeté' },
      { label: 'Seuil', value: 'moa_director', sub: '10–50 M' },
    ],
    table: {
      title: 'Avenants & ordres de service',
      meta: 'RG-M14-03',
      cols: [{ label: 'Modification', grow: 2 }, { label: 'Lot' }, { label: 'Coût', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Avenant n° 1 — fondations spéciales', sub: 'nappe haute · pieux' }, { sec: 'Lot 02' }, { num: '+42 M', accentNum: true }, { badge: { label: 'à arbitrer', kind: 'accent' } }],
        [{ text: 'OS n° 4 — reprise voile R+2', sub: 'RFI-042' }, { sec: 'Lot 02' }, { num: '+3 M' }, { badge: { label: 'émis', kind: 'neutral' } }],
        [{ text: 'Avenant n° 0 — mise au point', sub: 'marché initial' }, { sec: 'Lot 02' }, { num: '—' }, { badge: { label: 'soldé', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Simulateur — avenant n° 1',
      meta: 'non engageant',
      items: [
        { label: 'Coût à terminaison', value: '4,89 Md', sub: 'BAC + 42 M', sev: 'accent' },
        { label: 'Point bas trésorerie', value: '−418 M', sub: 'de −384 M', sev: 'accent' },
        { label: 'TRI projeté', value: '13,9 %', sub: 'de 14,2 %', sev: 'neutral' },
      ],
    },
  },
  m16: {
    context: 'chaîne de paiement · 1 suspension',
    primary: 'Mettre en paiement',
    secondary: 'Registre des décomptes',
    kpis: [
      { label: 'Décomptes', value: '7', sub: '1 suspendu', accent: true },
      { label: 'Payé cumulé', value: '2,65 Md', sub: 'réalisé' },
      { label: 'En attente', value: '222 M', sub: '2 décomptes' },
      { label: 'Retenue de garantie', value: '132 M', sub: 'cumulée · 5 %' },
      { label: 'Délai de paiement', value: '28 j', sub: 'moyen' },
    ],
    table: {
      title: 'Décomptes & situations',
      meta: 'net = base + TVA − retenues',
      cols: [{ label: 'Décompte', grow: 2 }, { label: 'Entreprise' }, { label: 'Net à payer', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Situation n° 7', sub: 'gros œuvre lot 02' }, { sec: 'EGCI Bâtiment' }, { num: '184,0 M' }, { badge: { label: 'suspendu', kind: 'danger' } }],
        [{ text: 'Décompte n° 4', sub: 'corps d’état secondaires' }, { sec: 'Sotraci' }, { num: '38,5 M' }, { badge: { label: 'à valider', kind: 'accent' } }],
        [{ text: 'Situation n° 6', sub: 'gros œuvre lot 02' }, { sec: 'EGCI Bâtiment' }, { num: '171,2 M' }, { badge: { label: 'payé', kind: 'success' } }],
        [{ text: 'Décompte n° 3', sub: 'VRD' }, { sec: 'Sotraci' }, { num: '96,4 M' }, { badge: { label: 'payé', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Situation n° 7 — contrôle',
      items: [
        { label: 'Contrôle bloquant', sub: 'décennale EGCI expirée le 31.07.2026', sev: 'danger' },
        { label: 'Retenue de garantie', value: '9,2 M', sub: '5 % du brut' },
        { label: 'Retenue à la source', value: '—', sub: 'précompte non applicable' },
      ],
    },
  },
  m17: {
    context: 'cautions & garanties · échéances',
    primary: 'Enregistrer une caution',
    secondary: 'Échéancier',
    kpis: [
      { label: 'Cautions actives', value: '6', sub: '1 à renouveler', accent: true },
      { label: 'Encours garanti', value: '486 M', sub: 'toutes cautions' },
      { label: 'Retenue de garantie', value: '132 M', sub: 'cumulée' },
      { label: 'DO / RC', value: 'valides', sub: 'polices' },
      { label: 'Prochaine échéance', value: '30.09', sub: 'caution avance' },
    ],
    table: {
      title: 'Cautions & garanties',
      cols: [{ label: 'Garantie', grow: 2 }, { label: 'Bénéficiaire' }, { label: 'Montant', num: true }, { label: 'Échéance' }],
      rows: [
        [{ text: 'Caution de bonne fin', sub: 'lot 02' }, { sec: 'MOA' }, { num: '186 M' }, { badge: { label: 'valide', kind: 'success' } }],
        [{ text: 'Caution d’avance', sub: 'lot 02' }, { sec: 'MOA' }, { num: '94 M' }, { badge: { label: 'à renouveler', kind: 'accent' } }],
        [{ text: 'Garantie de retenue', sub: 'lot 01 VRD' }, { sec: 'MOA' }, { num: '16 M' }, { badge: { label: 'valide', kind: 'success' } }],
        [{ text: 'Garantie financière achèvement', sub: 'VEFA' }, { sec: 'Acquéreurs' }, { num: '190 M' }, { badge: { label: 'valide', kind: 'success' } }],
      ],
    },
    facts: {
      title: 'Échéances & relances',
      items: [
        { label: 'Caution d’avance lot 02', value: '30.09.2026', sub: 'relance émise', sev: 'accent' },
        { label: 'GFA — VEFA', value: 'valide', sub: 'obligatoire à la vente', sev: 'neutral' },
        { label: 'Mainlevées', value: '2', sub: 'à la réception' },
      ],
    },
  },
  m18: {
    context: 'raccordements concessionnaires',
    primary: 'Suivre une demande',
    secondary: 'Échéancier réseaux',
    kpis: [
      { label: 'Demandes', value: '4', sub: '1 en attente', accent: true },
      { label: 'Eau', value: 'SODECI', sub: 'accordé' },
      { label: 'Électricité', value: 'CIE', sub: 'devis reçu' },
      { label: 'Télécom', value: 'fibre', sub: 'planifié' },
      { label: 'Coût réseaux', value: '84 M', sub: 'estimé' },
    ],
    table: {
      title: 'Raccordements',
      cols: [{ label: 'Réseau', grow: 2 }, { label: 'Concessionnaire' }, { label: 'Coût', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Eau potable', sub: 'DN 150' }, { sec: 'SODECI' }, { num: '18 M' }, { badge: { label: 'accordé', kind: 'success' } }],
        [{ text: 'Électricité', sub: 'poste 630 kVA' }, { sec: 'CIE' }, { num: '46 M' }, { badge: { label: 'devis reçu', kind: 'accent' } }],
        [{ text: 'Assainissement', sub: 'branchement EU/EP' }, { sec: 'District' }, { num: '14 M' }, { badge: { label: 'instruit', kind: 'neutral' } }],
        [{ text: 'Fibre optique', sub: 'génie civil réalisé' }, { sec: 'Orange CI' }, { num: '6 M' }, { badge: { label: 'planifié', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Conditions d’exploitation',
      items: [
        { label: 'Électricité — devis CIE', value: '46 M', sub: 'à valider · condition de réception', sev: 'accent' },
        { label: 'Eau raccordée', value: 'OK', sub: 'compteur chantier', sev: 'neutral' },
        { label: 'Coordination réseaux', value: '82 %', sub: 'plan de synthèse' },
      ],
    },
  },
  m19: {
    context: 'réception & GPA · réserves',
    primary: 'Prononcer la réception',
    secondary: 'Registre des réserves',
    kpis: [
      { label: 'Réserves', value: '—', sub: 'réception non prononcée' },
      { label: 'Avancement', value: '58 %', sub: 'avant OPR' },
      { label: 'OPR', value: 'à planifier', sub: 'gros œuvre' },
      { label: 'GPA', value: '12 mois', sub: 'après réception' },
      { label: 'DOE', value: '0 / 9', sub: 'lots remis' },
    ],
    table: {
      title: 'Préparation de la réception',
      cols: [{ label: 'Étape', grow: 2 }, { label: 'Responsable' }, { label: 'Cible', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Opérations préalables (OPR)', sub: 'lot 02' }, { sec: 'MOE' }, { num: 'T4 2027' }, { badge: { label: 'à planifier', kind: 'neutral' } }],
        [{ text: 'Levée des réserves', sub: 'process GPA' }, { sec: 'Entreprises' }, { num: '—' }, { badge: { label: 'à venir', kind: 'neutral' } }],
        [{ text: 'Remise des DOE', sub: 'dossier ouvrages exécutés' }, { sec: 'MOE' }, { num: 'T4 2027' }, { badge: { label: 'en préparation', kind: 'accent' } }],
        [{ text: 'Quitus décennale', sub: 'attestations' }, { sec: 'Entreprises' }, { num: '—' }, { badge: { label: 'bloqué', kind: 'danger' } }],
      ],
    },
    facts: {
      title: 'Conditions',
      items: [
        { label: 'Décennale EGCI', value: 'expirée', sub: 'bloque le quitus', sev: 'danger' },
        { label: 'Livraison contractuelle', value: 'T4 2027', sub: 'tenue', sev: 'neutral' },
        { label: 'GPA', value: '12 mois', sub: 'à compter de la réception' },
      ],
    },
  },
  m20: {
    context: 'risques & HSSE · registre RACI',
    primary: 'Déclarer un risque',
    secondary: 'Matrice RACI',
    kpis: [
      { label: 'Risques ouverts', value: '11', sub: '2 majeurs', accent: true },
      { label: 'Criticité max', value: 'R-11', sub: 'conformité décennale' },
      { label: 'HSSE', value: '0', sub: 'accident déclarable' },
      { label: 'Presque-accidents', value: '3', sub: 'ce mois' },
      { label: 'Plans d’action', value: '8', sub: 'en cours' },
    ],
    table: {
      title: 'Registre des risques',
      meta: 'tri par criticité',
      cols: [{ label: 'Risque', grow: 2 }, { label: 'Pilote' }, { label: 'Criticité', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'R-11 — décennale EGCI expirée', sub: 'blocage paiement' }, { sec: 'Finance' }, { num: '16', accentNum: true }, { badge: { label: 'majeur', kind: 'danger' } }],
        [{ text: 'R-08 — dérive gros œuvre', sub: 'chemin critique +16 j' }, { sec: 'MOE' }, { num: '12' }, { badge: { label: 'majeur', kind: 'accent' } }],
        [{ text: 'R-05 — nappe / fondations', sub: 'reprise en cours' }, { sec: 'BET Sol' }, { num: '9' }, { badge: { label: 'suivi', kind: 'neutral' } }],
        [{ text: 'R-04 — aléa commercial T4', sub: 'écoulement lent' }, { sec: 'Commerce' }, { num: '6' }, { badge: { label: 'suivi', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'RACI — R-11',
      items: [
        { label: 'Responsable', value: 'Finance', sub: 'régularise la conformité' },
        { label: 'Approbateur', value: 'MOA', sub: 'lève le blocage de paiement' },
        { label: 'Consulté', value: 'MOE · CT', sub: 'informé : entreprise', sev: 'neutral' },
      ],
    },
  },
  m21: {
    context: 'passation vers exploitation',
    primary: 'Préparer le transfert',
    secondary: 'Check-list DOE',
    kpis: [
      { label: 'Préparation', value: '12 %', sub: 'phase amont' },
      { label: 'DOE', value: '0 / 9', sub: 'lots' },
      { label: 'Contrats exploit.', value: '0', sub: 'à mettre en place' },
      { label: 'Garanties', value: 'GPA', sub: '12 mois' },
      { label: 'Livrables', value: '24', sub: 'à collecter', accent: true },
    ],
    table: {
      title: 'Transfert vers l’exploitation',
      cols: [{ label: 'Livrable', grow: 2 }, { label: 'Source' }, { label: 'Cible', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Dossier ouvrages exécutés', sub: 'tous lots' }, { sec: 'MOE' }, { num: 'T4 2027' }, { badge: { label: 'à venir', kind: 'neutral' } }],
        [{ text: 'Contrats de maintenance', sub: 'CVC · ascenseurs' }, { sec: 'Exploitant' }, { num: 'T4 2027' }, { badge: { label: 'à venir', kind: 'neutral' } }],
        [{ text: 'Carnet de vie du bâtiment', sub: 'numérique' }, { sec: 'MOA' }, { num: 'T4 2027' }, { badge: { label: 'en préparation', kind: 'accent' } }],
        [{ text: 'Notices d’exploitation', sub: 'équipements' }, { sec: 'Entreprises' }, { num: '—' }, { badge: { label: 'à collecter', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Jalons de transfert',
      items: [
        { label: 'Réception préalable', value: 'requise', sub: 'condition du transfert', sev: 'neutral' },
        { label: 'GPA active', value: '12 mois', sub: 'suivi des levées' },
        { label: 'Bilan définitif', sub: 'clôture après GPA', sev: 'neutral' },
      ],
    },
  },
  m22: {
    context: 'cockpit & reporting',
    primary: 'Générer un état',
    secondary: 'Exporter',
    kpis: [
      { label: 'Coût prévu', value: '4,85 Md', sub: 'BAC' },
      { label: 'Marge prévue', value: '+612 M', sub: '12,6 %' },
      { label: 'TRI', value: '14,2 %', sub: 'sur flux' },
      { label: 'Avancement', value: '58 %', sub: 'physique' },
      { label: 'Point bas tréso', value: '−418 M', sub: 'nov. 2026', accent: true },
    ],
    table: {
      title: 'Indicateurs consolidés',
      meta: 'temps réel',
      cols: [{ label: 'Indicateur', grow: 2 }, { label: 'Référence', num: true }, { label: 'Réalisé', num: true }, { label: 'Écart', num: true }],
      rows: [
        [{ text: 'Coût à terminaison', sub: 'BAC' }, { num: '4 850 M' }, { num: '3 484 M' }, { num: '+25 M', accentNum: true }],
        [{ text: 'Recettes', sub: 'ventes' }, { num: '5 462 M' }, { num: '2 076 M' }, { num: '—', mutedNum: true }],
        [{ text: 'Marge', sub: 'prévisionnelle' }, { num: '+612 M' }, { num: '—' }, { num: '−36 M', accentNum: true }],
        [{ text: 'Délai livraison', sub: 'contractuel' }, { num: 'T4 2027' }, { num: 'T4 2027' }, { num: '—', mutedNum: true }],
      ],
    },
    facts: {
      title: 'Signaux',
      items: [
        { label: 'Avenant non intégré', value: '+42 M', sub: 'écart bilan figé / vivant', sev: 'accent' },
        { label: 'Dérive planning', value: '+16 j', sub: 'gros œuvre', sev: 'accent' },
        { label: 'Conformité décennale', value: 'expirée', sub: 'blocage paiement', sev: 'danger' },
      ],
    },
  },
  m23: {
    context: 'copilote PROPH3T · IA locale',
    primary: 'Poser une question',
    secondary: 'Sources',
    kpis: [
      { label: 'Modèle', value: 'local', sub: 'Ollama · souverain' },
      { label: 'Sources', value: '412', sub: 'documents indexés' },
      { label: 'Requêtes', value: '86', sub: 'ce mois' },
      { label: 'Rétention', value: 'aucune', sub: 'données sensibles' },
      { label: 'Repli', value: 'Claude', sub: 'sur consentement' },
    ],
    table: {
      title: 'Analyses proposées',
      meta: 'aucun calcul monétaire par le LLM',
      cols: [{ label: 'Analyse', grow: 2 }, { label: 'Module' }, { label: 'Confiance', num: true }, { label: 'Statut' }],
      rows: [
        [{ text: 'Synthèse de la chaîne décennale', sub: 'R-11 → situation n° 7' }, { sec: 'M7 · M16' }, { num: 'élevée' }, { badge: { label: 'prête', kind: 'accent' } }],
        [{ text: 'Impact avenant n° 1', sub: 'coût · délai · marge' }, { sec: 'M15' }, { num: 'moyenne' }, { badge: { label: 'à vérifier', kind: 'neutral' } }],
        [{ text: 'Résumé des RFI ouvertes', sub: '11 demandes' }, { sec: 'M12' }, { num: 'élevée' }, { badge: { label: 'prête', kind: 'neutral' } }],
      ],
    },
    facts: {
      title: 'Souveraineté',
      items: [
        { label: 'Traitement local', value: 'Ollama', sub: 'noDataRetention pour le sensible', sev: 'neutral' },
        { label: 'Calculs monétaires', value: 'Money.ts', sub: 'jamais le LLM', sev: 'neutral' },
        { label: 'Consentement requis', sub: 'avant tout repli cloud', sev: 'neutral' },
      ],
    },
  },
};
