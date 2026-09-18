-- Atlas Opus — M8 (passation) : Bordereau de Prix Unitaires (BPU). Lignes de prix
-- unitaires rattachées à un marché (ao_contracts). Montant numeric(18,2) (jamais
-- flottant). Marché-scopée : RLS tenant seul (le périmètre opération est porté
-- par le marché parent ; pas d'operation_id → hors MT8, cohérent 0034).

create table if not exists public.ao_bpu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.ao_contracts(id) on delete cascade,
  code text not null,
  label text not null,
  unit text not null,
  unit_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_bpu_items_contract_idx on public.ao_bpu_items(contract_id);
drop trigger if exists trg_ao_bpu_items_upd on public.ao_bpu_items;
create trigger trg_ao_bpu_items_upd before update on public.ao_bpu_items
  for each row execute function public.ao_set_updated_at();

alter table public.ao_bpu_items enable row level security;
drop policy if exists ao_bpu_items_iso on public.ao_bpu_items;
create policy ao_bpu_items_iso on public.ao_bpu_items
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
