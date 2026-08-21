-- Atlas Opus — M2 (Intervenants). MVP : type, contact, mission, honoraires sur une
-- seule table (contrat détaillé séparé en V1). Préfixe ao_ ; RLS via user_tenants.
create table if not exists public.ao_stakeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  type text not null check (type in ('moe','amo','bet','ct','csps','notaire','banque','assureur','entreprise','concessionnaire','exploitant','admin')),
  name text not null check (char_length(name) between 2 and 160),
  email text,
  phone text,
  mission text,
  fee_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_stakeholders_op_idx on public.ao_stakeholders(operation_id);
drop trigger if exists trg_ao_stakeholders_upd on public.ao_stakeholders;
create trigger trg_ao_stakeholders_upd before update on public.ao_stakeholders
  for each row execute function public.ao_set_updated_at();

alter table public.ao_stakeholders enable row level security;
drop policy if exists ao_stakeholders_iso on public.ao_stakeholders;
create policy ao_stakeholders_iso on public.ao_stakeholders
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
