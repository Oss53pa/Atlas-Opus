-- Atlas Opus — Conception & GED M11 : documents & visas.
-- Machine en_cours → diffuse → vise_a | vise_b | vise_c. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  title text not null,
  discipline text not null check (discipline in ('architecture','structure','fluides','vrd','electricite','autre')),
  indice text not null default 'A',
  status text not null default 'en_cours' check (status in ('en_cours','diffuse','vise_a','vise_b','vise_c')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_documents_op_idx on public.ao_documents(operation_id);
drop trigger if exists trg_ao_documents_upd on public.ao_documents;
create trigger trg_ao_documents_upd before update on public.ao_documents
  for each row execute function public.ao_set_updated_at();

alter table public.ao_documents enable row level security;
drop policy if exists ao_documents_iso on public.ao_documents;
create policy ao_documents_iso on public.ao_documents
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
