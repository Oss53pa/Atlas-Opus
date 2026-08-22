-- Atlas Opus — Commercialisation M6 : unités, ventes/baux, encaissements.
-- Les encaissements « settled » alimentent les recettes du bilan (M4, RG-M6-02).
-- Préfixe ao_ ; RLS via public.user_tenants.

create table if not exists public.ao_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  lot_id uuid,
  typology text not null,
  area numeric(18,2) not null default 0,
  price numeric(18,2) not null default 0,
  status text not null default 'disponible' check (status in ('disponible','optionne','reserve','vendu','loue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_units_op_idx on public.ao_units(operation_id);
drop trigger if exists trg_ao_units_upd on public.ao_units;
create trigger trg_ao_units_upd before update on public.ao_units for each row execute function public.ao_set_updated_at();
alter table public.ao_units enable row level security;
drop policy if exists ao_units_iso on public.ao_units;
create policy ao_units_iso on public.ao_units
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

create table if not exists public.ao_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  kind text not null check (kind in ('reservation','lease')),
  unit_id uuid references public.ao_units(id) on delete set null,
  counterpart text not null,
  amount numeric(18,2) not null default 0,
  schedule jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','soldee','resiliee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_sales_op_idx on public.ao_sales(operation_id);
drop trigger if exists trg_ao_sales_upd on public.ao_sales;
create trigger trg_ao_sales_upd before update on public.ao_sales for each row execute function public.ao_set_updated_at();
alter table public.ao_sales enable row level security;
drop policy if exists ao_sales_iso on public.ao_sales;
create policy ao_sales_iso on public.ao_sales
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

create table if not exists public.ao_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.ao_sales(id) on delete cascade,
  amount numeric(18,2) not null default 0,
  method text not null check (method in ('mobile_money','virement')),
  status text not null default 'pending' check (status in ('pending','settled')),
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists ao_receipts_sale_idx on public.ao_receipts(sale_id);
alter table public.ao_receipts enable row level security;
drop policy if exists ao_receipts_iso on public.ao_receipts;
create policy ao_receipts_iso on public.ao_receipts
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
