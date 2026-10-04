-- Atlas Opus — M19 (HSSE) : indicateurs réglementaires. Spec M19 §6 « HSSE :
-- incidents, inspections, taux de fréquence » ; transposé d'Advancity.
--   * ao_hsse_incidents.days_lost : journées d'arrêt (numérateur du taux de gravité ;
--     un accident avec arrêt = days_lost > 0, numérateur du taux de fréquence).
--   * ao_hsse_inspections : visites de sécurité ; chaque visite déclare les heures
--     travaillées de la période (dénominateur des deux taux).
-- Additif : colonne à défaut 0, nouvelle table. Opération-scopé : RLS tenant +
-- operation_scope (cohérent 0034).

alter table public.ao_hsse_incidents
  add column if not exists days_lost int not null default 0 check (days_lost >= 0);

create table if not exists public.ao_hsse_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  date date not null,
  title text not null,
  score int not null check (score between 0 and 100),
  hours_worked bigint not null default 0 check (hours_worked >= 0),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_hsse_inspections_op_idx on public.ao_hsse_inspections(operation_id);
drop trigger if exists trg_ao_hsse_inspections_upd on public.ao_hsse_inspections;
create trigger trg_ao_hsse_inspections_upd before update on public.ao_hsse_inspections
  for each row execute function public.ao_set_updated_at();

alter table public.ao_hsse_inspections enable row level security;
drop policy if exists ao_hsse_inspections_iso on public.ao_hsse_inspections;
create policy ao_hsse_inspections_iso on public.ao_hsse_inspections
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
