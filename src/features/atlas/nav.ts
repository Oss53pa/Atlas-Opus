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
  // Écrans de détail
  | 'poste-bilan' | 'marche' | 'situation' | 'journal';

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
