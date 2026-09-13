-- Atlas Opus — M19 (volet sinistres) : registre des sinistres / déclarations d'assurance.
-- Rattaché (facultativement) à une police (ao_insurances) ; suivi de l'instruction
-- jusqu'à indemnisation ou refus. Opération-scopé : RLS tenant + operation_scope
-- (cohérent 0034).

create table if not exists public.ao_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  insurance_id uuid references public.ao_insurances(id) on delete set null,
  event text not null,
  amount numeric(18,2) not null default 0,
  status text not null default 'declare' check (status in ('declare', 'en_instruction', 'indemnise', 'refuse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_claims_op_idx on public.ao_claims(operation_id);
drop trigger if exists trg_ao_claims_upd on public.ao_claims;
create trigger trg_ao_claims_upd before update on public.ao_claims
  for each row execute function public.ao_set_updated_at();

alter table public.ao_claims enable row level security;
drop policy if exists ao_claims_iso on public.ao_claims;
create policy ao_claims_iso on public.ao_claims
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
