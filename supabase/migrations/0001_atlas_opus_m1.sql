-- Atlas Opus — M1 (Opération & Programme).
-- Appliquée au projet partagé « ATLAS STUDIO — SCHEMA COMPLET » (vgtmljfayiysuvrcmunt).
-- Tables préfixées ao_ pour cohabiter avec le schéma existant ; RLS basée sur la
-- tenancy partagée (public.user_tenants). Réf : Spec M1 §3/§4.

create or replace function public.ao_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── ao_operations (Spec M1 §3.1) ────────────────────────────────────────────
create table if not exists public.ao_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  country_code char(2) not null,
  name text not null check (char_length(name) between 3 and 120),
  op_type text not null default 'commercial' check (op_type in ('residential','commercial','public','mixed')),
  procurement_mode text not null default 'private' check (procurement_mode in ('private','public')),
  phase text not null default 'amont' check (phase in ('amont','conception','passation','realisation','reception','exploitation','cloture')),
  currency char(3) not null,
  budget_bac numeric(18,2) not null default 0 check (budget_bac >= 0),
  retention_rate numeric(5,4) not null default 0.05 check (retention_rate >= 0 and retention_rate <= 1),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ao_operations_end_after_start check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists ao_operations_tenant_idx on public.ao_operations(tenant_id);
create unique index if not exists ao_operations_tenant_name_key on public.ao_operations(tenant_id, lower(name));
drop trigger if exists trg_ao_operations_upd on public.ao_operations;
create trigger trg_ao_operations_upd before update on public.ao_operations
  for each row execute function public.ao_set_updated_at();

alter table public.ao_operations enable row level security;
drop policy if exists ao_operations_iso on public.ao_operations;
create policy ao_operations_iso on public.ao_operations
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- ── ao_program_items (Spec M1 §3.2) ─────────────────────────────────────────
create table if not exists public.ao_program_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  category text not null check (category in ('surface','usage','exigence_fonctionnelle','exigence_technique','exigence_env')),
  label text not null check (char_length(label) between 2 and 160),
  target_value text,
  unit text,
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft','validated')),
  covered boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_program_items_op_version_idx on public.ao_program_items(operation_id, version);
drop trigger if exists trg_ao_program_items_upd on public.ao_program_items;
create trigger trg_ao_program_items_upd before update on public.ao_program_items
  for each row execute function public.ao_set_updated_at();

alter table public.ao_program_items enable row level security;
drop policy if exists ao_program_items_iso on public.ao_program_items;
create policy ao_program_items_iso on public.ao_program_items
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
