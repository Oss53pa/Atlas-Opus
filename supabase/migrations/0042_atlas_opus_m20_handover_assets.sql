-- Atlas Opus — M20 (passation→exploitation) : inventaire des ouvrages/actifs à
-- transférer à l'exploitant. Suivi de garantie (GPA) + système d'exploitation
-- cible. Opération-scopé : RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_handover_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  label text not null,
  asset_type text not null check (asset_type in ('equipement', 'reseau', 'batiment', 'espace_vert', 'autre')),
  location text,
  warranty_end date,
  target_system text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_handover_assets_op_idx on public.ao_handover_assets(operation_id);
drop trigger if exists trg_ao_handover_assets_upd on public.ao_handover_assets;
create trigger trg_ao_handover_assets_upd before update on public.ao_handover_assets
  for each row execute function public.ao_set_updated_at();

alter table public.ao_handover_assets enable row level security;
drop policy if exists ao_handover_assets_iso on public.ao_handover_assets;
create policy ao_handover_assets_iso on public.ao_handover_assets
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
