-- Atlas Opus — Maîtrise des modifications M15 (change control) : ordres de modification.
-- Machine requested → under_review → arbitrated → approved | rejected ; approved → converted.
-- impact_cost signé (±), impact_days signé. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  contract_id uuid references public.ao_contracts(id) on delete set null,
  origin text not null check (origin in ('moa','moe','entreprise','reglementaire','aleas')),
  description text not null,
  impact_cost numeric(18,2) not null default 0,
  impact_days integer not null default 0,
  impact_quality text,
  impact_analyzed boolean not null default false,
  status text not null default 'requested' check (status in ('requested','under_review','arbitrated','approved','rejected','converted')),
  avenant_ref text,
  decided_by text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_change_orders_op_idx on public.ao_change_orders(operation_id);
drop trigger if exists trg_ao_change_orders_upd on public.ao_change_orders;
create trigger trg_ao_change_orders_upd before update on public.ao_change_orders
  for each row execute function public.ao_set_updated_at();

alter table public.ao_change_orders enable row level security;
drop policy if exists ao_change_orders_iso on public.ao_change_orders;
create policy ao_change_orders_iso on public.ao_change_orders
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
