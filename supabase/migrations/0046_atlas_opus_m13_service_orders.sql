-- Atlas Opus — M13/M15 : ordres de service (OS). Instrument MOA notifié à
-- l'entreprise (démarrage, arrêt, reprise, notification). Lien optionnel au
-- marché (ao_contracts). Opération-scopé : RLS tenant + operation_scope (0034).

create table if not exists public.ao_service_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  contract_id uuid references public.ao_contracts(id) on delete set null,
  type text not null check (type in ('demarrage', 'arret', 'reprise', 'notification', 'autre')),
  reference text not null,
  content text not null,
  status text not null default 'projet' check (status in ('projet', 'emis', 'notifie', 'annule')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_service_orders_op_idx on public.ao_service_orders(operation_id);
create index if not exists ao_service_orders_contract_idx on public.ao_service_orders(contract_id);
drop trigger if exists trg_ao_service_orders_upd on public.ao_service_orders;
create trigger trg_ao_service_orders_upd before update on public.ao_service_orders
  for each row execute function public.ao_set_updated_at();

alter table public.ao_service_orders enable row level security;
drop policy if exists ao_service_orders_iso on public.ao_service_orders;
create policy ao_service_orders_iso on public.ao_service_orders
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
