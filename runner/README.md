# Runner — recalcul du bilan (Node)

Exécute le job « recalcul du bilan » (M4) dans un **runtime TypeScript**, seul
autorisé à faire tourner le calcul monétaire (Money.ts, invariant §5 — jamais en
SQL, jamais en Edge Deno). Réutilise le moteur `recomputeBilan` et
l'orchestrateur `recomputePortfolio` : **aucune logique métier n'est dupliquée**.

Deux jobs planifiés (CLAUDE.md §3), même patron (service_role → `groupByTenant`
→ session par tenant → moteur du domaine) :

- **Recalcul du bilan** (M4) : recalcule chaque opération, fige un cliché M21
  (`ao_report_snapshots`).
- **Relances & échéances** (F4) : dérive les échéances imminentes/dépassées des
  assurances (M7) et cautions (M17), émet des notifications **idempotentes**
  (`ao_notifications.dedup_key`) — le cron repasse sans dupliquer.

## Configuration (environnement — jamais committé)

| Variable | Rôle | Défaut |
|----------|------|--------|
| `SUPABASE_URL` | projet | — (requis) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | — (requis) |
| `RECOMPUTE_TYPE` | `hebdo` \| `mensuel` \| `deep_dive` | `mensuel` |
| `RECOMPUTE_PERIOD` | période du cliché | mois courant `AAAA-MM` |
| `RELANCES_TODAY` | date de référence des échéances | aujourd'hui `AAAA-MM-JJ` |
| `RELANCES_WINDOW_DAYS` | fenêtre d'alerte (jours) | `30` |
| `REDIS_URL` | worker BullMQ | `redis://127.0.0.1:6379` |
| `RECOMPUTE_CRON` | cron recalcul (worker) | `0 2 * * *` |
| `RELANCES_CRON` | cron relances (worker) | `0 6 * * *` |

La `service_role` se fournit par l'environnement (secret d'ops / Vault), jamais
dans le dépôt.

## Modes d'exécution

**One-shot** (cron simple, CI, ou pg_cron via wrapper) :

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run recompute:once   # recalcul du bilan
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run relances:once    # relances & échéances
```

**Worker BullMQ + Redis** (file, reprises, observabilité — CLAUDE.md §3). Un seul
worker héberge les deux jobs planifiés (recalcul + relances) :

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
