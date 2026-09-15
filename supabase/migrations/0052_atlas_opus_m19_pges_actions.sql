-- Atlas Opus — M19 (environnement & social) : Plan de Gestion E&S (PGES).
-- Actions de gestion/atténuation avec responsable, échéance et indicateur de
-- suivi. Complète le registre EIES. Opération-scopé : RLS tenant + operation_scope
-- (cohérent 0034).

create table if not exists public.ao_pges_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  action text not null,
  responsable text not null default '',
  echeance date,
  indicateur text,
  status text not null default 'ouvert' check (status in ('ouvert', 'en_cours', 'soldee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_pges_actions_op_idx on public.ao_pges_actions(operation_id);
drop trigger if exists trg_ao_pges_actions_upd on public.ao_pges_actions;
create trigger trg_ao_pges_actions_upd before update on public.ao_pges_actions
  for each row execute function public.ao_set_updated_at();

alter table public.ao_pges_actions enable row level security;
drop policy if exists ao_pges_actions_iso on public.ao_pges_actions;
create policy ao_pges_actions_iso on public.ao_pges_actions
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
