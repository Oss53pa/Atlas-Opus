-- Atlas Opus — Documents / GED transverse M22 : bibliothèque documentaire.
-- Cycle brouillon → publie → archive. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_doc_library (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  name text not null,
  category text not null check (category in ('contrat','administratif','financier','technique','correspondance')),
  reference text not null default '',
  version integer not null default 1,
  status text not null default 'brouillon' check (status in ('brouillon','publie','archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_doc_library_op_idx on public.ao_doc_library(operation_id);
drop trigger if exists trg_ao_doc_library_upd on public.ao_doc_library;
create trigger trg_ao_doc_library_upd before update on public.ao_doc_library
  for each row execute function public.ao_set_updated_at();

alter table public.ao_doc_library enable row level security;
drop policy if exists ao_doc_library_iso on public.ao_doc_library;
create policy ao_doc_library_iso on public.ao_doc_library
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
