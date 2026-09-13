-- Atlas Opus — M2 (foncier & montage juridique) : structure juridique de portage
-- (SPV). Forme OHADA, RCCM, répartition du capital (jsonb). Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_legal_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  structure_type text not null check (structure_type in ('sci', 'sarl', 'sa', 'sas', 'gie', 'snc', 'autre')),
  name text not null,
  rccm text,
  shareholders jsonb not null default '[]'::jsonb,
  status text not null default 'projet' check (status in ('projet', 'constituee', 'active', 'dissoute')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_legal_entities_op_idx on public.ao_legal_entities(operation_id);
drop trigger if exists trg_ao_legal_entities_upd on public.ao_legal_entities;
create trigger trg_ao_legal_entities_upd before update on public.ao_legal_entities
  for each row execute function public.ao_set_updated_at();

alter table public.ao_legal_entities enable row level security;
drop policy if exists ao_legal_entities_iso on public.ao_legal_entities;
create policy ao_legal_entities_iso on public.ao_legal_entities
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
