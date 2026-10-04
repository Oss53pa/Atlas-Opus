-- Atlas Opus — M9/M10 : référentiel fournisseurs et réceptions (transposé
-- d'Advancity). Le fournisseur est rattaché à l'espace (réutilisable entre
-- opérations) ; les bons de commande le citent par supplier_id. Les réceptions
-- (totales ou partielles) alimentent le montant réceptionné et la note de
-- conformité du fournisseur.

create table if not exists public.ao_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text not null check (category in ('travaux', 'fournitures', 'services', 'etudes')),
  contact text,
  email text,
  tax_id text,
  status text not null default 'en_referencement' check (status in ('en_referencement', 'actif', 'ecarte')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create index if not exists ao_suppliers_tenant_idx on public.ao_suppliers(tenant_id);
drop trigger if exists trg_ao_suppliers_upd on public.ao_suppliers;
create trigger trg_ao_suppliers_upd before update on public.ao_suppliers
  for each row execute function public.ao_set_updated_at();
alter table public.ao_suppliers enable row level security;
drop policy if exists ao_suppliers_iso on public.ao_suppliers;
create policy ao_suppliers_iso on public.ao_suppliers
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- Rattachement du bon de commande au référentiel. Nullable : les bons existants
-- gardent leur fournisseur en saisie libre (colonne `supplier`). RESTRICT : un
-- fournisseur déjà commandé ne disparaît pas, il s'écarte.
alter table public.ao_purchase_orders
  add column if not exists supplier_id uuid references public.ao_suppliers(id) on delete restrict;
create index if not exists ao_purchase_orders_supplier_idx on public.ao_purchase_orders(supplier_id);

create table if not exists public.ao_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  purchase_order_id uuid not null references public.ao_purchase_orders(id) on delete cascade,
  date date not null default current_date,
  received_rate numeric(5,4) not null default 1 check (received_rate between 0 and 1),
  conform boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_deliveries_op_idx on public.ao_deliveries(operation_id);
create index if not exists ao_deliveries_po_idx on public.ao_deliveries(purchase_order_id);
drop trigger if exists trg_ao_deliveries_upd on public.ao_deliveries;
create trigger trg_ao_deliveries_upd before update on public.ao_deliveries
  for each row execute function public.ao_set_updated_at();

alter table public.ao_deliveries enable row level security;
drop policy if exists ao_deliveries_iso on public.ao_deliveries;
create policy ao_deliveries_iso on public.ao_deliveries
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
