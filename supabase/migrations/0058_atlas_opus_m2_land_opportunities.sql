-- Atlas Opus — M2 (amont) : pipeline d'opportunités foncières (transposé
-- d'Advancity, module « Opportunités foncières »). Terrains repérés, qualifiés et
-- arbitrés AVANT la création de l'opération. Niveau espace : operation_id n'est
-- renseigné qu'à la conversion, une seule fois (garde applicative + null au départ).
-- RLS tenant + operation_scope quand l'opportunité est liée (cohérent 0034/0052).

create table if not exists public.ao_land_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.ao_operations(id) on delete set null,
  reference text not null,
  name text not null,
  property_type text not null check (property_type in ('terrain_nu', 'terrain_viabilise', 'batiment_existant', 'friche', 'copropriete')),
  country_code text not null,
  city text,
  total_surface numeric(12,2) not null default 0 check (total_surface >= 0),
  buildable_surface numeric(12,2) not null default 0 check (buildable_surface >= 0),
  price_asked numeric(18,2) not null default 0,
  estimated_value numeric(18,2) not null default 0,
  status text not null default 'prospection' check (status in ('prospection', 'etude', 'negociation', 'sous_conditions', 'acquise', 'abandonnee')),
  decision text not null default 'pending' check (decision in ('pending', 'go', 'conditional_go', 'no_go', 'postponed')),
  probability numeric(5,4) not null default 0.5 check (probability between 0 and 1),
  discovery_date date not null default current_date,
  decision_deadline date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference)
);
create index if not exists ao_land_opportunities_tenant_idx on public.ao_land_opportunities(tenant_id);
drop trigger if exists trg_ao_land_opportunities_upd on public.ao_land_opportunities;
create trigger trg_ao_land_opportunities_upd before update on public.ao_land_opportunities
  for each row execute function public.ao_set_updated_at();

alter table public.ao_land_opportunities enable row level security;
drop policy if exists ao_land_opportunities_iso on public.ao_land_opportunities;
create policy ao_land_opportunities_iso on public.ao_land_opportunities
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
