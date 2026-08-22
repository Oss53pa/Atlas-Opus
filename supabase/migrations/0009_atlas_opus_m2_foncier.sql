-- Atlas Opus — Dossier foncier M2 : parcelles & titres.
-- Machine d'acquisition prospection → sous_promesse → conditions_levees → acquis.
-- Préfixe ao_ ; RLS via public.user_tenants.

create table if not exists public.ao_land_parcels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  area numeric(18,2) not null default 0,
  tenure_type text not null check (tenure_type in ('titre_foncier','bail_emphyteotique','droit_coutumier','concession')),
  price numeric(18,2) not null default 0,
  acquisition_status text not null default 'prospection' check (acquisition_status in ('prospection','sous_promesse','conditions_levees','acquis')),
  notary text,
  suspensive_conditions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_land_parcels_op_idx on public.ao_land_parcels(operation_id);
drop trigger if exists trg_ao_land_parcels_upd on public.ao_land_parcels;
create trigger trg_ao_land_parcels_upd before update on public.ao_land_parcels
  for each row execute function public.ao_set_updated_at();

alter table public.ao_land_parcels enable row level security;
drop policy if exists ao_land_parcels_iso on public.ao_land_parcels;
create policy ao_land_parcels_iso on public.ao_land_parcels
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

create table if not exists public.ao_title_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parcel_id uuid not null references public.ao_land_parcels(id) on delete cascade,
  doc_type text not null check (doc_type in ('titre_foncier','acte_notarie','certificat','bornage')),
  reference text not null,
  status text not null default 'pending' check (status in ('pending','verified')),
  file_ref text,
  created_at timestamptz not null default now()
);
create index if not exists ao_title_documents_parcel_idx on public.ao_title_documents(parcel_id);

alter table public.ao_title_documents enable row level security;
drop policy if exists ao_title_documents_iso on public.ao_title_documents;
create policy ao_title_documents_iso on public.ao_title_documents
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
