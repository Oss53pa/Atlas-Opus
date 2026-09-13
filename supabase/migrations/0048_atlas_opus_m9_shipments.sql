-- Atlas Opus — M9 (achats/appro/logistique) : expéditions & dédouanement. Suivi
-- logistique d'un approvisionnement (incoterm, statut douanier, ETA, réception).
-- Lien optionnel au bon de commande (ao_purchase_orders). Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  po_id uuid references public.ao_purchase_orders(id) on delete set null,
  reference text not null,
  incoterm text check (incoterm in ('EXW', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  customs_status text not null default 'en_attente' check (customs_status in ('en_attente', 'en_transit', 'en_douane', 'dedouane', 'livre')),
  eta date,
  received_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_shipments_op_idx on public.ao_shipments(operation_id);
create index if not exists ao_shipments_po_idx on public.ao_shipments(po_id);
drop trigger if exists trg_ao_shipments_upd on public.ao_shipments;
create trigger trg_ao_shipments_upd before update on public.ao_shipments
  for each row execute function public.ao_set_updated_at();

alter table public.ao_shipments enable row level security;
drop policy if exists ao_shipments_iso on public.ao_shipments;
create policy ao_shipments_iso on public.ao_shipments
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
