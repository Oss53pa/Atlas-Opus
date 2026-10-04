-- Atlas Opus — M18 (volet qualité) : registre des non-conformités (transposé
-- du module Qualité d'Advancity). Écart constaté par rapport au référentiel,
-- distinct de la réserve de réception (ao_reserves) et de l'incident HSSE
-- (ao_hsse_incidents). RG-NC-02 : le solde exige une action corrective — garde
-- applicative (domaine + adaptateurs), la colonne reste nullable tant que la NC
-- n'est pas soldée. Opération-scopé : RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_non_conformities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  label text not null,
  source text not null check (source in ('chantier', 'fournisseur', 'etude', 'audit', 'client')),
  severity text not null check (severity in ('mineure', 'majeure', 'critique')),
  location text,
  corrective_action text,
  owner text,
  detected_at date not null default current_date,
  due_date date,
  closed_at date,
  status text not null default 'ouverte' check (status in ('ouverte', 'en_traitement', 'soldee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une NC soldée porte toujours son action corrective (RG-NC-02).
  constraint ao_nc_soldee_action check (status <> 'soldee' or corrective_action is not null)
);
create index if not exists ao_non_conformities_op_idx on public.ao_non_conformities(operation_id);
drop trigger if exists trg_ao_non_conformities_upd on public.ao_non_conformities;
create trigger trg_ao_non_conformities_upd before update on public.ao_non_conformities
  for each row execute function public.ao_set_updated_at();

alter table public.ao_non_conformities enable row level security;
drop policy if exists ao_non_conformities_iso on public.ao_non_conformities;
create policy ao_non_conformities_iso on public.ao_non_conformities
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
