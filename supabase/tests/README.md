# Tests RLS — Atlas Opus

Vérifie que l'isolation garantie par `schema.sql` tient au niveau **PostgreSQL**
(et non dans le code applicatif seul, cf. CLAUDE.md §5). Couvre les trois niveaux
du gate de merge : **tenant**, **périmètre opération (`operation_scope`)** et **rôle**.

## Lancer

```bash
bash supabase/tests/run.sh
```

Le script provisionne un cluster PostgreSQL 16 **éphémère**, applique le harnais
d'authentification de test puis `schema.sql`, accorde les privilèges au rôle
`authenticated`, exécute `rls_test.sql`, puis détruit le cluster. Il sort en
erreur (`≠ 0`) si une assertion échoue. `pgvector` n'est pas requis (neutralisé
pour le test — les politiques RLS ne touchent pas les embeddings).

Prérequis : binaires PostgreSQL 16 (`initdb`, `pg_ctl`, `psql`). PostgreSQL
refusant de tourner en `root`, le script se ré-exécute sous l'utilisateur
`postgres` s'il est lancé en root.

## Ce qui est vérifié (`rls_test.sql`)

| # | Niveau | Attendu |
|---|--------|---------|
| T1 | Tenant | `uA_full` (tenant A) voit les 2 opérations de A, **pas** celle de B |
| T2 | Tenant | `uB` (tenant B) ne voit que l'opération de B |
| T3 | `operation_scope` | `uA_scoped` (scope = `[opA1]`) ne voit **que** `opA1`, pas `opA2` — ni ses lignes filles (correctif v4.1) |
| T4 | Rôle (UPDATE) | un rôle `site` **ne peut pas** modifier `budget_lines` |
| T5 | Rôle (UPDATE) | un rôle `finance` **peut** modifier `budget_lines` (pas de sur-restriction) |
| T6 | Rôle (INSERT) | un rôle `site` **ne peut pas** créer d'opération |
| T7 | Méta (tenant) | **toute** table portant `tenant_id` a la RLS active **et** au moins une politique (gate « RLS sur 100 % des tables », §3) |
| T8 | Méta (`operation_scope`) | **toute** table portant `operation_id` filtre par `user_operations()` en lecture (`USING`) — garantit le correctif v4.1 sur toutes les tables, présentes et futures |

Les méta-tests T7/T8 scrutent le catalogue (`pg_class`, `pg_policies`) : une table
ajoutée qui oublierait la RLS ou le filtre `operation_scope` fait échouer le gate
sans qu'il faille l'énumérer à la main. C'est ainsi qu'ont été détectées, dans
`schema.sql`, deux fuites hors-périmètre corrigées depuis : `notifications` (F4)
et `rag_chunks` (contexte RAG M22), qui n'isolaient qu'au tenant.

## Tests de la pile de migrations (déployé `ao_`)

`rls_test.sql` valide **`schema.sql`** (vérité CDC). Pour valider le **déployé
réel** (tables `ao_`), une seconde suite exécute toutes les migrations puis
vérifie les mêmes garanties :

```bash
bash supabase/tests/run_migrations.sh
```

Elle applique `_bootstrap_migrations.sql` (objets partagés « ATLAS STUDIO » +
auth de test), puis `supabase/migrations/*.sql` dans l'ordre, puis
`rls_migrations_test.sql` (MT1–MT8). La migration `0034` apporte au déployé les
niveaux 2 (`operation_scope` via `ao_operation_members` + `ao_user_operations()`)
et 3 (rôle via `ao_tenant_roles` + `ao_has_role()`), **sans casser l'existant** :
MT6 vérifie qu'un utilisateur sans rôle peut toujours écrire (fail-open until
assigned) et qu'aucune ligne `ao_operation_members` ⇒ toutes les opérations du
tenant. Les gardes s'activent par utilisateur au fil des attributions.

## Fichiers

- `run.sh` — provisionne, applique, exécute, nettoie.
- `_harness.sql` — émule `auth.uid()` / `auth.role()` et le rôle `authenticated`
  sur un PostgreSQL nu. **Test uniquement** ; en production Supabase les fournit.
- `rls_test.sql` — seed multi-tenant + assertions T1–T8, exécutées sous le rôle
  non-propriétaire `authenticated` (sinon la RLS serait contournée).
- `_bootstrap_migrations.sql` — émule les objets partagés (`tenants`,
  `user_tenants`) + auth pour exécuter la pile de migrations hors Supabase.
- `run_migrations.sh` / `rls_migrations_test.sql` — applique toutes les
  migrations `ao_` puis vérifie tenant + `operation_scope` + rôle (MT1–MT8).

## Note de conception

Les gardes d'écriture par rôle (`operations_write`, `budget_lines_write`,
`bilan_write`, `decomptes_write`, `payments_write`) sont déclarées **`as
restrictive`**. Une politique permissive serait combinée en **OU** avec la
politique `_iso` (`for all`) de la table et la garde de rôle serait sans effet ;
`restrictive` la combine en **ET** — c'est ce que T4/T6 vérifient.
