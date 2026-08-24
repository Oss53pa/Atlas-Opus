-- Atlas Opus — Administration transverse (F1/F4/F7) : membres, notifications,
-- boîte d'approbations. Scoping tenant (pas d'opération). Préfixe ao_ ; RLS par tenant.

-- ── Membres & rôles (F1) ────────────────────────────────────────────────────
create table if not exists public.ao_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null,
  scope text not null default 'toutes opérations',
  status text not null default 'actif' check (status in ('actif','en_attente','suspendu')),
  last_activity text,
  created_at timestamptz not null default now()
);
create index if not exists ao_members_tenant_idx on public.ao_members(tenant_id);
alter table public.ao_members enable row level security;
drop policy if exists ao_members_iso on public.ao_members;
create policy ao_members_iso on public.ao_members
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- ── Notifications (F4) ──────────────────────────────────────────────────────
create table if not exists public.ao_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  severity text not null check (severity in ('danger','echeance','info')),
  title text not null,
  context text not null default '',
  at timestamptz not null default now(),
  read boolean not null default false
);
create index if not exists ao_notifications_tenant_idx on public.ao_notifications(tenant_id);
alter table public.ao_notifications enable row level security;
drop policy if exists ao_notifications_iso on public.ao_notifications;
create policy ao_notifications_iso on public.ao_notifications
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- ── Boîte d'approbations (F7) ───────────────────────────────────────────────
create table if not exists public.ao_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module text not null,
  object text not null,
  detail text not null default '',
  amount numeric(18,2) not null default 0,
  status text not null check (status in ('a_valider','a_arbitrer','a_decider','visa_moe')),
  required_role text not null,
  for_me boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ao_approvals_tenant_idx on public.ao_approvals(tenant_id);
alter table public.ao_approvals enable row level security;
drop policy if exists ao_approvals_iso on public.ao_approvals;
create policy ao_approvals_iso on public.ao_approvals
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
