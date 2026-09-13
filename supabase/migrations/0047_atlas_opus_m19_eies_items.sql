-- Atlas Opus — M19 (environnement & social) : registre d'impacts EIES. Impacts
-- environnementaux/sociaux identifiés et mesures d'atténuation. Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_eies_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  impact text not null,
  milieu text not null check (milieu in ('physique', 'biologique', 'humain', 'socio_economique')),
  severity text not null check (severity in ('faible', 'moyenne', 'forte', 'critique')),
  mesure_attenuation text,
  status text not null default 'planifiee' check (status in ('planifiee', 'en_cours', 'mise_en_oeuvre', 'soldee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_eies_items_op_idx on public.ao_eies_items(operation_id);
drop trigger if exists trg_ao_eies_items_upd on public.ao_eies_items;
create trigger trg_ao_eies_items_upd before update on public.ao_eies_items
  for each row execute function public.ao_set_updated_at();

alter table public.ao_eies_items enable row level security;
drop policy if exists ao_eies_items_iso on public.ao_eies_items;
create policy ao_eies_items_iso on public.ao_eies_items
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
