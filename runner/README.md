# Runner — recalcul du bilan (Node)

Exécute le job « recalcul du bilan » (M4) dans un **runtime TypeScript**, seul
autorisé à faire tourner le calcul monétaire (Money.ts, invariant §5 — jamais en
SQL, jamais en Edge Deno). Réutilise le moteur `recomputeBilan` et
l'orchestrateur `recomputePortfolio` : **aucune logique métier n'est dupliquée**.

## Ce que fait le runner

1. Client **service_role** → liste toutes les opérations (RLS contournée).
2. Regroupe par tenant (`groupByTenant`).
3. Pour chaque tenant : session dédiée (`tenant_id` correct pour l'écriture),
   recalcul de chaque opération, puis gel des indicateurs dans un cliché M21
   (`ao_report_snapshots`).

## Configuration (environnement — jamais committé)

| Variable | Rôle | Défaut |
|----------|------|--------|
| `SUPABASE_URL` | projet | — (requis) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | — (requis) |
| `RECOMPUTE_TYPE` | `hebdo` \| `mensuel` \| `deep_dive` | `mensuel` |
| `RECOMPUTE_PERIOD` | période du cliché | mois courant `AAAA-MM` |
| `REDIS_URL` | worker BullMQ | `redis://127.0.0.1:6379` |
| `RECOMPUTE_CRON` | cron du worker | `0 2 * * *` |

La `service_role` se fournit par l'environnement (secret d'ops / Vault), jamais
dans le dépôt.

## Modes d'exécution

**One-shot** (cron simple, CI, ou pg_cron via wrapper) :

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run recompute:once
```

**Worker BullMQ + Redis** (file, reprises, observabilité — CLAUDE.md §3) :

```bash
REDIS_URL=redis://… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run recompute:worker
```

**pg_cron** peut aussi déclencher le one-shot via un conteneur/edge planifié qui
lance `npm run recompute:once` — le calcul reste côté TS.

## Validation

```bash
npm run typecheck:runner   # tsc -p runner/tsconfig.json
```

La logique pure (moteur, orchestrateur, regroupement) est testée dans la suite
Vitest de l'app (`src/domain/finance/recompute.test.ts`, `src/app/recompute.test.ts`).
