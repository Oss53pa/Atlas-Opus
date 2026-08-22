/**
 * Modèle de navigation Atlas Opus.
 * Deux contextes de barre latérale (réf handoff § « Barre latérale ») :
 *  - contexte OPÉRATION : les 6 familles et leurs 23 modules ;
 *  - contexte LOCATAIRE : entrées transverses épinglées (membres, notifications…).
 */

export type ScreenId =
  // Parcours d'entrée / transverse (contexte locataire)
  | 'login' | 'workspaces' | 'home' | 'menu'
  | 'members' | 'notifications' | 'approvals' | 'onboarding' | 'invite' | 'states'
  // Modules (contexte opération)
  | 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9' | 'm10' | 'm11' | 'm12'
  | 'm13' | 'm14' | 'm15' | 'm16' | 'm17' | 'm18' | 'm19' | 'm20' | 'm21' | 'm22' | 'm23'
  // Écrans de détail (34–50)
  | 'create-wizard' | 'poste-bilan' | 'plan-tresorerie' | 'arretes' | 'intervenant'
  | 'assurances' | 'risques-raci' | 'simulateur' | 'jalons' | 'marche' | 'situation'
  | 'offre' | 'rfi' | 'visa' | 'cr-chantier' | 'reserves' | 'journal';

/** Écrans de détail : titre, fil de contexte et code de rattachement. */
export const detailMeta: Record<string, { title: string; context: string; code: string }> = {
  'create-wizard': { title: 'Nouvelle opération', context: 'étape 3 sur 5 · brouillon enregistré à 15 h 04', code: 'M1' },
  'poste-bilan': { title: 'Travaux', context: 'poste 3 sur 8 · 2 940 M prévus · dernière écriture il y a 12 min', code: 'M4' },
  'plan-tresorerie': { title: 'Plan de trésorerie', context: 'cumulé · 36 mois · point bas −418 M en nov. 2026', code: 'M4' },
  'arretes': { title: 'Arrêtés de bilan', context: 'snapshots scellés · irréversibles', code: 'M4' },
  'intervenant': { title: 'EGCI Bâtiment', context: 'entreprise · gros œuvre lot 02 · 1 conformité expirée', code: 'M7' },
  'assurances': { title: 'Tableau des assurances', context: '9 polices · 1 échéance dépassée', code: 'M7' },
  'risques-raci': { title: 'Registre des risques & RACI', context: '11 risques · tri par criticité', code: 'M20' },
  'simulateur': { title: 'Simulateur d’impact', context: 'avenant n° 1 — lot 02 · simulation non engageante', code: 'M15' },
  'jalons': { title: 'Jalons & baseline', context: 'baseline v2 figée le 11.06.2026 · 7 jalons contractuels', code: 'M13' },
  'marche': { title: 'Marché lot 02 — gros œuvre', context: 'EGCI Bâtiment · notifié le 11.03.2026 · 1 282 M engagés', code: 'M8' },
  'situation': { title: 'Situation n° 7', context: 'gros œuvre lot 02 · 184 M · mise en paiement suspendue', code: 'M16' },
  'offre': { title: 'Offre — Clima CI', context: 'lot 03 · CVC / plomberie · rang 1 sur 4', code: 'M9' },
  'rfi': { title: 'RFI-042', context: 'réservation de gaine / voile porteur · ouverte le 12.08.2026', code: 'M12' },
  'visa': { title: 'Visa — STR-EXE-118', context: 'indice C · voile porteur R+2 · visa A bloqué', code: 'M11' },
  'cr-chantier': { title: 'Compte rendu n° 31', context: 'réunion du 19.08.2026 · 17 actions ouvertes', code: 'M14' },
  'reserves': { title: 'Réserves & levées', context: 'réception non prononcée · GPA à venir', code: 'M19' },
  'journal': { title: 'Journal d’audit', context: '2 418 écritures · rétention 10 ans · non modifiable', code: 'M23' },
};

export interface ModuleEntry {
  code: string; // « M4 »
  id: ScreenId;
  title: string; // titre d'écran
  short: string; // libellé court en barre latérale
  badge?: number; // pastille (ex. décisions en attente)
}

export interface Family {
  id: string;
  label: string;
  modules: ModuleEntry[];
}

/** Les 6 familles et leurs 23 modules (contexte opération). */
export const families: Family[] = [
  {
    id: 'amont',
    label: 'Amont & foncier',
    modules: [
      { code: 'M1', id: 'm1', title: 'Opération & programme', short: 'Opération & programme' },
      { code: 'M2', id: 'm2', title: 'Foncier & montage juridique', short: 'Foncier & juridique', badge: 1 },
      { code: 'M3', id: 'm3', title: 'Études amont', short: 'Études amont' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & recettes',
    modules: [
      { code: 'M4', id: 'm4', title: 'Bilan d’opération', short: 'Bilan & rentabilité' },
      { code: 'M5', id: 'm5', title: 'Financement & déblocages', short: 'Financement' },
      { code: 'M6', id: 'm6', title: 'Commercialisation & recettes', short: 'Commercialisation' },
      { code: 'M16', id: 'm16', title: 'Chaîne de paiement', short: 'Paiements', badge: 3 },
      { code: 'M17', id: 'm17', title: 'Cautions & garanties', short: 'Cautions & garanties' },
    ],
  },
  {
    id: 'contractuel',
    label: 'Contractuel & achats',
    modules: [
      { code: 'M7', id: 'm7', title: 'Parties prenantes & contrats', short: 'Parties prenantes' },
      { code: 'M8', id: 'm8', title: 'Passation des marchés', short: 'Passation des marchés' },
      { code: 'M9', id: 'm9', title: 'Analyse des offres', short: 'Analyse des offres' },
      { code: 'M10', id: 'm10', title: 'Achats & logistique', short: 'Achats & logistique' },
    ],
  },
  {
    id: 'conception',
    label: 'Conception & collaboration',
    modules: [
      { code: 'M11', id: 'm11', title: 'Conception & GED', short: 'Conception & GED' },
      { code: 'M12', id: 'm12', title: 'RFI & collaboration externe', short: 'RFI & collaboration' },
    ],
  },
  {
    id: 'execution',
    label: 'Exécution',
    modules: [
      { code: 'M13', id: 'm13', title: 'Planning & chemin critique', short: 'Planning' },
      { code: 'M14', id: 'm14', title: 'Pilotage de réalisation', short: 'Pilotage réalisation' },
      { code: 'M15', id: 'm15', title: 'Maîtrise des modifications', short: 'Modifications' },
      { code: 'M18', id: 'm18', title: 'Raccordements', short: 'Raccordements' },
      { code: 'M19', id: 'm19', title: 'Réception & GPA', short: 'Réception & GPA' },
    ],
  },
  {
    id: 'transverse',
    label: 'Transverse',
    modules: [
      { code: 'M20', id: 'm20', title: 'Risques & HSSE', short: 'Risques & RACI' },
      { code: 'M21', id: 'm21', title: 'Passation vers exploitation', short: 'Vers exploitation' },
      { code: 'M22', id: 'm22', title: 'Cockpit & reporting', short: 'Cockpit & reporting' },
      { code: 'M23', id: 'm23', title: 'Copilote PROPH3T', short: 'Copilote PROPH3T' },
    ],
  },
];

/** Entrées transverses (contexte locataire) épinglées en bas de la liste. */
export interface TenantEntry { code: string; id: ScreenId; title: string; }
export const tenantEntries: TenantEntry[] = [
  { code: 'F1', id: 'members', title: 'Membres & rôles' },
  { code: 'F4', id: 'notifications', title: 'Centre de notifications' },
  { code: 'F7', id: 'approvals', title: 'Boîte d’approbations' },
];

const moduleById = new Map<ScreenId, { family: Family; module: ModuleEntry }>();
for (const family of families) {
  for (const module of family.modules) moduleById.set(module.id, { family, module });
}

export function findModule(id: ScreenId) {
  return moduleById.get(id) ?? null;
}

/** Ordre plat des modules pour la navigation « précédent / suivant ». */
export const moduleOrder: ScreenId[] = families.flatMap((f) => f.modules.map((m) => m.id));
