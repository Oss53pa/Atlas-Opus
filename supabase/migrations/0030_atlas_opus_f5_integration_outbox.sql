-- Atlas Opus — F5 Intégrations : configuration des systèmes tiers + outbox.
-- Deux propriétés du contrat (gate CDC) matérialisées en base :
--   · idempotence  → contrainte unique (tenant_id, idempotency_key) sur l'outbox ;
--   · panne gérée  → statut de reprise, backoff (next_attempt_at), lettre morte,
--                    disjoncteur porté par ao_integration_endpoints.
-- Préfixe ao_ ; RLS par tenant. Insertion/mise à jour de statut ; aucune suppression.

-- ── Endpoints (config + disjoncteur par système) ────────────────────────────
create table if not exists public.ao_integration_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system text not null check (system in ('atlas_finance','advist','cinetpay','atlas_lease','keystone','duedeck')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','paused')),
  circuit_state text not null default 'closed' check (circuit_state in ('closed','open','half_open')),
  circuit_failures integer not null default 0,
  circuit_opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, system)
);
alter table public.ao_integration_endpoints enable row level security;
drop policy if exists ao_integration_endpoints_iso on public.ao_integration_endpoints;
create policy ao_integration_endpoints_iso on public.ao_integration_endpoints
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- ── Outbox (intentions sortantes, idempotentes et rejouables) ───────────────
create table if not exists public.ao_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.ao_operations(id) on delete cascade,
  system text not null check (system in ('atlas_finance','advist','cinetpay','atlas_lease','keystone','duedeck')),
  kind text not null,
  business_id text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending','inflight','delivered','retrying','dead')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  -- Idempotence : une même intention (tenant + clé) n'existe qu'une fois.
  unique (tenant_id, idempotency_key)
);
create index if not exists ao_outbox_due_idx on public.ao_outbox(status, next_attempt_at);
create index if not exists ao_outbox_tenant_idx on public.ao_outbox(tenant_id);

alter table public.ao_outbox enable row level security;
drop policy if exists ao_outbox_select on public.ao_outbox;
create policy ao_outbox_select on public.ao_outbox
  for select using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
drop policy if exists ao_outbox_insert on public.ao_outbox;
create policy ao_outbox_insert on public.ao_outbox
  for insert with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
-- Mise à jour restreinte au statut de livraison (progression outbox), même tenant.
drop policy if exists ao_outbox_update on public.ao_outbox;
create policy ao_outbox_update on public.ao_outbox
  for update using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
