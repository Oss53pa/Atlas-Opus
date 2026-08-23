-- Atlas Opus — Cautions & garanties M17 : garanties bancaires.
-- Statut persisté active → liberee | appelee ; l'échéance (expiree/expiring) est
-- dérivée côté domaine. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_guarantees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  type text not null check (type in ('restitution_avance','bonne_execution','retenue_garantie','soumission')),
  issuer text not null,
  amount numeric(18,2) not null default 0,
  valid_from date not null,
  valid_until date,
  status text not null default 'active' check (status in ('active','liberee','appelee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_guarantees_op_idx on public.ao_guarantees(operation_id);
drop trigger if exists trg_ao_guarantees_upd on public.ao_guarantees;
create trigger trg_ao_guarantees_upd before update on public.ao_guarantees
  for each row execute function public.ao_set_updated_at();

alter table public.ao_guarantees enable row level security;
drop policy if exists ao_guarantees_iso on public.ao_guarantees;
create policy ao_guarantees_iso on public.ao_guarantees
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
