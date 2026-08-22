# CLAUDE.md — Atlas Opus (v4.1)
> Ancrage pour Claude Code. **À lire au début de chaque tâche.** Les invariants priment en cas de doute.
> Références : *Atlas Opus — CDC v4.1*, `Atlas-Opus_Specifications_Modules.md` (23 modules + 7 fondations), `schema.sql` (v4.1), `tokens.ts`.
> Nouveautés v4.1 : fondations transverses spécifiées, RLS corrigée (périmètre opération + rôles), fiscalité, moteur de workflow, décisions de stack tranchées.
---
## 1. Ce qu'on construit
**Atlas Opus** est une application de **Maîtrise d'Ouvrage** (UEMOA / CEMAC). Elle pilote l'**opération** côté commanditaire, du montage foncier à la cession. Le chantier n'est qu'une phase. Le MOA délègue l'exécution (MOE, AMO, entreprises) mais garde les arbitrages, les validations et le **bilan**. Couvre le **privé** (promotion) et le **public** (marchés publics), tous types d'opération par configuration.
---
## 2. Les six invariants NON NÉGOCIABLES
1. **Centré opération / MOA.** Entité racine `operations`. Écrans et droits côté maître d'ouvrage.
2. **Multitenant strict + périmètre opération.** Chaque table métier porte `tenant_id` ; l'isolation par tenant ET par `operation_scope` est garantie par **RLS Postgres** (voir §5), jamais par le code seul.
3. **Multi-pays & multi-régime.** Devise, fiscalité, plan comptable, régime de passation, type d'opération pilotés par `country_config`, jamais codés en dur.
4. **Offline-first.** Consultation et saisie terrain hors-ligne ; synchro différée déterministe (voir fondation F3). Écritures financières en brouillon hors-ligne uniquement.
5. **Souveraineté & précision.** IA locale (Ollama) d'abord. **Tout calcul monétaire via `Money.ts`** (fondation F2) — jamais de flottant, jamais un LLM.
6. **Premium & responsive.** Mobile-first (360 px). Aucune vue mergée si elle casse < 768 px ou sort du design system.
---
## 3. Stack (décisions tranchées)
- **Front** : React 18 + TypeScript, mobile-first.
- **Données** : Supabase (PostgreSQL), RLS sur 100 % des tables, `pgvector`.
- **Migrations — source de vérité : `schema.sql` (SQL brut).** Prisma est utilisé **uniquement comme client typé** côté NestJS (`prisma db pull` depuis la base ; jamais `prisma migrate` comme source). Une seule vérité : le SQL.
- **Back métier** : NestJS 10 + Fastify + Prisma Client (bilan, EAC, TRI, appels de fonds, intérêts, fiscalité).
- **Edge Functions** : seul accès `service_role` (passation, mandatement, écritures, intégrations, workflow).
- **Asynchrone** : BullMQ + Redis ; `pg_cron` (recalcul bilan, relances, échéances assurances/cautions, escalades).
- **IA (PROPH3T)** : Ollama local + Claude (vision/repli, consentement). `noDataRetention: true` pour le sensible.
---
## 4. Design system « Atlas » (source : `tokens.ts`)
Thème sombre, fond `#0A0A0A`, accent **ambre `#EF9F27`** (rare). Typo : `Grand Hotel` (noms d'app), `Exo 2` (UI), `JetBrains Mono` (FCFA, codes). Base 4 px ; rayons 8/12/16 ; breakpoints 360/768/1024/1440/1920 (tableaux → cartes sous 768). A11y WCAG 2.1 AA. Aucune valeur en dur : importer les tokens.
---
## 5. Sécurité & accès (CORRIGÉ en v4.1)
L'isolation ne repose JAMAIS sur le code applicatif seul. Trois niveaux, tous en base :
1. **Tenant** — toute table métier : `tenant_id in (select user_tenants())`.
2. **Périmètre opération** — les tables portant `operation_id` ajoutent : `operation_id in (select user_operations())`. La fonction `user_operations()` respecte `memberships.operation_scope` (null = toutes les opérations du tenant ; sinon liste explicite). **Sans cette règle, un utilisateur restreint voyait tout : c'était la faille à corriger.**
3. **Rôle → action** — les écritures sensibles sont gardées par `has_role(array['finance','moa_director'])` (politiques d'écriture séparées de la lecture) ET revérifiées dans les Edge Functions. La matrice rôle × action des specs est ainsi réellement appliquée, pas décorative.
`service_role` contourne la RLS : réservé aux Edge Functions. Audit (`audit_log`, hash SHA-256 chaîné) sur écriture sensible et étape de passation.
---
## 6. Conventions
Argent : `numeric(18,2)` en base, `Money.ts` (centimes entiers) en mémoire. IDs `uuid`. Dates `timestamptz`/`date` (planning en jours ouvrés via `public_holidays`). i18n : clés, aucun texte en dur. Aucun secret côté client.
---
## 7. Logique métier (implémenter en Money.ts)
```
# Bilan
cout_{prevu|engage|realise} = somme cost.amount_{planned|committed|actual}
marge = recettes - cout ; taux_marge = marge / cout_prevu
TRI = taux annulant la VAN des flux    # Newton-Raphson, garde-fous (voir F2/M4)
# Financement & VEFA
appel_de_fonds[stade]  = prix * pourcentage_reglementaire[stade]
interets_intercalaires = capital_decaisse * taux * duree/360
# Paiement (M15) — FISCALITÉ INCLUSE en v4.1
base_ht        = brut_travaux
tva            = base_ht * vat_rate(pays)
retenue_source = base * wht_rules(pays)           # précompte / IRVM selon nature
retenue_garantie = brut * operation.retention_rate
penalite_retard  = montant_marche * taux * jours_retard      # plafonnee
net_a_payer = base_ht + tva - retenue_source - retenue_garantie - avance_remboursee - penalites
# Révision de prix (marchés) — v4.1
montant_revise = montant_base * (a0 + a1*I1/I1_0 + a2*I2/I2_0 + ...)   # formule par indices
```
---
## 8. Modules (23) & fondations (7)
**Fondations transverses (à bâtir AVANT ou avec le MVP)** : `F1` Auth, tenancy & onboarding · `F2` Money.ts · `F3` Offline & synchronisation · `F4` Notifications (in-app/email/SMS/WhatsApp) · `F5` Intégrations (contrats API : Atlas Finance, ADVIST, CinetPay, Atlas Lease, Keystone, DueDeck) · `F6` Fiscalité (TVA + retenues OHADA) · `F7` Workflow & délégation (moteur d'approbation réutilisé par M8/M13/M14).
**Modules métier** : M1 Opération & programme · M2 Foncier & montage juridique · M3 Études amont · M4 Bilan & rentabilité · M5 Financement & déblocages · M6 Commercialisation & recettes · M7 Parties prenantes & contrats · M8 Passation · M9 Achats/appro/logistique · M10 Conception & GED · M11 RFI & collaboration · M12 Planning & chemin critique · M13 Pilotage de réalisation · M14 Maîtrise des modifications · M15 Chaîne de paiement & engagements · M16 Cautions & garanties · M17 Concessionnaires & raccordements · M18 Qualité/réception/GPA · M19 Risques/litiges/assurances/HSSE · M20 Passation→exploitation · M21 Cockpit & reporting · M22 Copilote PROPH3T · M23 Analyse & dépouillement des offres.
---
## 9. Séquence de build
- [ ] Étape 0 — `CLAUDE.md` + `tokens.ts` à la racine.
- [ ] Étape 1 — Supabase + `schema.sql` v4.1 appliqué ; **tester l'isolation tenant ET operation_scope** sur base neuve.
- [ ] Étape 2 — Fondations F1 (auth/tenancy) + F2 (Money.ts + tests) AVANT tout module financier.
- [ ] Étape 3 — Design system Atlas depuis `tokens.ts`.
- [ ] Étape 4 — F3 (offline/synchro) et F4 (notifications) avant le terrain.
| Palier | Contenu |
|--------|---------|
| Fondations | F1, F2, F3, F4, F6, F7 (F5 au fil des intégrations) |
| MVP (privé) | M1–M4, M7, M12–M15 |
| V1 | M5, M6, M8(privé), M9, M10, M11, M16, M21, M22, M23 |
| V2 | M3, M8(public), M17, M18, M19, M20 |
**Gate de merge :** RLS testée (tenant + operation_scope + rôle) · calculs Money.ts verts · machines à états gardées · responsive 360→1920 · a11y AA · audit rejouable · aucun texte en dur · contrat d'intégration respecté (idempotence, panne tierce gérée).
