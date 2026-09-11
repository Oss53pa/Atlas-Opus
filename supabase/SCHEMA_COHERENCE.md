# Cohérence `schema.sql` ↔ migrations déployées — audit

> État au 2026-09-11. Objet : documenter la divergence entre la **source de
> vérité CDC** (`schema.sql`, CLAUDE.md §3) et le **schéma réellement déployé**
> (les migrations `supabase/migrations/00NN_*.sql`, projet `vgtmljfayiysuvrcmunt`).
> Cet écart porte un **risque de sécurité** : deux des trois niveaux d'isolation
> exigés par §5 ne sont **pas** déployés.

## TL;DR

| Niveau §5 | `schema.sql` (vérité CDC) | Déployé (migrations `ao_`) | Écart |
|-----------|---------------------------|-----------------------------|-------|
| 1 — Tenant | `tenant_id in (select public.user_tenants())` | `tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())` | ✅ présent des deux côtés (formes différentes) |
| 2 — Périmètre opération (`operation_scope`) | `operation_id in (select public.user_operations())` sur toutes les tables à `operation_id` | **absent** — 29 tables `ao_*` portent `operation_id`, **aucune** ne filtre par périmètre | 🔴 **la « faille à corriger » de la v4.1 n'est pas déployée** |
| 3 — Rôle → action (écritures sensibles) | politiques `as restrictive` + `public.has_role(...)` (`operations_write`, `budget_lines_write`, `decomptes_write`, …) | **absent** — 46 politiques, toutes `_iso` permissives tenant-only ; aucun `has_role`, aucun `as restrictive` | 🔴 la matrice rôle × action n'est pas appliquée en base |

Conséquence concrète : dans la base déployée, **un utilisateur restreint à une
opération voit toutes les opérations de son tenant**, et **tout membre du tenant
peut exécuter les écritures sensibles** (la RLS ne les distingue pas par rôle).
C'est exactement la faille que le CDC §5 dit avoir corrigée — elle vit dans
`schema.sql` et le mock, pas dans le déployé.

## Divergences détaillées

### 1. Nommage & cohabitation
- `schema.sql` : tables non préfixées (`operations`, `program_items`, …).
- Migrations : tables **préfixées `ao_`** (`ao_operations`, `ao_program_items`, …)
  pour cohabiter avec le schéma pré-existant du projet partagé « ATLAS STUDIO ».

### 2. Modèle d'authentification / tenancy
- `schema.sql` : fonctions `security definer` `public.user_tenants()`,
  `public.user_operations()` (respecte `memberships.operation_scope`),
  `public.has_role(text[])`, sur une table `memberships(tenant_id, user_id, role,
  operation_scope)`.
- Migrations : s'appuient sur une **table partagée `public.user_tenants(user_id,
  tenant_id)`** (mapping tenant seul). **Pas** de table `memberships`, **pas** de
  `user_operations()`, **pas** de `has_role()`, **pas** de notion de rôle ni de
  périmètre par opération.

### 3. Côté application
- Le monde mock (`src/data/mock.ts`) et `schema.sql` implémentent le périmètre —
  `src/data/mock.test.ts` teste même « le périmètre du membership restreint la
  liste ».
- L'adaptateur Supabase (chemin déployé) n'enforce que le tenant ; la session
  applicative code en dur `operationScope: null` (`src/app/providers.tsx`), donc
  le périmètre n'est pas non plus appliqué côté client.

## Ce qui est déjà couvert

- Les **méta-tests RLS** T7/T8 (`supabase/tests/rls_test.sql`) vérifient
  l'isolation tenant + `operation_scope` + rôle **contre `schema.sql`** (source de
  vérité). Ils sont verts — mais valident la vérité CDC, **pas** le déployé.

## Remédiation recommandée (déployé)

Pour aligner le déployé sur §5, il faut, dans le monde `ao_` :

1. **Périmètre opération** — introduire une représentation du périmètre par
   utilisateur (p. ex. `ao_operation_members(tenant_id, user_id, operation_id)`
   avec la sémantique « aucune ligne pour ce tenant ⇒ toutes les opérations »,
   comme `operation_scope is null`), une fonction `ao_user_operations()`, puis
   ajouter la clause de périmètre au `USING`/`WITH CHECK` des 29 politiques
   `ao_*` portant `operation_id`.
2. **Rôle → action** — représenter le rôle par utilisateur (table de rôles `ao_`
   ou colonne sur l'appartenance), une fonction `ao_has_role(text[])`, et des
   politiques d'écriture **`as restrictive`** sur les tables sensibles
   (opérations, budgets, décomptes, paiements, passation…).
3. **Application** — peupler et consommer le périmètre/rôle réels au lieu du
   `operationScope: null` codé en dur.
4. **Tests** — étendre le harnais RLS pour l'exécuter **aussi** contre la pile de
   migrations (tables `ao_`), afin que T1–T8 valident le déployé et non seulement
   `schema.sql`.

Ces changements touchent la base déployée **et** le câblage applicatif : à
arbitrer (conception de la représentation périmètre/rôle, ordre de déploiement,
compatibilité avec le schéma partagé « ATLAS STUDIO »).
