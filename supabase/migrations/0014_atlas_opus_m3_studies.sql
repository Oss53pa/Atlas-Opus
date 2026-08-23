-- Atlas Opus — Études amont M3 : diagnostics & études préalables.
-- Machine planifiee → en_cours → remise → validee. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_studies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  kind text not null check (kind in ('geotechnique','environnementale','programmatique','topographique','hydraulique','autre')),
  provider text not null,
  status text not null default 'planifiee' check (status in ('planifiee','en_cours','remise','validee')),
  cost numeric(18,2) not null default 0,
  due_date date,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_studies_op_idx on public.ao_studies(operation_id);
drop trigger if exists trg_ao_studies_upd on public.ao_studies;
create trigger trg_ao_studies_upd before update on public.ao_studies
  for each row execute function public.ao_set_updated_at();

alter table public.ao_studies enable row level security;
drop policy if exists ao_studies_iso on public.ao_studies;
create policy ao_studies_iso on public.ao_studies
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
