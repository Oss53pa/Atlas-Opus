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

## Fichiers

- `run.sh` — provisionne, applique, exécute, nettoie.
- `_harness.sql` — émule `auth.uid()` / `auth.role()` et le rôle `authenticated`
  sur un PostgreSQL nu. **Test uniquement** ; en production Supabase les fournit.
- `rls_test.sql` — seed multi-tenant + assertions T1–T6, exécutées sous le rôle
  non-propriétaire `authenticated` (sinon la RLS serait contournée).

## Note de conception

Les gardes d'écriture par rôle (`operations_write`, `budget_lines_write`,
`bilan_write`, `decomptes_write`, `payments_write`) sont déclarées **`as
restrictive`**. Une politique permissive serait combinée en **OU** avec la
politique `_iso` (`for all`) de la table et la garde de rôle serait sans effet ;
`restrictive` la combine en **ET** — c'est ce que T4/T6 vérifient.
