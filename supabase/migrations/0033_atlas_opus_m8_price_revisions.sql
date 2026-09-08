-- Atlas Opus — M8 (v4.1) : révisions de prix des marchés.
-- montant_revise = montant_base × (a0 + Σ aᵢ·Iᵢ/Iᵢ₀). Le coefficient et le montant
-- révisé sont calculés en TypeScript (F6 / Money.ts, invariant §5) et figés ici.
-- Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_price_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  contract_id uuid not null references public.ao_contracts(id) on delete cascade,
  base_amount numeric(18,2) not null default 0,
  a0 numeric(9,6) not null default 0,
  terms jsonb not null default '[]'::jsonb,
  coefficient numeric(12,6) not null default 1,
  revised_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ao_price_revisions_op_idx on public.ao_price_revisions(operation_id);
create index if not exists ao_price_revisions_contract_idx on public.ao_price_revisions(contract_id);

alter table public.ao_price_revisions enable row level security;
drop policy if exists ao_price_revisions_iso on public.ao_price_revisions;
create policy ao_price_revisions_iso on public.ao_price_revisions
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
