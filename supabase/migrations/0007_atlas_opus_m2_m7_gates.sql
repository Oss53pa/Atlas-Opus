-- Atlas Opus — Gardes M1 : autorisations (M2, RG-M2-07) & assurances (M7, RG-M7-04).
-- Alimentent getTransitionContext (permitGranted, doInsuranceValid) pour la
-- transition passation → réalisation. Préfixe ao_ ; RLS via public.user_tenants.

-- Autorisations administratives (M2 §3/§4). Machine draft→submitted→granted|refused.
create table if not exists public.ao_authorizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  type text not null check (type in ('permis_construire','autorisation_env','conformite')),
  authority text not null,
  status text not null default 'draft' check (status in ('draft','submitted','granted','refused')),
  validity date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_authorizations_op_idx on public.ao_authorizations(operation_id);
drop trigger if exists trg_ao_authorizations_upd on public.ao_authorizations;
create trigger trg_ao_authorizations_upd before update on public.ao_authorizations
  for each row execute function public.ao_set_updated_at();

alter table public.ao_authorizations enable row level security;
drop policy if exists ao_authorizations_iso on public.ao_authorizations;
create policy ao_authorizations_iso on public.ao_authorizations
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- Assurances (M7 §3). Rattachées à un intervenant ; la DO au niveau opération
-- est portée par un intervenant de type opération/assureur (operation_id requis
-- ici pour la garde). Statut dérivé côté domaine (valid/expiring/expired).
create table if not exists public.ao_insurances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  stakeholder_id uuid references public.ao_stakeholders(id) on delete set null,
  type text not null check (type in ('DO','decennale','RC','TRC','RC_pro')),
  insurer text not null,
  valid_from date not null,
  valid_to date,
  attestation_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_insurances_op_idx on public.ao_insurances(operation_id);
drop trigger if exists trg_ao_insurances_upd on public.ao_insurances;
create trigger trg_ao_insurances_upd before update on public.ao_insurances
  for each row execute function public.ao_set_updated_at();

alter table public.ao_insurances enable row level security;
drop policy if exists ao_insurances_iso on public.ao_insurances;
create policy ao_insurances_iso on public.ao_insurances
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
