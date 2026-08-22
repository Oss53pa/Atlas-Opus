# Atlas Opus — Spécifications détaillées des modules
> Application de **Maîtrise d'Ouvrage** (UEMOA / CEMAC). Document maître : spécifie les **7 fondations transverses (F1–F7)** et les **23 modules** au standard détaillé, exploitable sans interprétation par Claude Code / Cowork.
> Références : *Atlas Opus — CDC v4.1*, `CLAUDE.md` (v4.1), `schema.sql` (v4.1, 81 tables), `tokens.ts`.
> Version 1.1 · Confidentiel · Juin 2026
>
> **Nouveautés v1.1** : ajout des 7 fondations (Auth/tenancy, Money.ts, Offline/synchro, Notifications, Intégrations, Fiscalité, Workflow/délégation) ; RLS corrigée (périmètre opération + rôles) ; fiscalité TVA/retenues (M15) ; révision de prix (M8) ; change/FX (M9) ; reporting bailleurs (M21).
---
## Conventions transverses (valables pour tous les modules)
- **Multitenant strict + périmètre opération** : chaque table porte `tenant_id` sous **RLS** (`tenant_id ∈ user_tenants()`) ; les tables à `operation_id` ajoutent `operation_id ∈ user_operations()` (respecte `memberships.operation_scope`). Les **écritures sensibles** sont gardées par `has_role(...)` ET revérifiées en Edge Functions.
- **Argent** : `numeric(18,2)` en base ; tout calcul via **`Money.ts`** (centimes entiers), jamais de flottant, jamais délégué à un LLM.
- **IDs** `uuid` (`gen_random_uuid()`) · **dates** `timestamptz`/`date` · `created_at`/`updated_at` implicites.
- **i18n** : aucun texte en dur ; clés de traduction ; formats dérivés du `locale` pays.
- **Offline-first** : consultation et saisie terrain hors-ligne ; écritures financières en brouillon hors-ligne uniquement.
- **Audit** : toute écriture sensible et toute étape de passation → `audit_log` (hash SHA-256 chaîné).
- **Edge Functions** : seul accès `service_role` (passation, mandatement, écritures, intégrations).
- **Rôles** : `owner`, `moa_director`, `finance`, `amo`, `procurement`, `commercial`, `site`, `stakeholder`, `viewer`.
## Standard de spécification (13 rubriques par module)
`1` Objectif & périmètre · `2` Rôles & permissions · `3` Dictionnaire de données · `4` Machine à états · `5` Règles de gestion (RG-Mx-nn) · `6` Écrans (+ responsive) · `7` API & Edge Functions · `8` Validations & cas limites · `9` i18n & Télémétrie · `10` Critères d'acceptation (Gherkin) · `11` Définition de fini.
## Carte des modules & paliers
| # | Module | Palier |
|---|--------|--------|
| M1 | Opération & programme | MVP |
| M2 | Foncier & montage juridique | MVP |
| M3 | Études amont (sol, EIES/PGES) | V2 |
| M4 | Bilan d'opération & rentabilité | MVP |
| M5 | Financement & déblocages | V1 |
| M6 | Commercialisation & recettes (VEFA/baux) | V1 |
| M7 | Parties prenantes & contrats | MVP |
| M8 | Passation des marchés (privé/public) | V1/V2 |
| M9 | Achats, approvisionnements & logistique | V1 |
| M10 | Conception & GED | V1 |
| M11 | RFI & collaboration externe | V1 |
| M12 | Planning & chemin critique | MVP |
| M13 | Pilotage de réalisation (supervision) | MVP |
| M14 | Maîtrise des modifications | MVP |
| M15 | Chaîne de paiement & engagements | MVP |
| M16 | Cautions & garanties | V1 |
| M17 | Concessionnaires & raccordements | V2 |
| M18 | Qualité, réception & GPA | V2 |
| M19 | Risques, litiges, assurances & HSSE | V2 |
| M20 | Passation → exploitation (FM + Atlas Lease) | V2 |
| M21 | Cockpit & reporting | V1 |
| M22 | Copilote PROPH3T | V1 |
| M23 | Analyse & dépouillement des offres | V1 |
---
# Fondations transverses (F1–F7)
> Ces briques traversent tous les modules. Elles se construisent **avant ou avec le MVP**. Sans elles, les modules métier ne tiennent pas.
## F1 — Auth, tenancy & onboarding
- **Objectif.** Cycle de vie des accès : création de tenant, invitations, attribution des rôles et du **périmètre d'opérations**, acceptation, révocation, réinitialisation.
- **Données.** `invitations` (email, role, operation_scope, token, status) ; `memberships` (role, operation_scope, delegated_by).
- **Règles.** `RG-F1-01` Une invitation acceptée crée un `membership` avec rôle + périmètre. `RG-F1-02` Seuls owner/moa_director invitent. `RG-F1-03` La révocation coupe l'accès immédiatement (RLS). `RG-F1-04` Le premier utilisateur d'un tenant est `owner`.
- **Fini.** Invitation → acceptation → accès testés ; révocation effective en base ; isolation vérifiée.
## F2 — Money.ts (moteur monétaire)
- **Objectif.** Brique unique de calcul monétaire dont dépend toute l'exactitude (bilan, TRI, paiement, retenue). **Aucun** module ne calcule un montant autrement.
- **Contrat.** Représentation en **centimes entiers** (`bigint`) ; jamais de flottant. Opérations : add/sub/mul(scalar)/divRound. Arrondi **HALF_UP** à 2 décimales aux frontières (affichage, persistance). Multidevise : chaque montant porte sa devise ; addition inter-devises interdite sans conversion au **taux figé** (stocké). Formatage via `locale` pays.
- **Algorithmes.** TRI par **Newton-Raphson** (r0 = 0.1, tolérance 1e-7, max 100 itérations, garde-fous : pas de retournement de signe → null ; non-convergence → null). VAN. Division protégée (dénominateur nul → null).
- **Règles.** `RG-F2-01` Tout montant transite par Money.ts. `RG-F2-02` Comparaison de prix (M23) et net de paiement (M15) en centimes entiers. `RG-F2-03` Conversion FX uniquement au taux figé tracé.
- **Fini.** Tests unitaires exhaustifs : arrondis, add/sub/mul, TRI (cas convergents/divergents), conversion FX, dénominateur nul. Couverture 100 % de ce module.
## F3 — Offline & synchronisation
- **Objectif.** Rendre la consultation et la **saisie terrain** possibles hors-ligne, avec synchro différée déterministe.
- **Périmètre offline.** Lecture des données de l'opération en cache ; saisie : avancement (M13), réserves (M18), incidents HSSE (M19), photos. **Les écritures financières restent en brouillon** hors-ligne (jamais mandatées/payées hors-ligne).
- **Modèle.** File de mutations locale horodatée ; identifiants générés côté client (uuid) ; `updated_at` + numéro de version par enregistrement.
- **Résolution de conflits.** `RG-F3-01` Dernière écriture gagnante sur les champs simples ; `RG-F3-02` fusion sans perte sur les collections append-only (registres, fils) ; `RG-F3-03` un conflit sur une donnée validée/scellée est rejeté et signalé pour arbitrage humain.
- **Fini.** Perte réseau simulée : saisie → reconnexion → réconciliation sans perte ; brouillons financiers jamais exécutés hors-ligne ; conflits scellés rejetés.
## F4 — Notifications
- **Objectif.** Acheminer toutes les alertes (les ~30 règles « déclenche une alerte » des modules) vers des canaux réels.
- **Données.** `notifications` (user_id, channel in_app\|email\|sms\|whatsapp, title, body, severity, status).
- **Règles.** `RG-F4-01` Chaque alerte métier produit une notification routée selon les préférences et la sévérité. `RG-F4-02` **WhatsApp/SMS** privilégiés pour le terrain (contexte UEMOA). `RG-F4-03` Escalade si non lue au bout d'un délai (échéances, HSSE critiques). `RG-F4-04` Livraison idempotente (pas de doublon).
- **Fini.** Chaque type d'alerte des modules a un canal et une livraison testée ; préférences respectées ; escalade vérifiée.
## F5 — Intégrations (contrats d'API)
- **Objectif.** Contractualiser chaque système tiers : sens de synchro, idempotence, comportement en panne. Sans cela, ce sont des dépendances qui peuvent couler le projet.
- **Systèmes & flux.**
  - **Atlas Finance** (SYSCOHADA) — sortant : écritures issues de M15 (mandatement, paiement), M4 (bilan). Idempotent par référence d'écriture.
  - **ADVIST** (signature RFC 3161) — aller/retour : documents contractuels (M8, M10, M18) → signés → statut.
  - **CinetPay** (Mobile Money) — sortant : exécution de paiement (M15) avec `idempotency_key` ; retour de statut (settled/failed) ; **jamais de double paiement**.
  - **Atlas Lease** — sortant : unités & baux (M6, M20) à la bascule exploitation.
  - **Atlas Keystone** (FM/HSSE) — sortant : équipements & garanties (M20).
  - **DueDeck** — aller/retour : due diligence approfondie (M2).
- **Données.** `integration_endpoints` (system, config, status) ; `integration_events` (direction, payload, idempotency_key, status pending\|ok\|failed\|retrying).
- **Règles.** `RG-F5-01` Tout appel sortant est idempotent (clé). `RG-F5-02` Panne d'un tiers → file de reprise (retrying) + alerte, jamais de blocage silencieux. `RG-F5-03` Les données restent souveraines (export maîtrisé, tracé).
- **Fini.** Contrat par système (endpoints, payloads, erreurs) ; idempotence testée ; reprise sur panne simulée.
## F6 — Fiscalité (TVA + retenues OHADA)
- **Objectif.** Traiter les obligations fiscales du MOA sur les paiements : **TVA** et **retenues à la source** (précompte / IRVM selon nature et pays), absentes jusqu'ici.
- **Données.** `country_config.vat_rate`, `country_config.wht_rules` ; `tax_lines` (kind tva\|retenue_source, base, rate, amount) rattachées au décompte (M15).
- **Calcul.**
```
tva            = base_ht × vat_rate(pays)
retenue_source = base × wht_rules(pays, nature_prestation)
net_à_payer    = base_ht + tva − retenue_source − retenue_garantie − avance_remboursée − pénalités
```
- **Règles.** `RG-F6-01` Les taux viennent de `country_config`, jamais codés. `RG-F6-02` Chaque décompte (M15) génère ses `tax_lines`. `RG-F6-03` Les retenues à la source sont suivies pour reversement.
- **Fini.** TVA & retenues calculées en Money.ts par pays ; net de paiement conforme ; états de reversement disponibles.
## F7 — Workflow & délégation
- **Objectif.** Factoriser le moteur d'approbation réutilisé par M8 (attribution), M13 (visa situation), M14 (arbitrage) — aujourd'hui réécrit trois fois — et modéliser la **délégation de pouvoir**.
- **Modèle.** Un workflow = suite d'étapes (rôle requis, garde, action approve/return) ; routage par seuil (montant) ; journalisation par étape.
- **Règles.** `RG-F7-01` Une étape ne s'ouvre qu'après validation de la précédente. `RG-F7-02` Le routage par seuil détermine le rôle/instance requis. `RG-F7-03` Un `moa_director` peut **déléguer** (memberships.delegated_by) avec traçabilité et période. `RG-F7-04` Chaque étape est journalisée (audit).
- **Fini.** Moteur générique branché sur M8/M13/M14 ; délégation testée ; audit rejouable.
---
# M1 — Opération & programme  ·  *MVP*
**Alimente :** tout l'édifice (entité racine). **Reçoit des gardes de :** M2 (foncier), M7 (DO).
### 1. Objectif & périmètre
- **Objectif.** Créer et structurer l'**opération** (entité racine), piloter son cycle de vie par une machine à états, et tenir le **programme** (surfaces, usages, exigences) versionné.
- **Périmètre.** Création/édition d'opération ; type & régime ; transitions de phase ; portefeuille multi-opérations ; programme + détection d'écart programme ↔ conception (M10).
- **Hors périmètre.** Bilan (M4), planning (M12), passation (M8).
### 2. Rôles & permissions
| Action | owner | moa_director | amo | autres |
|---|---|---|---|---|
| Créer / modifier opération | C/U | C/U | U | — |
| Changer de phase | T | T | T* | — |
| Lire | R | R | R | R |
| Éditer / valider programme | U | U | U | commercial/site : R |
\* AMO propose ; confirmation moa_director si la config tenant l'exige.
### 3. Dictionnaire de données
**operations** — entité racine.
| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| id | uuid | PK | Opération |
| country_code | char(2) | NOT NULL, FK | Pays : devise & régime hérités |
| name | text | 3–120, unique/tenant | Nom |
| op_type | text | défaut 'commercial' | residential\|commercial\|public\|mixed |
| procurement_mode | text | défaut 'private' | private\|public |
| phase | text | défaut 'amont' | machine §4 |
| currency | char(3) | NOT NULL | modifiable tant qu'aucun coût (RG-M1-06) |
| budget_bac | numeric(18,2) | ≥ 0 | Budget à terminaison |
| retention_rate | numeric(5,4) | 0–1 | Retenue de garantie |
| start_date / end_date | date | end ≥ start | Jalons |
| status | text | défaut 'active' | active\|paused\|closed |
**program_items** — programme versionné.
| Colonne | Type | Contraintes |
|---|---|---|
| operation_id | uuid | FK, index |
| category | text | surface\|usage\|exigence_fonctionnelle\|exigence_technique\|exigence_env |
| label | text | 2–160 |
| target_value / unit | text | nullable |
| version | int | défaut 1 |
| status | text | draft\|validated |
### 4. Machine à états (operation.phase)
| De | Vers | Garde |
|---|---|---|
| amont | conception | ≥ 1 item programme validé ET bilan prévisionnel initialisé (M4) |
| conception | passation | ≥ 1 marché à lancer (M8) |
| passation | realisation | ≥ 1 marché notifié (M8) + permis (M2) + DO (M7) |
| realisation | reception | avancement 100 % OU réception déclarée |
| reception | exploitation | PV réception + réserves majeures levées (M18) |
| exploitation | cloture | bilan définitif validé (M4) |
### 5. Règles de gestion
- **RG-M1-01** — Opération = 1 tenant + 1 pays ; devise & régime hérités.
- **RG-M1-02** — Nom unique par tenant (insensible à la casse).
- **RG-M1-03** — À la création : phase « amont », statut « active ».
- **RG-M1-06** — Devise modifiable seulement tant qu'aucune ligne de bilan ni marché.
- **RG-M1-07** — Changement de type uniquement en phase « amont ».
- **RG-M1-08** — Transition refusée si garde non satisfaite ; conditions manquantes listées.
- **RG-M1-10** — Retour arrière : moa_director + justification, journalisé.
- **RG-M1-11** — Valider le programme incrémente la version ; versions conservées.
### 6. Écrans
- **Portefeuille** — tableau (Nom, Pays, Type, Phase, Devise, BAC, Avancement, Statut) ; filtres ; < 768 px → cartes.
- **Assistant de création** (3 étapes : identité / cadrage / programme initial) ; pré-remplissage IA depuis document.
- **Cockpit opération** — KPI bilan, courbe en S, trésorerie, alertes, pastille de phase + bouton transition.
- **Éditeur de programme** — items par catégorie, versionnage, comparaison v(n)/v(n-1), badge « non couvert ».
### 7. API & Edge Functions
| Endpoint | Méth. | Sortie/erreurs |
|---|---|---|
| operations | GET/POST/PATCH | 201/200 ; 409 si RG-M1-06 |
| transition-phase (edge) | POST | 200 si garde OK ; 422 + conditions manquantes |
| program-items / program-validate (edge) | POST | nouvelle version |
### 8. Validations & cas limites
- name requis 3–120 unique ; end_date ≥ start_date ; devise verrouillée si montants existants ; transition sautant une phase refusée ; opération close en lecture seule.
### 9. i18n & Télémétrie
- Événements : `operation.created`, `operation.updated`, `operation.phase_changed`, `program.version_created`.
### 10. Critères d'acceptation
```gherkin
Scénario: Transition bloquée
  Étant donné une opération « amont » sans programme validé
  Quand on tente de passer en « conception »
  Alors la transition est refusée avec les conditions manquantes (RG-M1-08)
Scénario: Isolation multitenant
  Étant donné deux tenants A et B
  Quand un utilisateur de A liste les opérations
  Alors aucune opération de B n'apparaît
```
### 11. Définition de fini
RG-M1-01..12 testées · RLS isolée · machine à états gardée · écrans 360→1920 + états vide/chargement/erreur · a11y AA · Gherkin verts · aucun texte en dur.
---
# M2 — Foncier & montage juridique  ·  *MVP*
**Alimente :** gardes de phase M1 (DD critique, permis). **Lien :** DueDeck (DD approfondie).
### 1. Objectif & périmètre
- **Objectif.** Sécuriser l'assise foncière et juridique : terrain & titres, due diligence, société de projet (OHADA), autorisations.
- **Hors périmètre.** Études techniques de sol / EIES (M3) ; bilan/financement (M4/M5).
### 2. Rôles & permissions
| Action | moa_director | amo | finance | viewer |
|---|---|---|---|---|
| Parcelles & titres : saisir | U | U | — | R |
| Due diligence : gérer | U | U | — | R |
| Montage juridique : gérer | U | U | — | R |
| Autorisations : suivre | U | U | — | R |
| Lever condition / acter acquisition | V | — | — | — |
### 3. Dictionnaire de données
- **land_parcels** : reference, area, `tenure_type` (titre_foncier\|bail_emphytéotique\|droit_coutumier\|concession), price, `acquisition_status`, notary, geo(jsonb).
- **title_documents** : parcel_id, doc_type (titre_foncier\|acte_notarié\|certificat\|bornage), reference, status (pending\|verified), file_ref.
- **due_diligence_items** : category (servitude\|litige\|hypothèque\|bornage\|conformité), finding, severity (low\|medium\|high\|critical), status (open\|cleared).
- **legal_entities** : structure_type (SCI\|SA\|SAS\|SARL), name, rccm, shareholders(jsonb), status (draft\|constituted).
- **authorizations** : type (permis_construire\|autorisation_env\|conformité), authority, status (draft\|submitted\|granted\|refused), validity, conditions(jsonb).
### 4. Machines à états
**Acquisition** : prospection → sous_promesse → conditions_levées → acquis (acte notarié vérifié).
**Autorisation** : draft → submitted → granted | refused.
### 5. Règles de gestion
- **RG-M2-02** — `titre_foncier` exige un acte notarié vérifié pour « acquis ».
- **RG-M2-03** — DD « critical »/« high » non « cleared » bloque la phase « conception » (garde M1).
- **RG-M2-05** — Condition suspensive non levée bloque sous_promesse → conditions_levées.
- **RG-M2-06** — `constituted` exige un RCCM.
- **RG-M2-07** — Permis « granted » requis pour la phase « réalisation » (garde M1).
- **RG-M2-08** — Autorisation « refused » → alerte danger + blocage aval.
- **RG-M2-09** — Validité ≤ 30 j ou dépassée → alerte d'échéance.
### 6. Écrans
- **Dossier foncier** (parcelles + titres + progression d'acquisition).
- **Due diligence** (check-list par catégorie, sévérité, badge bloquant, lien DueDeck).
- **Montage juridique** (structure, associés, RCCM ; somme quotes-parts = 100 %).
- **Autorisations** (statut, validité avec compte à rebours, conditions).
### 7. API & Edge Functions
land-parcels · title-documents · due-diligence · legal-entities · authorizations · **foncier-gate (edge)** → `{ ok, blocking_items }` pour la garde M1.
### 8. Validations & cas limites
tenure_type ∈ énum ; area/price ≥ 0 ; « acquis » sans acte vérifié refusé ; quotes-parts ≠ 100 % → alerte ; autorisation expirée → blocage aval.
### 9. i18n & Télémétrie
`foncier.parcel_acquired`, `foncier.dd_item_flagged`, `foncier.authorization_status`, `foncier.legal_entity_constituted`.
### 10. Critères d'acceptation
```gherkin
Scénario: Permis requis pour la réalisation
  Étant donné un permis_construire « submitted »
  Quand on demande la transition vers « réalisation »
  Alors elle est refusée tant que le permis n'est pas « granted » (RG-M2-07)
```
### 11. Définition de fini
RG-M2-01..10 testées · gardes M1 vérifiées · machines à états gardées · écrans responsive + a11y · Gherkin verts.
---
# M3 — Études amont (sol, EIES / PGES)  ·  *V2*
**Alimente :** autorisations M2, bilan M4 (poste études), HSSE M19.
### 1. Objectif & périmètre
- **Objectif.** Piloter les études techniques et environnementales préalables : géotechnique (sol), topographie, **EIES** (étude d'impact environnemental et social) et **PGES** (plan de gestion E&S) avec suivi en phase travaux.
- **Hors périmètre.** La conception détaillée (M10) ; le foncier juridique (M2).
### 2. Rôles & permissions
| Action | moa_director | amo | site | viewer |
|---|---|---|---|---|
| Commander/suivre une étude | U | U | — | R |
| Saisir EIES/PGES | U | U | — | R |
| Suivi PGES chantier | U | U | U | R |
### 3. Dictionnaire de données
- **studies** : type (geotech\|topo\|hydro\|eies\|autre), provider_id (M7), status (commandée\|en_cours\|livrée\|validée), findings(text), file_ref.
- **eies_items** : impact, milieu (eau\|air\|sol\|social), severity, mesure_attenuation, status (planifiée\|en_cours\|réalisée).
- **pges_actions** : action, responsable, échéance, indicateur, status (open\|done).
### 4. Machine à états (study.status)
commandée → en_cours → livrée → validée (revue MOA).
### 5. Règles de gestion
- **RG-M3-01** — Selon pays/seuil, l'EIES validée est requise avant l'autorisation environnementale (garde fournie à M2).
- **RG-M3-02** — Une étude géotechnique « validée » est recommandée avant le démarrage de la conception structure (alerte sinon).
- **RG-M3-03** — Les actions PGES en retard déclenchent une alerte HSSE (M19).
- **RG-M3-04** — Les coûts d'études alimentent le poste « études_honoraires » du bilan (M4).
### 6. Écrans
- **Études** (liste par type, statut, livrables).
- **EIES** (registre d'impacts + mesures d'atténuation).
- **PGES** (plan d'actions, indicateurs, suivi chantier).
### 7. API & Edge Functions
studies · eies-items · pges-actions · **eies-gate (edge)** → garde autorisation M2.
### 8. Validations & cas limites
type ∈ énum ; EIES requise non validée → blocage autorisation env ; action PGES sans responsable refusée.
### 9. i18n & Télémétrie
`study.delivered`, `eies.validated`, `pges.action_overdue`.
### 10. Critères d'acceptation
```gherkin
Scénario: EIES requise avant autorisation
  Étant donné une opération soumise à EIES sans EIES validée
  Quand on dépose l'autorisation environnementale
  Alors eies-gate la bloque (RG-M3-01)
```
### 11. Définition de fini
Gardes M2 vérifiées · suivi PGES → alertes M19 · coûts → M4 · responsive + a11y · Gherkin verts.
---
# M4 — Bilan d'opération & rentabilité  ·  *MVP*
**Reçoit de :** M5 (frais financiers), M6 (recettes), M7 (honoraires), M8/M9 (engagés), M14 (avenants). **Alimente :** cockpit M21.
### 1. Objectif & périmètre
- **Objectif.** La vérité financière : tous coûts vs recettes, suivis en **prévu / engagé / réalisé**, indicateurs (marge, taux, **TRI**, VAN), plan de trésorerie. Recalcul continu.
- **Hors périmètre.** La saisie source (M5/M6/M7/M8) ; M4 consolide et calcule.
- **Principe.** Tous calculs en `Money.ts` (centimes entiers), jamais de LLM.
### 2. Rôles & permissions
| Action | finance | moa_director | amo | commercial | viewer |
|---|---|---|---|---|---|
| Saisir prévisionnel coûts | U | U | — | — | — |
| Saisir prévisionnel recettes | U | U | — | U | — |
| Arrêter (snapshot) | V | V | — | — | — |
| Valider bilan définitif | — | V | — | — | — |
### 3. Dictionnaire de données
- **bilan_lines** : kind (cost\|revenue), poste (foncier\|études_honoraires\|travaux\|assurances\|frais_financiers\|taxes\|aléas\|commercialisation\|ventes\|loyers\|subventions), amount_planned, amount_committed, amount_actual.
- **bilan_snapshots** : label (prévisionnel\|mensuel\|définitif), data(jsonb immuable), hash, created_by.
### 4. États du bilan
prévisionnel (vivant) → arrêté (snapshot immuable, scellé) → définitif (clôture, verrouillé).
### 5. Calculs (`Money.ts`)
```
coût_{prévu|engagé|réalisé} = Σ cost.amount_{planned|committed|actual}
reste_à_engager = coût_prévu - coût_engagé
recettes_{prévues|réalisées} = Σ revenue.amount_{planned|actual}
marge = recettes - coût ; taux_marge_sur_coût = marge / coût_prévu (si > 0)
VAN(r) = Σ_t flux[t]/(1+r)^t ; TRI = r tel que VAN(r)=0  (Newton-Raphson)
  - pas de retournement de signe → TRI = null (motif)
  - non convergence (>100 itér.) → TRI = null (motif)
trésorerie_cumulée[t] = Σ_{k≤t} (encaissements[k]-décaissements[k])
besoin_max = min(trésorerie_cumulée)
```
### 5b. Règles de gestion
- **RG-M4-01** — Calculs en Money.ts ; aucun flottant, aucun LLM.
- **RG-M4-05** — Dénominateur nul → « n/a », pas d'erreur ; TRI suit ses garde-fous.
- **RG-M4-07** — reste_à_engager < 0 → alerte dépassement.
- **RG-M4-08** — Marge prévue < 0 → alerte « danger » (cockpit M21).
- **RG-M4-09** — Snapshot immuable, scellé (hash chaîné).
- **RG-M4-10** — Bilan définitif : phase clôture + moa_director ; verrouille le prévisionnel.
### 6. Écrans
- **Bilan (waterfall)** — KPI (coût, recettes, marge, TRI, besoin tréso) ; cascade ; tableau par poste (prévu/engagé/réalisé/reste/écart) ; < 768 → liste.
- **Détail poste** (drill-down vers marchés/ventes).
- **Plan de trésorerie** (courbe cumulée + point bas).
- **Arrêtés** (historique, comparaison de snapshots).
### 7. API & Edge Functions
bilan/:opId · bilan-lines · **recompute-bilan (edge)** · **snapshot-bilan (edge)** · **validate-final (edge)**.
### 8. Validations & cas limites
montants ≥ 0 ; poste ∈ liste ; TRI non convergent/sans retournement → « n/a » ; devise étrangère convertie au taux figé ; snapshot non modifiable ; définitif hors clôture refusé.
### 9. i18n & Télémétrie
`bilan.recomputed`, `bilan.snapshot_created`, `bilan.alert_margin_negative`, `bilan.alert_budget_overrun`, `bilan.finalized`.
### 10. Critères d'acceptation
```gherkin
Scénario: TRI sans retournement de signe
  Étant donné une suite de flux tous négatifs
  Quand le TRI est calculé
  Alors TRI = « n/a » (motif : pas de retournement)
Scénario: Immutabilité d'un arrêté
  Étant donné un bilan arrêté
  Quand on tente de le modifier
  Alors l'opération est refusée
```
### 11. Définition de fini
Calculs Money.ts testés (TRI, dénominateur nul) · recalcul < 1 s · RLS · snapshots scellés · responsive + a11y · Gherkin verts.
---
# M5 — Financement & déblocages  ·  *V1*
**Alimente :** bilan M4 (frais financiers, trésorerie). **Lien :** Atlas Finance.
### 1. Objectif & périmètre
- **Objectif.** Gérer les sources de financement (crédit promoteur, bailleurs, fonds propres), les **tranches de déblocage conditionnées à l'avancement**, et les **intérêts intercalaires**.
- **Hors périmètre.** L'écriture comptable (Atlas Finance) ; les recettes (M6).
### 2. Rôles & permissions
| Action | finance | moa_director | amo | viewer |
|---|---|---|---|---|
| Sources & tranches : gérer | U | U | — | R |
| Demander un déblocage | U | U | U | — |
| Valider un déblocage | V | V | — | — |
### 3. Dictionnaire de données
- **financing** : source (credit_promoteur\|bailleur\|fonds_propres), amount, rate, tranches(jsonb).
- **drawdowns** : financing_id, amount, condition (avancement %), status (planifié\|demandé\|débloqué\|refusé), date.
### 4. Machine à états (financing)
négocié → accordé → en_cours → soldé. **Drawdown** : planifié → demandé → débloqué | refusé.
### 5. Calculs & règles
```
intérêts_intercalaires = capital_décaissé × taux × durée(jours)/360
```
- **RG-M5-01** — Un déblocage exige l'avancement validé (M13) atteignant la condition de la tranche.
- **RG-M5-02** — Les intérêts intercalaires alimentent le poste « frais_financiers » du bilan (M4).
- **RG-M5-03** — Les déblocages alimentent les encaissements du plan de trésorerie (M4).
- **RG-M5-04** — Un covenant non respecté déclenche une alerte.
### 6. Écrans
- **Plan de financement** (sources, mix, ratio fonds propres/dette).
- **Tranches & déblocages** (conditions, statut, échéancier).
- **Coût du financement** (intérêts cumulés, projection).
### 7. API & Edge Functions
financing · drawdowns · **request-drawdown (edge)** (vérifie l'avancement M13) · **interest-recompute (edge)**.
### 8. Validations & cas limites
amount ≥ 0 ; déblocage sans avancement suffisant refusé ; taux ≥ 0 ; somme tranches ≤ montant accordé.
### 9. i18n & Télémétrie
`fin.drawdown_requested`, `fin.drawdown_released`, `fin.covenant_breached`, `fin.interest_recomputed`.
### 10. Critères d'acceptation
```gherkin
Scénario: Déblocage conditionné à l'avancement
  Étant donné une tranche conditionnée à 30 % d'avancement validé
  Quand l'avancement validé est de 25 %
  Alors la demande de déblocage est refusée (RG-M5-01)
```
### 11. Définition de fini
Intérêts intercalaires testés (Money.ts) · conditions de déblocage vérifiées vs M13 · alimentation M4 · responsive + a11y · Gherkin verts.
---
# M6 — Commercialisation & recettes (VEFA / baux)  ·  *V1*
**Alimente :** recettes & trésorerie M4. **Lien :** Atlas Lease (gestion locative aval), CinetPay (Mobile Money).
### 1. Objectif & périmètre
- **Objectif.** Commercialiser les lots/unités : inventaire, réservations & ventes **VEFA** (vente en l'état futur d'achèvement) avec **appels de fonds réglementaires par stade**, ou **baux** commerciaux ; suivi des encaissements.
- **Hors périmètre.** La gestion locative en exploitation (Atlas Lease) ; l'écriture comptable (Atlas Finance).
### 2. Rôles & permissions
| Action | commercial | moa_director | finance | viewer |
|---|---|---|---|---|
| Inventaire & prix : gérer | U | U | — | R |
| Réservation / vente / bail : saisir | U | U | — | R |
| Encaissement : constater | U | — | U | R |
### 3. Dictionnaire de données
- **units** : lot_id, typology, area, price, status (disponible\|optionné\|réservé\|vendu\|loué).
- **sales** : kind (reservation\|lease), unit_id, counterpart, amount, schedule(jsonb appels de fonds / loyers), status.
- **receipts** : sale_id, amount, method (mobile_money\|virement), status (pending\|settled), reference.
### 4. Machine à états
**Unit** : disponible → optionné → réservé → vendu | loué.
**Sale** : draft → active → soldée | résiliée.
### 5. Calculs & règles
```
appel_de_fonds[stade] = prix_vente × pourcentage_réglementaire[stade]   # VEFA, plafonds par stade d'avancement
```
- **RG-M6-01** — L'échéancier VEFA respecte les pourcentages réglementaires maximaux par stade d'avancement.
- **RG-M6-02** — Les encaissements alimentent les recettes & la trésorerie du bilan (M4).
- **RG-M6-03** — Une unité ne peut être « vendu » sans réservation préalable soldée des conditions.
- **RG-M6-04** — Le déclenchement d'un appel de fonds est conditionné à l'avancement validé (M13).
- **RG-M6-05** — Les frais de commercialisation alimentent le poste « commercialisation » (M4).
### 6. Écrans
- **Plan de commercialisation** (grille des unités, statut, prix, taux d'écoulement).
- **Fiche unité / contrat** (acquéreur/preneur, échéancier, encaissements).
- **Échéancier d'appels de fonds** (par stade, relances).
### 7. API & Edge Functions
units · sales · receipts · **trigger-call-for-funds (edge)** (vérifie l'avancement M13) · **revenue-sync (edge)** → M4.
### 8. Validations & cas limites
prix ≥ 0 ; % VEFA ≤ plafond réglementaire ; vente sans réservation refusée ; appel de fonds prématuré (avancement insuffisant) refusé.
### 9. i18n & Télémétrie
`com.unit_reserved`, `com.unit_sold`, `com.call_for_funds_issued`, `com.receipt_settled`.
### 10. Critères d'acceptation
```gherkin
Scénario: Appel de fonds plafonné par stade
  Étant donné un stade VEFA dont le plafond réglementaire est 35 %
  Quand on émet un appel de fonds de 40 %
  Alors l'opération est refusée (RG-M6-01)
```
### 11. Définition de fini
Échéanciers VEFA conformes · encaissements → M4 · appels conditionnés à M13 · responsive + a11y · Gherkin verts.
---
# M7 — Parties prenantes & contrats  ·  *MVP*
**Alimente :** honoraires → bilan M4 ; DO → garde M1.
### 1. Objectif & périmètre
- **Objectif.** Annuaire des intervenants, contrats (missions/honoraires), **assurances obligatoires** & attestations, livrables, **registre des décisions** et matrice **RACI**.
- **Hors périmètre.** Marchés de travaux (M8) ; paiement des honoraires (M15).
### 2. Rôles & permissions
| Action | moa_director | amo | procurement | finance | viewer |
|---|---|---|---|---|---|
| Annuaire & contrats : gérer | U | U | U | — | R |
| Assurances : suivre | U | U | — | R | R |
| Registre : acter une décision | V | U | — | — | R |
| RACI : configurer | U | U | — | — | R |
### 3. Dictionnaire de données
- **stakeholders** : type (moe\|amo\|bet\|ct\|csps\|geometre\|notaire\|banque\|assureur\|entreprise\|concessionnaire\|exploitant\|admin), name, contact(jsonb), status.
- **stakeholder_contracts** : mission, fee_amount, fee_schedule(jsonb), status (draft\|active\|closed).
- **insurances** : type (DO\|decennale\|RC\|TRC), insurer, valid_from/valid_to, attestation_ref, status (valid\|expiring\|expired\|missing).
- **deliverables** : contract_id, label, due_date, status (pending\|submitted\|accepted\|late).
- **decisions** (append-only) : kind (decision\|courrier\|OS\|CR_reunion), reference, date, decided_by.
- **raci_assignments** : activity, stakeholder_id, raci (R\|A\|C\|I).
### 4. Machines à états
**Assurance** : valid (>30 j) / expiring (≤30 j) / expired / missing. **Livrable** : pending → submitted → accepted ; → late si échéance dépassée.
### 5. Règles de gestion
- **RG-M7-02** — Assurances obligatoires selon type : entreprise → décennale+RC ; MOE → RC pro ; opération → DO+TRC.
- **RG-M7-03** — Attestation entreprise manquante/expirée → alerte + blocage d'intervention.
- **RG-M7-04** — DO « valid » requise avant ouverture chantier (garde M1, phase réalisation).
- **RG-M7-07** — RACI : exactement un « A » par activité.
- **RG-M7-08** — Registre append-only ; une décision actée n'est pas modifiable.
- **RG-M7-09** — Σ honoraires des contrats actifs → poste « études_honoraires » (M4).
### 6. Écrans
- **Annuaire** (typé, pastille assurance).
- **Fiche intervenant & contrat** (mission, honoraires, livrables, assurances).
- **Tableau des assurances** (échéances, statuts, relances).
- **Registre & RACI** (journal append-only ; matrice activités × intervenants).
### 7. API & Edge Functions
stakeholders · stakeholder-contracts · insurances · deliverables · decisions · **insurance-check (edge)** (DO gate M1) · **honoraires-sync (edge)** → M4.
### 8. Validations & cas limites
type ∈ énum ; fee ≥ 0 ; DO manquante → garde M1 refusée ; 2 « A » RACI refusé ; décision actée non modifiable ; livrable sans échéance refusé.
### 9. i18n & Télémétrie
`stk.insurance_expiring`, `stk.insurance_missing`, `stk.deliverable_late`, `stk.decision_recorded`.
### 10. Critères d'acceptation
```gherkin
Scénario: DO requise avant chantier
  Étant donné une opération sans police DO « valid »
  Quand on demande la transition vers « réalisation »
  Alors insurance-check renvoie la DO comme condition bloquante (RG-M7-04)
```
### 11. Définition de fini
RG-M7-01..10 testées · statuts assurance calculés · RACI unique A · registre append-only · honoraires → M4 · responsive + a11y · Gherkin verts.
---
# M8 — Passation des marchés (privé / public enfichable)  ·  *V1 (privé) / V2 (public)*
**Appelle :** M23 (analyse des offres). **Alimente :** contrats (marchés), bilan M4.
### 1. Objectif & périmètre
- **Objectif.** Conduire la passation des marchés de travaux et services : DAO/DCE, publication, réception des plis, attribution, notification — avec un **régime enfichable** (privé souple ; public réglementé : seuils, ANO, organe de contrôle).
- **Hors périmètre.** L'**évaluation des offres** elle-même (M23, appelée) ; l'exécution (M13) ; le paiement (M15).
### 2. Rôles & permissions
| Action | procurement | moa_director | amo | viewer |
|---|---|---|---|---|
| Créer/publier une consultation | U | U | U | R |
| Lancer l'évaluation (M23) | U | U | U | — |
| Attribuer | — | V | — | — |
| Notifier | U | U | — | — |
### 3. Dictionnaire de données
- **tenders** : mode (private\|public), procedure (AOO\|AOR\|consultation\|gre_a_gre), object, threshold_ok, ano_required, status (planned\|published\|opened\|evaluated\|awarded\|notified), awarded_to (stakeholder).
- **contracts** (marché travaux) : tender_id, lot_id, reference, contractor, amount, status.
- **bpu_items** : contract_id, code, label, unit, unit_price.
### 4. Machine à états (tender.status)
planned → published → opened → evaluated (via M23) → awarded → notified.
### 5. Règles de gestion
- **RG-M8-01** — Le régime (privé/public) est déterminé par `operation.procurement_mode` et la config pays.
- **RG-M8-02** — En public : procédure et délais imposés par les seuils ; **ANO** du bailleur requis si `ano_required`.
- **RG-M8-03** — L'attribution s'appuie sur le rapport d'analyse (M23) ; en public, le PV est scellé.
- **RG-M8-04** — La notification crée le marché (`contracts`) et alimente l'engagé du bilan (M4).
- **RG-M8-05** — Tout franchissement d'étape en public est journalisé (audit) et horodaté.
- **RG-M8-06** — Un marché peut porter une **formule de révision de prix** par indices (`price_revisions`, indices de `country_config`) ; le montant révisé est recalculé par période et propagé au bilan (M4). Fréquent en marché public.
### 6. Écrans
- **Plan de passation** (consultations, calendrier, seuils).
- **Dossier de consultation** (DAO/DCE, publication, registre des plis).
- **Attribution** (résultat M23, décision, notification).
### 7. API & Edge Functions
tenders · contracts · bpu-items · **publish-tender (edge)** · **award (edge)** (lit le rapport M23) · **notify (edge)** → crée contract + M4.
### 8. Validations & cas limites
procédure ∈ énum/régime ; ANO manquant en public → blocage attribution ; attribution sans rapport M23 refusée ; montant marché ≥ 0.
### 9. i18n & Télémétrie
`tender.published`, `tender.evaluated`, `tender.awarded`, `tender.notified`.
### 10. Critères d'acceptation
```gherkin
Scénario: ANO requis en public
  Étant donné une consultation publique avec ano_required = true sans ANO obtenu
  Quand on tente d'attribuer
  Alors l'attribution est bloquée (RG-M8-02)
```
### 11. Définition de fini
Régime enfichable testé (privé/public) · appel M23 fonctionnel · notification → contract + M4 · audit public scellé · responsive + a11y · Gherkin verts.
---
# M9 — Achats, approvisionnements & logistique  ·  *V1*
**Appelle :** M23 (analyse des devis fournisseurs). **Alimente :** planning M12 (ETA), bilan M4 (engagé/réalisé).
### 1. Objectif & périmètre
- **Objectif.** Gérer les achats scopés à l'opération : fournisseurs, commandes, **approvisionnements & logistique**, import / dédouanement, suivi des **ETA** de livraison.
- **Hors périmètre.** L'évaluation des devis (M23) ; un éventuel logiciel d'achats généraliste (intégration possible).
### 2. Rôles & permissions
| Action | procurement | moa_director | site | finance | viewer |
|---|---|---|---|---|---|
| Fournisseurs & commandes : gérer | U | U | — | — | R |
| Réception logistique : constater | U | — | U | — | R |
| Coûts / engagés : lire | R | R | — | R | R |
### 3. Dictionnaire de données
- **suppliers** : name, category, contact(jsonb), status.
- **purchase_orders** : supplier_id, reference, amount, status (draft\|ordered\|shipped\|received), eta.
- **shipments** : po_id, incoterm, customs_status (en_attente\|dédouané), eta, received_at.
### 4. Machine à états (purchase_orders.status)
draft → ordered → shipped → received.
### 5. Règles de gestion
- **RG-M9-01** — Une commande au-delà d'un seuil exige une analyse comparative des devis (M23).
- **RG-M9-02** — L'ETA de livraison alimente le planning (M12) ; un glissement d'ETA sur un appro critique déclenche une alerte.
- **RG-M9-03** — Le montant commandé alimente l'engagé du bilan (M4) ; la réception alimente le réalisé.
- **RG-M9-04** — Le statut douane « en_attente » sur un appro critique est signalé.
- **RG-M9-05** — Les achats en devise étrangère (imports) sont convertis au **taux figé** (F2) à la commande ; l'écart de change à la réception est isolé et signalé (gain/perte de change), jamais fondu dans le coût.
### 6. Écrans
- **Commandes** (statut, ETA, fournisseur).
- **Logistique & douane** (suivi des expéditions, incoterms, dédouanement).
- **Approvisionnements critiques** (vue planning-orientée, alertes ETA).
### 7. API & Edge Functions
suppliers · purchase-orders · shipments · **eta-sync (edge)** → M12 · **commitment-sync (edge)** → M4.
### 8. Validations & cas limites
amount ≥ 0 ; commande > seuil sans M23 refusée ; ETA passée non reçue → alerte ; réception > commande → écart signalé.
### 9. i18n & Télémétrie
`po.ordered`, `po.shipped`, `po.received`, `ship.eta_slipped`, `ship.customs_pending`.
### 10. Critères d'acceptation
```gherkin
Scénario: Glissement d'ETA sur appro critique
  Étant donné une commande critique dont l'ETA recule de 15 jours
  Quand l'ETA est mise à jour
  Alors le planning M12 est impacté et une alerte est émise (RG-M9-02)
```
### 11. Définition de fini
ETA → M12 · engagé/réalisé → M4 · seuil M23 vérifié · responsive + a11y · Gherkin verts.
---
# M10 — Conception & GED  ·  *V1*
**Alimente :** écart programme (M1), visa des plans (M13). **Lien :** Atlas BIM (jumeau), ADVIST (signature).
### 1. Objectif & périmètre
- **Objectif.** Gérer la conception documentaire : **GED** (gestion électronique de documents) versionnée, plans, notes, indices, **visa & diffusion**, et le rattachement aux exigences du programme.
- **Hors périmètre.** La modélisation BIM détaillée (Atlas BIM) ; les RFI (M11).
### 2. Rôles & permissions
| Action | moa_director | amo | site | stakeholder | viewer |
|---|---|---|---|---|---|
| Déposer / indexer un document | U | U | — | U | R |
| Viser / diffuser | U | U | — | — | R |
| Consulter | R | R | R | R | R |
### 3. Dictionnaire de données
- **documents** : code, title, discipline (archi\|structure\|fluides\|vrd\|autre), program_item_id (nullable), current_version.
- **document_versions** : document_id, indice, file_ref, status (draft\|issued\|approved\|superseded), issued_by, issued_at.
- **doc_distribution** : version_id, recipient_stakeholder_id, sent_at, acknowledged_at.
### 4. Machine à états (document_versions.status)
draft → issued → approved → superseded (nouvel indice).
### 5. Règles de gestion
- **RG-M10-01** — Chaque document a un code unique et un indice incrémental ; la diffusion d'un nouvel indice marque l'ancien « superseded ».
- **RG-M10-02** — Le visa d'un document suit un workflow (émis → approuvé) tracé.
- **RG-M10-03** — Un item de programme (M1) sans document de conception associé est signalé « non couvert ».
- **RG-M10-04** — La diffusion enregistre destinataires et accusés de réception.
- **RG-M10-05** — Les documents contractuels peuvent être signés via ADVIST (RFC 3161).
### 6. Écrans
- **Arborescence GED** (par discipline, recherche, filtres).
- **Fiche document** (indices, visa, diffusion, accusés).
- **Couverture du programme** (matrice exigence ↔ document).
### 7. API & Edge Functions
documents · document-versions · doc-distribution · **issue-version (edge)** (gère le superseded) · **distribute (edge)**.
### 8. Validations & cas limites
code unique ; indice croissant ; diffusion sans destinataire refusée ; document approuvé non modifiable (nouvel indice requis).
### 9. i18n & Télémétrie
`doc.version_issued`, `doc.approved`, `doc.distributed`, `doc.program_gap`.
### 10. Critères d'acceptation
```gherkin
Scénario: Nouvel indice rend l'ancien obsolète
  Étant donné un document à l'indice B « approved »
  Quand l'indice C est diffusé
  Alors B passe « superseded » (RG-M10-01)
```
### 11. Définition de fini
Versionnage & visa tracés · couverture programme calculée · diffusion + accusés · responsive + a11y · Gherkin verts.
---
# M11 — RFI & collaboration externe  ·  *V1*
**Alimente :** registre des décisions (M7), conception (M10). **Lien :** CockpitCR.
### 1. Objectif & périmètre
- **Objectif.** Gérer les **RFI** (demandes d'information / questions-réponses techniques) et la collaboration avec les intervenants externes via un portail dédié, avec délais et escalade.
- **Hors périmètre.** La GED (M10) ; les modifications contractuelles (M14).
### 2. Rôles & permissions
| Action | moa_director | amo | stakeholder | site | viewer |
|---|---|---|---|---|---|
| Ouvrir une RFI | U | U | U | U | R |
| Répondre | U | U | U | — | R |
| Clôturer | U | U | — | — | R |
### 3. Dictionnaire de données
- **rfis** : reference, question, raised_by, assigned_to, due_date, priority (low\|medium\|high), status (open\|answered\|closed), answer, answered_at.
- **rfi_threads** : rfi_id, author_id, message, created_at.
### 4. Machine à états (rfis.status)
open → answered → closed ; → escalated si due_date dépassée sans réponse.
### 5. Règles de gestion
- **RG-M11-01** — Chaque RFI a un destinataire et une échéance ; le dépassement déclenche une escalade et une alerte.
- **RG-M11-02** — Une RFI dont la réponse emporte une décision alimente le registre (M7).
- **RG-M11-03** — Une RFI impactant un document déclenche un lien vers la GED (M10).
- **RG-M11-04** — Le fil de discussion est horodaté et conservé (traçabilité).
### 6. Écrans
- **Liste des RFI** (statut, priorité, échéance, retard).
- **Fiche RFI** (question, fil, réponse, pièces, décision).
- **Portail externe** (accès restreint stakeholder).
### 7. API & Edge Functions
rfis · rfi-threads · **answer-rfi (edge)** · **escalate-rfi (edge, pg_cron)**.
### 8. Validations & cas limites
due_date requise ; réponse vide refusée ; clôture sans réponse refusée ; accès portail borné au périmètre du stakeholder.
### 9. i18n & Télémétrie
`rfi.opened`, `rfi.answered`, `rfi.escalated`, `rfi.closed`.
### 10. Critères d'acceptation
```gherkin
Scénario: Escalade d'une RFI en retard
  Étant donné une RFI « open » dont l'échéance est dépassée
  Quand le contrôle pg_cron s'exécute
  Alors la RFI passe « escalated » et une alerte est émise (RG-M11-01)
```
### 11. Définition de fini
Délais & escalade automatiques · décisions → M7 · liens GED M10 · portail externe RLS · responsive + a11y · Gherkin verts.
---
# M12 — Planning & chemin critique  ·  *MVP*
**Alimente :** trésorerie M4, alertes M21. **Reçoit de :** M9 (ETA), M13 (OS arrêt/reprise), M14 (avenants délai).
### 1. Objectif & périmètre
- **Objectif.** Planifier toutes les phases, calculer le **chemin critique (CPM)** et les marges, comparer **baseline vs réalisé**, et **simuler l'impact** d'un retard. Calendrier ouvré intégrant les jours fériés du pays.
- **Hors périmètre.** Saisie terrain de l'avancement (M13) ; mandatement (M15).
### 2. Rôles & permissions
| Action | moa_director | amo | site | viewer |
|---|---|---|---|---|
| Tâches & dépendances : éditer | U | U | — | R |
| Avancement : saisir | U | U | U | R |
| Baseline : figer | B | B | — | — |
| Simulation : lancer | S | S | — | — |
### 3. Dictionnaire de données
- **tasks** : wbs_code, name, start_date, duration_days (0 = jalon), end_date(calculé), is_milestone, progress, is_critical(calculé).
- **dependencies** : predecessor_id, successor_id, type (FS\|SS\|FF\|SF), lag_days (peut être négatif).
- **baselines** : label, snapshot(jsonb immuable), is_active.
### 4. Calcul CPM (`Money.ts`-free, dates ouvrées)
```
ES = max(EF(préd.)+lag) ; EF = ouvré_ajouter(ES, durée)
LF = min(LS(succ.)-lag) ; LS = ouvré_soustraire(LF, durée)
marge_totale = LS - ES ; critique = marge_totale ≤ 0
date_fin_opération = max(EF)   ; ouvré_* saute week-ends + public_holidays(pays)
```
### 5. Règles de gestion
- **RG-M12-01** — CPM recalculé à chaque modif de tâche/dépendance.
- **RG-M12-03** — Durées/décalages en jours ouvrés (week-ends + fériés exclus).
- **RG-M12-04** — Dépendance créant un cycle refusée.
- **RG-M12-06** — Baseline immuable ; dérive = écart jours réalisé vs baseline active.
- **RG-M12-07** — Dérive sur tâche critique → modifie date_fin + alerte (M4 tréso, M21).
- **RG-M12-08** — Simulation en bac à sable (sans persistance) jusqu'à confirmation.
- **RG-M12-09** — Suppression d'une tâche avec successeurs bloquée (réacheminer d'abord).
### 6. Écrans
- **Gantt** (barres, dépendances, chemin critique ambre, jalons, baseline fantôme ; < 768 → liste priorisée).
- **Simulateur d'impact** (décalage ±N j → nouvelle date livraison + impact tréso).
- **Jalons & comparaison baseline** (dérive en jours).
### 7. API & Edge Functions
tasks · dependencies (détection de cycle) · **recompute-cpm (edge)** · **simulate-impact (edge)** · baselines.
### 8. Validations & cas limites
durée ≥ 0 ; cycle refusé ; jalon = durée 0 ; suppression avec successeurs 409 ; date sur férié décalée au prochain jour ouvré.
### 9. i18n & Télémétrie
`plan.cpm_recomputed`, `plan.milestone_late`, `plan.simulation_applied`, `plan.baseline_set`.
### 10. Critères d'acceptation
```gherkin
Scénario: Cycle de dépendances refusé
  Étant donné des tâches A→B→C
  Quand on ajoute une dépendance C→A
  Alors l'ajout est refusé (RG-M12-04)
```
### 11. Définition de fini
CPM + calendrier ouvré testés · détection de cycle · baseline immuable · simulation sans effet de bord · propagation M4/M21 · responsive + a11y · Gherkin verts.
---
# M13 — Pilotage de réalisation (supervision)  ·  *MVP*
**Débloque :** mandatement M15. **Agit sur :** planning M12 (OS). **Alimente :** registre M7.
### 1. Objectif & périmètre
- **Objectif.** Superviser sans exécuter : suivre l'avancement, **valider les situations** (visa MOE → validation MOA), instruire les **ordres de service**, tenir les réunions de chantier, recevoir les alertes de dérive.
- **Hors périmètre.** Mandatement/écriture (M15) ; calcul planning (M12).
### 2. Rôles & permissions
| Action | moa_director | amo | site | finance | viewer |
|---|---|---|---|---|---|
| Situation : viser (MOE/AMO) | — | U | — | — | R |
| Situation : valider (MOA) | V | — | — | — | R |
| Ordre de service : émettre | U | U | — | — | R |
| CR & points en suspens | U | U | U | — | R |
### 3. Dictionnaire de données
- **progress_reports** : lot_id, period, physical_progress, source (terrain\|moe), comment.
- **decompte_validations** : decompte_id (M15), step (visa_moe\|validation_moa), status (pending\|approved\|returned), actor_id, comment.
- **service_orders** : contract_id, type (demarrage\|arret\|reprise\|notification), reference, content, status (draft\|issued\|acknowledged).
- **site_meetings** : date, attendees(jsonb), minutes ; **action_items** : description, owner_id, due_date, status.
### 4. Machines à états
**Situation** : brouillon → visa_moe → validation_moa → mandatable (M15) ; → renvoyée (motif). **OS** : draft → issued → acknowledged.
### 5. Règles de gestion
- **RG-M13-01** — Le MOA valide/refuse/renvoie ; il ne saisit pas l'avancement à la place de l'entreprise.
- **RG-M13-02** — Validation MOA seulement après visa MOE « approved » (double visa).
- **RG-M13-03** — Décompte mandatable (M15) seulement après validation MOA.
- **RG-M13-05** — OS « arret » suspend les tâches M12 ; « reprise » les réactive.
- **RG-M13-06** — Écart physique/financier > seuil → alerte (surfacturation potentielle).
- **RG-M13-08** — Décisions de CR → registre (M7) ; CR horodaté et diffusé.
### 6. Écrans
- **Cockpit de réalisation** (physique vs financier vs planning, courbe en S, alertes).
- **File de validation des situations** (à viser / à valider ; renvoi avec motif).
- **Ordres de service** ; **Réunions & points en suspens**.
### 7. API & Edge Functions
progress-reports · **validate-situation (edge)** (ordonne visa→validation, débloque M15) · **service-orders (edge)** (arrêt/reprise → M12) · site-meetings · action-items.
### 8. Validations & cas limites
validation MOA sans visa MOE refusée ; renvoi sans motif refusé ; OS arrêt sur tâche finie refusé ; progress ∈ [0,1] ; situation mandatée verrouillée.
### 9. i18n & Télémétrie
`exec.situation_validated`, `exec.service_order_issued`, `exec.progress_gap_alert`, `exec.meeting_recorded`.
### 10. Critères d'acceptation
```gherkin
Scénario: Double visa obligatoire
  Étant donné une situation sans visa MOE
  Quand le MOA tente de la valider
  Alors l'action est refusée et la situation n'est pas mandatable (RG-M13-02)
```
### 11. Définition de fini
Workflow visa→validation testé · OS → M12 · alerte écart · décisions → M7 · responsive + a11y · audit · Gherkin verts.
---
# M14 — Maîtrise des modifications (change control)  ·  *MVP*
**Propage vers :** marché M8, bilan M4, planning M12.
### 1. Objectif & périmètre
- **Objectif.** Circuit formel des changements : demande → **analyse d'impact** (coût/délai/qualité) → **arbitrage à seuils** → conversion en **avenant**. Anti-dérive silencieuse.
- **Hors périmètre.** Exécution (M13) ; mandatement (M15).
### 2. Rôles & permissions
| Action | moa_director | amo | finance | viewer |
|---|---|---|---|---|
| Créer une demande | U | U | U | R |
| Instruire l'impact | U | U | U | R |
| Arbitrer / approuver | A | — | — | — |
| Convertir en avenant | C | U | — | R |
### 3. Dictionnaire de données
- **change_orders** : contract_id, origin (moa\|moe\|entreprise\|reglementaire\|aleas), description, impact_cost (±), impact_days (±), impact_quality, status, avenant_ref, decided_by.
- **change_approval_rules** : threshold_amount, required_role.
### 4. Machine à états (change_orders.status)
requested → under_review → arbitrated → approved | rejected ; approved → converted.
### 5. Règles de gestion
- **RG-M14-01** — Aucune modif coût/délai d'un marché sans change order approuvé puis converti.
- **RG-M14-02** — Analyse d'impact obligatoire avant arbitrage.
- **RG-M14-03** — Niveau d'approbation = fonction de |impact| vs seuils (moa_director ↔ comité/owner).
- **RG-M14-05** — Conversion : crée l'avenant (M8), ajuste montant (M4), décale planning si impact_days ≠ 0 (M12).
- **RG-M14-06** — Cumul des avenants par marché suivi ; > % du marché initial → alerte (plafond public).
### 6. Écrans
- **Registre des modifications** (impact cumulé coût/délai).
- **Fiche modification** (analyse d'impact, circuit, conversion).
- **Gouvernance des avenants** (montant initial, cumul, % , plafond).
### 7. API & Edge Functions
change-orders · submit-impact · **arbitrate (edge)** (routage par seuil) · **convert-to-avenant (edge)** (propage M8/M4/M12).
### 8. Validations & cas limites
arbitrage sans impact refusé ; rôle insuffisant refusé ; conversion d'un CO non approuvé refusée ; refus sans motif refusé ; cumul > plafond signalé.
### 9. i18n & Télémétrie
`chg.created`, `chg.arbitrated`, `chg.converted`, `chg.cap_exceeded`.
### 10. Critères d'acceptation
```gherkin
Scénario: Conversion propage au bilan et au planning
  Étant donné un change order approuvé (+20 000 000 FCFA, +12 j)
  Quand il est converti en avenant
  Alors le marché augmente de 20 000 000 (M4) et le planning recule de 12 j ouvrés (M12)
```
### 11. Définition de fini
Circuit complet + routage par seuil testés · propagation M8/M4/M12 · cumul + plafond · audit · responsive + a11y · Gherkin verts.
---
# M15 — Chaîne de paiement & engagements  ·  *MVP*
**Reçoit de :** M13 (situation validée). **Vers :** M16 (retenue), M4 (réalisé). **Lien :** CinetPay (Mobile Money), Atlas Finance.
### 1. Objectif & périmètre
- **Objectif.** Transformer une situation validée (M13) en paiement : **mandatement**, calcul du net (**retenue de garantie**, **remboursement d'avance**, **pénalités**), exécution (**Mobile Money / virement**), suivi des engagements.
- **Hors périmètre.** La validation de la situation (M13) ; l'écriture comptable (Atlas Finance, alimentée).
### 2. Rôles & permissions
| Action | finance | moa_director | amo | viewer |
|---|---|---|---|---|
| Mandater une situation validée | U | V | — | R |
| Exécuter le paiement | U | — | — | R |
| Consulter engagements | R | R | R | R |
### 3. Dictionnaire de données
- **decomptes** : contract_id, number, amount_gross, retention, amount_net, status (draft\|validated\|mandated).
- **payments** : decompte_id, method (mobile_money\|virement), amount, status (pending\|settled\|failed), reference.
- **engagements** : contract_id, amount_engaged, amount_paid, balance (calculé).
### 4. Machine à états (decompte.status)
validated (M13) → mandated → payé (payment.settled).
### 5. Calculs (`Money.ts`) & règles
```
base_ht          = amount_gross
tva              = base_ht × vat_rate(pays)                     # F6
retenue_source   = base × wht_rules(pays, nature)              # F6 précompte/IRVM
retenue_garantie = base_ht × operation.retention_rate
pénalité_retard  = montant_marché × taux × jours_retard         # plafonné
net_à_payer = base_ht + tva − retenue_source − retenue_garantie − avance_remboursée − pénalités
```
- **RG-M15-00** — TVA et retenues à la source sont calculées via F6 (`country_config`) et matérialisées en `tax_lines` ; jamais codées en dur.
- **RG-M15-01** — Mandatement seulement si situation « validation_moa = approved » (M13).
- **RG-M15-02** — La retenue de garantie est provisionnée et libérée à la GPA (M18 / M16).
- **RG-M15-03** — L'avance versée est remboursée progressivement selon l'échéancier du marché.
- **RG-M15-04** — Les pénalités de retard sont plafonnées (config marché) et déduites du net.
- **RG-M15-05** — Le paiement réalisé alimente le « réalisé » du bilan (M4) et les engagements.
- **RG-M15-06** — Mobile Money via CinetPay ; échec de paiement → statut « failed » + relance, jamais de double paiement (idempotence).
### 6. Écrans
- **File de mandatement** (situations validées prêtes à mandater).
- **Décompte** (brut, retenue, avance, pénalités, net).
- **Paiements** (méthode, statut, références) ; **Engagements** (engagé/payé/solde par marché).
### 7. API & Edge Functions
decomptes · **mandate (edge)** (vérifie M13) · **execute-payment (edge)** (CinetPay, idempotent) · engagements.
### 8. Validations & cas limites
mandatement sans validation M13 refusé ; net < 0 impossible (plafonnement) ; double exécution bloquée (idempotence) ; échec paiement → failed + relance ; devise = devise opération.
### 9. i18n & Télémétrie
`pay.mandated`, `pay.executed`, `pay.failed`, `pay.retention_held`, `pay.penalty_applied`.
### 10. Critères d'acceptation
```gherkin
Scénario: Mandatement conditionné à la validation MOA
  Étant donné un décompte non validé par le MOA (M13)
  Quand on tente de le mandater
  Alors l'action est refusée (RG-M15-01)
Scénario: Idempotence du paiement
  Étant donné un décompte déjà payé
  Quand l'exécution est rejouée
  Alors aucun second paiement n'est émis
```
### 11. Définition de fini
Net (retenue/avance/pénalités) testé en Money.ts · mandatement gardé par M13 · paiement idempotent · réalisé → M4 · retenue → M16/M18 · responsive + a11y · Gherkin verts.
---
# M16 — Cautions & garanties  ·  *V1*
**Reçoit de :** M15 (retenue). **Alimente :** réception M18.
### 1. Objectif & périmètre
- **Objectif.** Suivre les cautions et garanties : caution d'avance, de bonne exécution, **retenue de garantie**, avec émission, appel et **mainlevée/restitution**, et alertes d'échéance.
- **Hors périmètre.** Le paiement (M15) ; les assurances (M7).
### 2. Rôles & permissions
| Action | finance | moa_director | amo | viewer |
|---|---|---|---|---|
| Cautions : enregistrer | U | U | U | R |
| Appeler une caution | U | V | — | R |
| Donner mainlevée | U | V | — | R |
### 3. Dictionnaire de données
- **guarantees** : contract_id, kind (avance\|bonne_execution\|retenue_garantie), amount, status (emise\|appelee\|mainlevee), expiry, issuer.
### 4. Machine à états (guarantees.status)
emise → appelee | mainlevee.
### 5. Règles de gestion
- **RG-M16-01** — La retenue de garantie cumulée (M15) est tracée comme garantie « retenue_garantie ».
- **RG-M16-02** — La mainlevée de la retenue est conditionnée à la levée des réserves / GPA (M18).
- **RG-M16-03** — Une caution dont l'expiry approche (≤ 30 j) → alerte ; expirée non mainlevée → alerte danger.
- **RG-M16-04** — L'appel d'une caution exige validation moa_director + motif (journalisé).
### 6. Écrans
- **Registre des cautions** (type, montant, statut, échéance).
- **Fiche caution** (émission, appel, mainlevée, pièces).
### 7. API & Edge Functions
guarantees · **call-guarantee (edge)** · **release-guarantee (edge)** (vérifie M18).
### 8. Validations & cas limites
amount ≥ 0 ; mainlevée retenue avant levée réserves refusée ; appel sans motif refusé ; expiry < aujourd'hui → alerte.
### 9. i18n & Télémétrie
`grt.issued`, `grt.called`, `grt.released`, `grt.expiring`.
### 10. Critères d'acceptation
```gherkin
Scénario: Mainlevée conditionnée à la GPA
  Étant donné une retenue de garantie et des réserves non levées
  Quand on demande la mainlevée
  Alors elle est refusée jusqu'à la levée des réserves (RG-M16-02)
```
### 11. Définition de fini
Retenue tracée depuis M15 · mainlevée gardée par M18 · alertes d'échéance · audit appels · responsive + a11y · Gherkin verts.
---
# M17 — Concessionnaires & raccordements  ·  *V2*
**Dépend de :** planning M12. **Alimente :** réception M18.
### 1. Objectif & périmètre
- **Objectif.** Gérer les **raccordements** aux concessionnaires (eau, électricité, télécom) : demandes, devis concessionnaire, travaux et **mise en service**, avec leurs délais souvent longs et critiques pour la livraison.
- **Hors périmètre.** Les marchés de travaux internes (M8).
### 2. Rôles & permissions
| Action | moa_director | amo | site | viewer |
|---|---|---|---|---|
| Demande de raccordement : gérer | U | U | — | R |
| Suivi travaux concessionnaire | U | U | U | R |
### 3. Dictionnaire de données
- **utility_connections** : type (eau\|elec\|telecom), provider, status (requested\|quoted\|works\|connected), target_date, cost.
### 4. Machine à états
requested → quoted → works → connected.
### 5. Règles de gestion
- **RG-M17-01** — Chaque raccordement a une date cible reliée au planning (M12) ; un glissement déclenche une alerte.
- **RG-M17-02** — Les raccordements « connected » (eau + élec a minima) sont une condition de réception (garde M18).
- **RG-M17-03** — Les coûts de raccordement alimentent le bilan (M4, poste travaux/VRD).
- **RG-M17-04** — Les délais concessionnaires sont suivis comme risques (M19) en raison de leur criticité.
### 6. Écrans
- **Tableau des raccordements** (type, statut, date cible, retard).
- **Fiche raccordement** (devis, travaux, mise en service).
### 7. API & Edge Functions
utility-connections · **connection-gate (edge)** → garde réception M18.
### 8. Validations & cas limites
type ∈ énum ; date cible reliée au planning ; réception bloquée si eau/élec non « connected » ; coût ≥ 0.
### 9. i18n & Télémétrie
`util.requested`, `util.connected`, `util.eta_slipped`.
### 10. Critères d'acceptation
```gherkin
Scénario: Raccordements requis pour la réception
  Étant donné une opération dont l'électricité n'est pas « connected »
  Quand on demande la réception
  Alors connection-gate la bloque (RG-M17-02)
```
### 11. Définition de fini
Raccordements reliés au planning · garde réception M18 · coûts → M4 · alertes ETA · responsive + a11y · Gherkin verts.
---
# M18 — Qualité, réception & GPA  ·  *V2*
**Reçoit gardes de :** M17 (raccordements), M13 (réserves). **Débloque :** mainlevée M16, phase exploitation M1.
### 1. Objectif & périmètre
- **Objectif.** Conduire la **réception** des ouvrages : pré-réception, **PV de réception** (avec/sans réserves), **levée des réserves**, **GPA** (garantie de parfait achèvement, 1 an) et suivi des garanties biennale/décennale.
- **Hors périmètre.** La supervision courante (M13) ; les litiges (M19).
### 2. Rôles & permissions
| Action | moa_director | amo | site | viewer |
|---|---|---|---|---|
| Organiser la réception | U | U | — | R |
| Prononcer la réception (PV) | V | — | — | R |
| Lever une réserve | U | U | U | R |
### 3. Dictionnaire de données
- **receptions** : lot_id, type (pre_reception\|reception), pv_ref, decision (avec_reserves\|sans_reserves\|refusee), date.
- **reserves** : lot_id, description, status (open\|lifted), lifted_at.
- **gpa** : operation_id, start_date, end_date (start + 1 an), status (en_cours\|clos).
### 4. Machine à états (réception)
pré-réception → réception_avec_réserves → réserves_levées → GPA → fin_GPA.
### 5. Règles de gestion
- **RG-M18-01** — La réception requiert les raccordements essentiels « connected » (garde M17).
- **RG-M18-02** — Un PV de réception « avec réserves » ouvre le suivi des réserves ; toutes levées → « réserves_levées ».
- **RG-M18-03** — La réception prononcée démarre la **GPA** (1 an) et conditionne le passage en phase exploitation (garde M1).
- **RG-M18-04** — La mainlevée de la retenue de garantie (M16) est conditionnée à la levée des réserves / fin GPA.
- **RG-M18-05** — Le PV de réception est scellé (hash) et signable via ADVIST.
### 6. Écrans
- **Réception** (organisation, PV, décision).
- **Registre des réserves** (statut, levée, photos terrain offline).
- **GPA** (échéances, suivi des reprises, fin de GPA).
### 7. API & Edge Functions
receptions · reserves · **pronounce-reception (edge)** (vérifie M17, démarre GPA, garde M1) · **lift-reserve (edge)**.
### 8. Validations & cas limites
réception sans raccordements refusée ; GPA = réception + 1 an ; mainlevée retenue avant levée réserves refusée ; PV non modifiable après scellement.
### 9. i18n & Télémétrie
`qa.reception_pronounced`, `qa.reserve_lifted`, `qa.gpa_started`, `qa.gpa_closed`.
### 10. Critères d'acceptation
```gherkin
Scénario: Réception démarre la GPA et débloque l'exploitation
  Étant donné une réception prononcée sans réserve majeure
  Quand le PV est scellé
  Alors la GPA démarre (1 an) et l'opération peut passer en « exploitation » (RG-M18-03)
```
### 11. Définition de fini
Garde M17 vérifiée · GPA calculée · réserves offline-first · mainlevée M16 gardée · PV scellé/ADVIST · responsive + a11y · Gherkin verts.
---
# M19 — Risques, litiges, assurances & HSSE  ·  *V2*
**Transversal.** Reçoit de M3 (PGES), M7 (assurances), M17 (délais). **Alimente :** cockpit M21.
### 1. Objectif & périmètre
- **Objectif.** Tenir le **registre des risques** (probabilité × impact), gérer les **litiges/contentieux**, les **sinistres** (assurances), et le suivi **HSSE** (incidents, inspections) du chantier.
- **Hors périmètre.** La souscription des assurances (M7) ; les études E&S (M3).
### 2. Rôles & permissions
| Action | moa_director | amo | site | viewer |
|---|---|---|---|---|
| Registre des risques : gérer | U | U | — | R |
| Litiges & sinistres : gérer | U | U | — | R |
| HSSE : déclarer un incident | U | U | U | R |
### 3. Dictionnaire de données
- **risks** : title, probability (1–5), impact (1–5), score(calculé), mitigation, owner_id, status (open\|mitigated\|closed).
- **disputes** : counterpart, object, amount_at_stake, status (ouvert\|en_cours\|résolu), file_ref.
- **claims** : insurance_id (M7), event, amount, status (déclaré\|en_cours\|indemnisé\|rejeté).
- **hsse_incidents** : type, severity, date, description, corrective_action, status.
### 4. Machine à états
**Risque** : open → mitigated → closed. **Litige** : ouvert → en_cours → résolu. **HSSE** : déclaré → traité → clos.
### 5. Règles de gestion
- **RG-M19-01** — `score = probability × impact` ; au-delà d'un seuil → risque « majeur » remonté au cockpit (M21).
- **RG-M19-02** — Tout risque majeur a un plan de mitigation et un responsable.
- **RG-M19-03** — Un incident HSSE « high »/« critical » déclenche une alerte immédiate et une action corrective obligatoire.
- **RG-M19-04** — Un litige avec montant en jeu alimente une provision « aléas » du bilan (M4).
- **RG-M19-05** — Un sinistre relie une assurance (M7) à une indemnisation suivie.
### 6. Écrans
- **Matrice des risques** (heatmap probabilité × impact).
- **Litiges & contentieux** ; **Sinistres** ; **HSSE** (incidents, inspections, taux de fréquence).
### 7. API & Edge Functions
risks · disputes · claims · hsse-incidents · **risk-score (edge)** · **hsse-alert (edge)**.
### 8. Validations & cas limites
probabilité/impact ∈ [1,5] ; risque majeur sans mitigation signalé ; incident critical sans action corrective bloqué ; montant litige ≥ 0.
### 9. i18n & Télémétrie
`risk.major_flagged`, `dispute.opened`, `claim.filed`, `hsse.incident_critical`.
### 10. Critères d'acceptation
```gherkin
Scénario: Incident HSSE critique
  Étant donné un incident HSSE de sévérité « critical »
  Quand il est déclaré
  Alors une alerte immédiate est émise et une action corrective est exigée (RG-M19-03)
```
### 11. Définition de fini
Score risque calculé · risques majeurs → M21 · HSSE alertes · provision litige → M4 · responsive + a11y · Gherkin verts.
---
# M20 — Passation → exploitation (FM + Atlas Lease)  ·  *V2*
**Reçoit de :** M18 (réception), M10 (DOE). **Vers :** Atlas Keystone (FM/HSSE), Atlas Lease. **Garde :** clôture M1.
### 1. Objectif & périmètre
- **Objectif.** Organiser la **bascule en exploitation** : constitution du **DOE** (dossier des ouvrages exécutés), inventaire des **équipements** et plans **as-built**, puis **transfert** vers le Facility Management (Atlas Keystone) et la gestion locative (Atlas Lease).
- **Hors périmètre.** L'exploitation elle-même (Atlas Keystone / Atlas Lease).
### 2. Rôles & permissions
| Action | moa_director | amo | exploitant | viewer |
|---|---|---|---|---|
| Constituer le DOE | U | U | — | R |
| Inventorier les équipements | U | U | U | R |
| Lancer le transfert | V | — | — | R |
### 3. Dictionnaire de données
- **doe_documents** : category (plan_asbuilt\|notice\|garantie\|pv), file_ref, validated.
- **handover_assets** : label, type, location, warranty_end, target_system (keystone\|lease).
- **handover** : operation_id, status (preparation\|transfere), transferred_at.
### 4. Machine à états (handover)
preparation → transfere.
### 5. Règles de gestion
- **RG-M20-01** — Le transfert exige un DOE complet validé et la réception prononcée (M18).
- **RG-M20-02** — Les équipements sont exportés vers Atlas Keystone (FM/HSSE) avec leurs garanties.
- **RG-M20-03** — Les unités locatives sont exportées vers Atlas Lease avec leurs baux (M6).
- **RG-M20-04** — Le transfert effectué conditionne le passage en phase « clôture » (garde M1).
- **RG-M20-05** — Les données transférées restent souveraines (export maîtrisé, traçé).
### 6. Écrans
- **DOE** (complétude par catégorie).
- **Inventaire des équipements** (garanties, système cible).
- **Bascule** (récapitulatif, lancement du transfert).
### 7. API & Edge Functions
doe-documents · handover-assets · **handover (edge)** (vérifie M18 ; exporte vers Keystone & Lease).
### 8. Validations & cas limites
transfert sans DOE complet refusé ; réception non prononcée → blocage ; garanties d'équipement requises.
### 9. i18n & Télémétrie
`ho.doe_completed`, `ho.transferred`, `ho.asset_exported`.
### 10. Critères d'acceptation
```gherkin
Scénario: Transfert conditionné au DOE et à la réception
  Étant donné un DOE incomplet
  Quand on lance le transfert vers l'exploitation
  Alors il est refusé (RG-M20-01)
```
### 11. Définition de fini
DOE complétude · export Keystone/Lease · garde clôture M1 · souveraineté de l'export · responsive + a11y · Gherkin verts.
---
# M21 — Cockpit & reporting  ·  *V1*
**Lit :** tous les modules. **Transversal.**
### 1. Objectif & périmètre
- **Objectif.** Offrir au MOA la vue consolidée de l'opération (ou du portefeuille) : KPI, **alertes consolidées**, courbes (avancement, trésorerie), et **reporting** (hebdo / mensuel / Deep Dive) avec export.
- **Hors périmètre.** La saisie (modules sources) ; l'IA conversationnelle (M22).
### 2. Rôles & permissions
| Action | owner | moa_director | finance | amo | viewer |
|---|---|---|---|---|---|
| Consulter le cockpit | R | R | R | R | R |
| Générer un reporting | U | U | U | U | — |
| Configurer les seuils d'alerte | U | U | — | — | — |
### 3. Dictionnaire de données
- **report_snapshots** : operation_id, type (hebdo\|mensuel\|deep_dive), period, data(jsonb), generated_at.
- **alert_rules** : metric, threshold, severity. (Les alertes sont produites par les modules sources et agrégées.)
### 4. Machine à états
report : draft → generated → published.
### 5. Règles de gestion
- **RG-M21-01** — Le cockpit agrège les indicateurs des modules sans recalculer la donnée financière (lit M4, M12, M19…).
- **RG-M21-02** — Les alertes sont consolidées et priorisées par sévérité (danger > échéance > info).
- **RG-M21-03** — Les snapshots de reporting sont datés et conservés (comparaison période à période).
- **RG-M21-04** — Les exports respectent le périmètre RLS de l'utilisateur.
- **RG-M21-05** — Pour les opérations sur financement bailleur (BM / BAD / BOAD), des **formats de reporting dédiés** (décaissement, passation, sauvegardes E&S) sont générables ; ils différencient Atlas Opus sur le marché du MOA public.
### 6. Écrans
- **Cockpit opération** (KPI, alertes, courbes).
- **Cockpit portefeuille** (multi-opérations, classement par risque).
- **Reporting** (génération hebdo/mensuel/Deep Dive, export PDF/MD).
### 7. API & Edge Functions
report-snapshots · **generate-report (edge)** · alert-rules · aggregations (lecture seule).
### 8. Validations & cas limites
type ∈ énum ; export borné RLS ; pas de recalcul financier (source de vérité = M4).
### 9. i18n & Télémétrie
`report.generated`, `cockpit.alert_consolidated`.
### 10. Critères d'acceptation
```gherkin
Scénario: Priorisation des alertes
  Étant donné des alertes de sévérités mixtes
  Quand le cockpit s'affiche
  Alors elles sont triées danger > échéance > info (RG-M21-02)
```
### 11. Définition de fini
Agrégation sans recalcul · alertes priorisées · snapshots datés · export RLS · responsive + a11y · Gherkin verts.
---
# M22 — Copilote PROPH3T  ·  *V1*
**Transversal.** RAG sur l'opération. Souveraineté : Ollama-first.
### 1. Objectif & périmètre
- **Objectif.** Assistant IA contextuel : répondre sur l'opération (RAG), **générer des documents** (PV, courriers, synthèses), **analyser** (anomalies, écarts), avec **routage par sensibilité**.
- **Hors périmètre.** Tout **calcul monétaire** (réservé à `Money.ts`) ; la décision (assistance uniquement).
### 2. Rôles & permissions
| Action | moa_director | amo | finance | autres |
|---|---|---|---|---|
| Interroger le copilote | U | U | U | selon rôle |
| Générer un document | U | U | U | — |
### 3. Dictionnaire de données
- **rag_chunks** : source_module, source_id, content, embedding (pgvector).
- **ai_runs** : prompt, model (ollama\|claude), sensitivity (low\|medium\|high), no_data_retention(bool), tokens, created_by.
### 4. Machine à états (ai_run)
queued → running → done | failed (circuit-breaker).
### 5. Règles de gestion
- **RG-M22-01** — Routage par sensibilité : données sensibles → Ollama local + `noDataRetention` ; repli Claude (vision) avec consentement uniquement.
- **RG-M22-02** — Le copilote ne calcule jamais un montant : il cite les valeurs de M4, jamais ne les recompute.
- **RG-M22-03** — Toute réponse cite ses sources (chunks RAG) ; pas d'invention de référence.
- **RG-M22-04** — Les documents générés sont des brouillons soumis à validation humaine.
- **RG-M22-05** — Circuit-breaker : en cas d'échec répété d'un fournisseur, bascule/arrêt gracieux.
### 6. Écrans
- **Copilote** (chat contextuel, citations, actions suggérées).
- **Générateur de documents** (modèles PV/courrier/synthèse).
### 7. API & Edge Functions
**ask (edge)** (RAG + routage sensibilité) · **generate-doc (edge)** · embeddings (pgvector).
### 8. Validations & cas limites
sensibilité haute → jamais hors souveraineté ; aucun calcul monétaire (renvoi vers M4) ; pas de source → pas d'affirmation chiffrée ; consentement requis pour repli externe.
### 9. i18n & Télémétrie
`ai.query`, `ai.doc_generated`, `ai.fallback_used`, `ai.circuit_open`.
### 10. Critères d'acceptation
```gherkin
Scénario: Pas de calcul monétaire par l'IA
  Étant donné une question « quelle est la marge ? »
  Quand le copilote répond
  Alors il cite la marge calculée par M4 sans la recalculer (RG-M22-02)
Scénario: Souveraineté des données sensibles
  Étant donné une donnée sensible
  Quand une requête IA est lancée
  Alors elle est traitée par Ollama local avec noDataRetention (RG-M22-01)
```
### 11. Définition de fini
Routage souverain testé · zéro calcul monétaire IA · citations RAG · brouillons validables · circuit-breaker · Gherkin verts.
---
# M23 — Analyse & dépouillement des offres  ·  *V1*
**Appelé par :** M8 (marchés), M9 (devis fournisseurs). **Régime-aware. Assisté PROPH3T.**
### 1. Objectif & périmètre
- **Objectif.** Moteur réutilisable d'**analyse comparative des offres** : réception des plis, **grille de critères pondérés**, vérification de **conformité**, **scoring**, classement, et **rapport/PV d'analyse**. Souple en privé, formel et scellé en public.
- **Hors périmètre.** Le processus de passation (M8) ; la commande (M9). M23 évalue et recommande ; il n'attribue pas.
### 2. Rôles & permissions
| Action | procurement | moa_director | amo | viewer |
|---|---|---|---|---|
| Saisir/importer les offres | U | U | U | R |
| Définir critères & pondérations | U | U | U | R |
| Noter & classer | U | U | U | R |
| Sceller le rapport (public) | — | V | — | R |
### 3. Dictionnaire de données
- **offers** : tender_id (M8) ou po_id (M9), bidder, total_amount, admin_compliant(bool), received_at.
- **offer_lines** : offer_id, bpu_code, unit_price, quantity.
- **evaluation_criteria** : context_id, label, type (prix\|technique\|delai\|references\|conformite), weight.
- **offer_scores** : offer_id, criteria_id, raw_score, weighted_score.
- **analysis_reports** : context_id, ranking(jsonb), recommendation, sealed(bool), hash.
### 4. Machine à états (analyse)
reçue → analysée → classée → rapport (→ scellé en public).
### 5. Calculs (`Money.ts` pour les prix) & règles
```
score_pondéré(offre) = Σ_critère (note_normalisée × poids)
note_prix = (prix_min / prix_offre) × poids_prix     # avantage au moins-disant
offre_anormalement_basse si prix_offre < seuil × moyenne(prix)   # → alerte (PROPH3T)
```
- **RG-M23-01** — Les critères et pondérations sont définis **avant** ouverture des plis ; en public, ils sont ceux publiés (non modifiables après).
- **RG-M23-02** — Une offre non conforme administrativement est écartée du classement (motivé).
- **RG-M23-03** — Le scoring est déterministe et reproductible ; les prix sont comparés en Money.ts.
- **RG-M23-04** — PROPH3T peut extraire les données d'offres depuis les PDF et détecter les anomalies de prix ; la **note finale reste validée par un humain**.
- **RG-M23-05** — En public, le rapport d'analyse est **scellé** (hash) et horodaté ; il fonde l'attribution (M8).
- **RG-M23-06** — Le modèle de données (offers/scores/report) est distinct de `purchase_orders`/`shipments` (M9).
### 6. Écrans
- **Réception des offres** (saisie/import, conformité administrative).
- **Grille d'analyse** (critères, pondérations, notes, scores).
- **Classement & rapport** (recommandation, détection d'anomalies, PV scellable).
### 7. API & Edge Functions
offers · offer-lines · evaluation-criteria · **score-offers (edge)** (déterministe) · **extract-offer (edge, PROPH3T)** · **seal-report (edge)**.
### 8. Validations & cas limites
poids Σ = 100 % ; critères verrouillés après ouverture (public) ; offre non conforme écartée + motif ; offre anormalement basse signalée ; prix en Money.ts.
### 9. i18n & Télémétrie
`bid.received`, `bid.scored`, `bid.anomaly_detected`, `bid.report_sealed`.
### 10. Critères d'acceptation
```gherkin
Scénario: Critères verrouillés en public après ouverture
  Étant donné une consultation publique dont les plis sont ouverts
  Quand on tente de modifier une pondération
  Alors l'action est refusée (RG-M23-01)
Scénario: Offre anormalement basse signalée
  Étant donné une offre nettement sous la moyenne
  Quand le scoring s'exécute
  Alors une anomalie est signalée pour vérification (RG-M23-04)
```
### 11. Définition de fini
Scoring déterministe (Money.ts) · conformité écartée motivée · anomalies détectées · rapport scellé en public · réutilisé par M8 & M9 · responsive + a11y · Gherkin verts.
---
## Annexe A — Carte des interconnexions (gardes & flux)
| Flux | De → Vers | Nature |
|---|---|---|
| Garde DD critique / permis | M2 → M1 | Bloque transition de phase |
| Garde DO assurance | M7 → M1 | Bloque ouverture chantier |
| Garde EIES | M3 → M2 | Bloque autorisation environnementale |
| Honoraires | M7 → M4 | Alimente poste études |
| Frais financiers / déblocages | M5 → M4 | Alimente coûts & trésorerie |
| Recettes / appels de fonds | M6 → M4 | Alimente recettes & trésorerie |
| Engagés / réalisés | M8, M9, M15 → M4 | Alimente le bilan |
| Validation situation | M13 → M15 | Débloque le mandatement |
| Retenue de garantie | M15 → M16 → M18 | Provision puis mainlevée |
| Avenant (coût/délai) | M14 → M8, M4, M12 | Propagation |
| ETA appro | M9 → M12 | Impacte le planning |
| Dérive critique | M12 → M4, M21 | Trésorerie & alertes |
| Évaluation des offres | M23 ↔ M8, M9 | Fonde l'attribution / la commande |
| Raccordements | M17 → M18 | Garde réception |
| Réception / GPA | M18 → M1, M16 | Phase exploitation + mainlevée |
| Bascule exploitation | M20 → M1, Keystone, Lease | Garde clôture + export |
| Agrégation & alertes | tous → M21 | Cockpit |
| Assistance contextuelle | tous ↔ M22 | RAG (sans calcul monétaire) |
| TVA & retenues à la source | F6 → M15, M4 | Fiscalité du paiement |
| Alertes → canaux | tous → F4 | Notifications (in-app/email/SMS/WhatsApp) |
| Approbations & délégation | F7 ↔ M8, M13, M14 | Moteur de workflow partagé |
| Calcul monétaire | F2 ↔ M4, M5, M6, M15, M23 | Money.ts (source d'exactitude) |
| Écritures & paiements | F5 ↔ Atlas Finance, CinetPay, ADVIST… | Contrats d'intégration idempotents |
## Annexe B — Séquence de build
- **Fondations (avant/avec le MVP)** : F1 (auth/tenancy), F2 (Money.ts), F3 (offline/synchro), F4 (notifications), F6 (fiscalité), F7 (workflow/délégation) ; F5 (intégrations) au fil des besoins.
- **MVP (privé)** : M1, M2, M4, M7, M12, M13, M14, M15.
- **V1** : M5, M6, M8(privé), M9, M10, M11, M16, M21, M22, M23.
- **V2** : M3, M8(public), M17, M18, M19, M20.
**Gate de merge (tous modules)** : RLS isolée · calculs Money.ts testés · machines à états gardées · écrans 360→1920 + états vide/chargement/erreur · a11y AA · Gherkin verts · audit rejouable · aucun texte en dur.
---
*Fin — Atlas Opus · Spécifications détaillées des 23 modules · Atlas Studio · Confidentiel.*
