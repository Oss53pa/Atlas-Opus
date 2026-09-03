# Edge Functions — écritures sensibles (`service_role`)

Seul point d'entrée autorisé à utiliser la clé **`service_role`** (CLAUDE.md §3/§5).
La `service_role` **contourne la RLS** : chaque fonction **revérifie le rôle** du
porteur, **garde la machine à états** et **scelle l'audit** avant toute écriture.
La clé n'est jamais exposée au client ; le front appelle ces fonctions avec le
**JWT** de l'utilisateur (en-tête `Authorization: Bearer …`).

## Le patron (identique pour chaque fonction)

1. **Authentifier** — `requireCaller(req)` valide le JWT (clé anon + en-tête du
   porteur) et renvoie `userId`. 401 sinon.
2. **Charger la ressource** avec le `serviceClient()` pour connaître son
   `tenant_id` et son `operation_id` réels.
3. **Autoriser** — `requireRoleForTenant(service, userId, tenant_id, rôles)` lit
   `public.user_tenants` **pour le tenant de la ressource** (jamais un `tenant_id`
   fourni par le client) et exige un rôle autorisé. 403 sinon.
4. **Garder la transition** — `guardLinear(SEQ, from, to)` n'autorise qu'un pas en
   avant de la machine à états. 409 sinon.
5. **Écrire** via `service_role`.
6. **Sceller l'audit** — `appendAudit(...)` chaîne l'entrée (SHA-256) au journal
   `ao_audit_log` de l'opération.

Les erreurs sont typées (`HttpError`) et rendues en JSON `{ error }` avec le bon
code HTTP ; le préflight CORS est géré.

## Fonctions

| Slug | Module | Rôles autorisés | Action |
|------|--------|-----------------|--------|
| `ao-passation` | M8 | `owner`, `moa_director`, `procurement` | avance un marché `planned→published→opened→evaluated→awarded→notified` (titulaire requis dès `awarded`) |
| `ao-mandatement` | M15 | `owner`, `moa_director`, `finance` | avance un décompte `draft→validated→mandated→paid` (mandatement + mise en paiement) |
| `ao-integrations` | F5 | `owner`, `moa_director`, `finance` | dépose une intention sortante dans `ao_outbox`, **idempotente** (clé `system:kind:businessId`) |

### Exemple d'appel

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ao-mandatement" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "decompteId": "…", "targetStatus": "mandated" }'
```

Réponse : `{ "ok": true, "id": "…", "status": "mandated" }`.

## Idempotence F5 (`ao-integrations`)

- Clé d'idempotence = `system:kind:businessId`, unique par tenant (`ao_outbox`).
- Rejeu au **contenu identique** → renvoie l'existant (`deduplicated: true`).
- Rejeu au **contenu divergent** (empreinte `payload_hash` différente) → **409**.
- Une course perdue sur la contrainte unique (`23505`) est traitée en idempotent.
- La livraison (backoff, disjoncteur, lettre morte) est portée par l'outbox et
  un worker distinct (F5 `contract.ts`) — l'Edge Function ne fait que **déposer**.

## Contrat d'audit (à ne pas casser)

`hash = SHA-256(hash_prev ‖ payload)`, avec
`payload = [id, operationId, at, actor, action, module, object, summary].join(' ')`.
Formule **identique** à `src/domain/m23/audit.ts` : le journal scellé côté serveur
reste vérifiable hors ligne par `verifyAuditChain` côté client. `id` et `at` (ISO,
ms) sont fixés par la fonction — pas par les défauts SQL — car ils entrent dans le
hash.

**Vecteur d'or** (figé par `src/domain/m23/m23.test.ts`) — toute réécriture de la
formule doit conserver :

```
payload  = "11111111-1111-4111-8111-111111111111 op-1 2026-09-03T00:00:00.000Z u-1 transition M15 decompte:7 validated→mandated"
hash_prev = 0000…0000 (64 zéros, genesis)
hash      = 53a6e03c89d304171b401cdaa7df5e6ef0c6e3111c19df75c16b00130bb72a3f
```

## Déploiement

```bash
supabase functions deploy ao-passation ao-mandatement ao-integrations
```

Variables injectées par le runtime : `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Aucune clé n'est committée.

## Lint / format

Runtime **Deno** (hors du périmètre ESLint/tsc de l'app, cf. `eslint.config.js`).

```bash
deno lint supabase/functions
deno fmt --check supabase/functions
```
