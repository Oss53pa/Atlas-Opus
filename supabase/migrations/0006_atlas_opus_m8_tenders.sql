-- Atlas Opus — M8 (Passation, MVP). Appels d'offres. Préfixe ao_ ; RLS user_tenants.
create table if not exists public.ao_tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  mode text not null default 'private' check (mode in ('private','public')),
  procedure text check (procedure in ('AOO','AOR','consultation','gre_a_gre')),
  object text not null check (char_length(object) between 2 and 200),
  threshold_ok boolean,
  ano_required boolean not null default false,
  status text not null default 'planned' check (status in ('planned','published','opened','evaluated','awarded','notified')),
  awarded_to uuid references public.ao_stakeholders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_tenders_op_idx on public.ao_tenders(operation_id);
drop trigger if exists trg_ao_tenders_upd on public.ao_tenders;
create trigger trg_ao_tenders_upd before update on public.ao_tenders
  for each row execute function public.ao_set_updated_at();
alter table public.ao_tenders enable row level security;
drop policy if exists ao_tenders_iso on public.ao_tenders;
create policy ao_tenders_iso on public.ao_tenders
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
