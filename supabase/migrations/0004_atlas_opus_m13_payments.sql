-- Atlas Opus — M13–M15 (chaîne de paiement, MVP). Marchés + décomptes.
-- Net = brut − retenue (Money.ts côté app). Préfixe ao_ ; RLS via user_tenants.
create table if not exists public.ao_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  contractor text not null,
  amount numeric(18,2) not null default 0,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_contracts_op_idx on public.ao_contracts(operation_id);
drop trigger if exists trg_ao_contracts_upd on public.ao_contracts;
create trigger trg_ao_contracts_upd before update on public.ao_contracts
  for each row execute function public.ao_set_updated_at();
alter table public.ao_contracts enable row level security;
drop policy if exists ao_contracts_iso on public.ao_contracts;
create policy ao_contracts_iso on public.ao_contracts
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

create table if not exists public.ao_decomptes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  contract_id uuid not null references public.ao_contracts(id) on delete cascade,
  number int not null,
  amount_gross numeric(18,2) not null default 0,
  retention_rate numeric(5,4) not null default 0.05,
  amount_net numeric(18,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','validated','mandated','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, number)
);
create index if not exists ao_decomptes_op_idx on public.ao_decomptes(operation_id);
create index if not exists ao_decomptes_contract_idx on public.ao_decomptes(contract_id);
drop trigger if exists trg_ao_decomptes_upd on public.ao_decomptes;
create trigger trg_ao_decomptes_upd before update on public.ao_decomptes
  for each row execute function public.ao_set_updated_at();
alter table public.ao_decomptes enable row level security;
drop policy if exists ao_decomptes_iso on public.ao_decomptes;
create policy ao_decomptes_iso on public.ao_decomptes
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
