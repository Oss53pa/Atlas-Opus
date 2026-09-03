# Supabase — branchement réel

Source de vérité du schéma : **`schema.sql` (SQL brut)** à la racine (CLAUDE.md §3).
Les migrations `migrations/00NN_*.sql` en sont le **déploiement incrémental**,
préfixées `ao_` et idempotentes (`create … if not exists`, `drop policy if exists`)
pour cohabiter avec une base partagée. Prisma n'est utilisé que comme **client typé**
(`prisma db pull`), jamais comme source.

## Projet déployé

| | |
|---|---|
| Projet | `vgtmljfayiysuvrcmunt` (region `eu-west-1`) |
| URL API | `https://vgtmljfayiysuvrcmunt.supabase.co` |
| Clé cliente | clé **publiable** (`sb_publishable_…`) — cf. `.env.example` |

La clé publiable est destinée au client : la **RLS** protège les données (CLAUDE.md §5).
La `service_role` n'est **jamais** exposée côté front ; elle reste réservée aux
Edge Functions.

## Basculer le front sur Supabase

Le backend de données est piloté par une variable d'environnement (Vite). Par défaut
`mock` (en mémoire) ; passer à `supabase` active le vrai projet.

```bash
cp .env.example .env.local
# puis dans .env.local :
VITE_DATA_BACKEND=supabase
```

Sélection à l'exécution : `src/data/supabase/client.ts` (`supabaseBackendEnabled()`)
puis `src/app/providers.tsx` — même contrat `DataApi`, deux implémentations
(mock ↔ `createSupabase*Repo`). L'`AuthGate` (`src/app/auth.tsx`) garantit une
session ; le tenant/rôle est résolu depuis `public.user_tenants`.

## Migrations (ordre d'application)

`0001` → `0030`. 30 migrations déployées ⇒ **41 tables `ao_*`**, RLS activée
sur 100 % d'entre elles.

| Plage | Contenu |
|-------|---------|
| 0001–0006 | M1 opération/programme · M4 bilan · M2 intervenants · M13 décomptes · M12 tâches · M8 passation |
| 0007–0010 | Gardes M2/M7 (autorisations, assurances) · due diligence · foncier · financement M5 |
| 0011–0020 | Commercialisation M6 · reporting M21 · gouvernance M7 · études M3 · offres M9 · achats M10 · réception M19 · garanties M17 · risques M20 · journal d'audit M23 |
| 0021–0028 | Comptes rendus M13 · modifications M15 · GED M11 · RFI M12 · raccordements M18 · bibliothèque M22 · bascule exploitation M20 · transverse (membres, notifications, approbations) |
| 0029 | Chaîne de hachage d'audit (SHA-256 chaîné, journal rejouable) |
| 0030 | F5 intégrations : `ao_integration_endpoints` + `ao_outbox` (idempotence, backoff, disjoncteur) |

Application via l'outillage Supabase (MCP `apply_migration` / CLI `supabase db push`).
Les fichiers étant idempotents, un rejeu sur une base déjà à jour est sans effet.

## Vérification du déploiement

- **Tables & RLS** — 41 tables `ao_*`, `relrowsecurity = true` sur chacune.
- **Advisors sécurité** — aucun avis (`ERROR`/`WARN`) ne concerne une table `ao_*`.
- **Tests RLS** — `bash supabase/tests/run.sh` rejoue tenant + `operation_scope` +
  rôle sur un cluster éphémère (voir `tests/README.md`).

```sql
-- Couverture RLS des tables Atlas Opus (attendu : 41 lignes, rls = true)
select c.relname, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'ao\_%'
order by 1;
```

## Recalcul du bilan (M4) — job asynchrone

Le calcul du bilan (coût/recettes/marge/taux, TRI, besoin de trésorerie) a **un
seul moteur**, `src/domain/finance/recompute.ts` (`recomputeBilan`), utilisé à la
fois par l'écran (`BilanRepo.summary`) et par le job de fond (`BilanRepo.recompute`).
Tout montant passe par **Money.ts** (invariant §5) : le recalcul reste donc en
**TypeScript** — jamais en SQL, jamais côté LLM. Il ne peut pas vivre dans une Edge
Function Deno (qui dupliquerait la logique monétaire).

Le job `recomputePortfolio` (`src/app/recompute.ts`) recalcule chaque opération puis
**fige** les indicateurs dans un cliché M21 (`ao_report_snapshots`, RG-M21-01 : le
reporting ne recalcule rien, il consomme ce résultat).

Planification (CLAUDE.md §3) : `pg_cron` déclenche le back métier **NestJS** (ou un
runner Node/BullMQ) qui exécute `recomputePortfolio`. Aucune tâche n'est imposée sur
la base partagée ; l'ordonnanceur appelle le runtime TS, pas une fonction SQL.

## Garde-fous

- Aucun secret committé : `.env.example` ne contient que l'URL et la clé **publiable**.
- La `service_role` n'apparaît nulle part dans le dépôt.
- Toute nouvelle table métier : préfixe `ao_`, `tenant_id`, RLS `enable` + politique
  `user_tenants`, et le cas échéant garde de rôle `as restrictive` (CLAUDE.md §5).
