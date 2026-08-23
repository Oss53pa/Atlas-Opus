-- Atlas Opus — Achats & logistique M10 : bons de commande & réceptions.
-- Machine brouillon → commande → livre → receptionne. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  supplier text not null,
  item text not null,
  quantity numeric(18,2) not null default 0,
  unit text not null default 'u',
  amount numeric(18,2) not null default 0,
  status text not null default 'brouillon' check (status in ('brouillon','commande','livre','receptionne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_purchase_orders_op_idx on public.ao_purchase_orders(operation_id);
drop trigger if exists trg_ao_purchase_orders_upd on public.ao_purchase_orders;
create trigger trg_ao_purchase_orders_upd before update on public.ao_purchase_orders
  for each row execute function public.ao_set_updated_at();

alter table public.ao_purchase_orders enable row level security;
drop policy if exists ao_purchase_orders_iso on public.ao_purchase_orders;
create policy ao_purchase_orders_iso on public.ao_purchase_orders
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
