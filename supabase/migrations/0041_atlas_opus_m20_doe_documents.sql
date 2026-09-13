-- Atlas Opus — M20 (passation→exploitation, DOE) : Dossier des Ouvrages Exécutés.
-- Complétude documentaire remise à l'exploitant à la bascule. Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_doe_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  category text not null check (category in (
    'plans_recolement', 'notices_exploitation', 'garanties', 'attestations',
    'pv_essais', 'dossier_maintenance', 'autre')),
  file_ref text,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_doe_documents_op_idx on public.ao_doe_documents(operation_id);
drop trigger if exists trg_ao_doe_documents_upd on public.ao_doe_documents;
create trigger trg_ao_doe_documents_upd before update on public.ao_doe_documents
  for each row execute function public.ao_set_updated_at();

alter table public.ao_doe_documents enable row level security;
drop policy if exists ao_doe_documents_iso on public.ao_doe_documents;
create policy ao_doe_documents_iso on public.ao_doe_documents
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
