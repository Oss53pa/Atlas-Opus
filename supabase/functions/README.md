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
| `ao-outbox-worker` | F5 | **service_role uniquement** (pilotée par cron) | draine `ao_outbox`, appelle le tiers, applique backoff + disjoncteur |

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

## Worker de livraison (`ao-outbox-worker`)

`ao-integrations` ne fait que **déposer** ; le worker **livre**. À chaque tick il :

1. sélectionne un lot de messages **dus** (`pending`, ou `retrying` échu) — tous
   tenants confondus (service_role) ;
2. lit l'endpoint `ao_integration_endpoints` du couple (tenant, système) : s'il est
   absent, `paused` ou sans `config.url`, le message est **laissé intact** (aucune
   tentative consommée) ;
3. respecte le **disjoncteur** : `open` (cooldown non écoulé) → message différé ;
4. **réclame** le message (`pending|retrying → inflight`) par update conditionnel :
   seul le worker qui gagne la bascule le traite (sûr en cas d'invocations
   concurrentes) ;
5. appelle le tiers (`POST config.url`, en-tête `Idempotency-Key`), traduit la
   réponse en issue (2xx → succès ; 408/429/5xx/réseau → retriable ; autres 4xx →
   fatal) ;
6. applique la machine de livraison (`delivered` / `retrying`+backoff / `dead`) et
   met à jour le disjoncteur (`recordCircuit`).

La logique pure (`_shared/f5.ts`) est le **miroir Deno** de `src/domain/f5/contract.ts`
(mêmes constantes, mêmes transitions), figée par les vecteurs d'or de `f5.test.ts`
(séquence de backoff `1s,2s,4s,8s` puis lettre morte au 5ᵉ essai).

Réservé au **service_role** (`requireServiceRole`) : un utilisateur authentifié
est refusé (403), car le worker traite tous les tenants.

### Planification (au choix, non imposée sur la base partagée)

Aucune tâche cron n'est déployée automatiquement. Pour l'activer, planifier un
appel HTTP au worker (par ex. toutes les minutes) avec la clé service_role :

```sql
-- pg_cron + pg_net ; stocker la clé dans Vault, ne PAS l'écrire en clair.
select cron.schedule('ao-outbox-drain', '* * * * *', $$
  select net.http_post(
    url     := 'https://<project>.supabase.co/functions/v1/ao-outbox-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    )
  );
$$);
```

Alternative « lourde » (CLAUDE.md §3) : un worker **BullMQ + Redis** côté NestJS
appelant les mêmes fonctions pures — même contrat, autre ordonnanceur.

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
supabase functions deploy ao-passation ao-mandatement ao-integrations ao-outbox-worker
```

Variables injectées par le runtime : `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Aucune clé n'est committée.

## Lint / format

Runtime **Deno** (hors du périmètre ESLint/tsc de l'app, cf. `eslint.config.js`).

```bash
deno lint supabase/functions
deno fmt --check supabase/functions
```
