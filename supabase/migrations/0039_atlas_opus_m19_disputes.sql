-- Atlas Opus — M19 (volet litiges) : registre des litiges & contentieux.
-- Différends avec des tiers (objet, contrepartie, montant en jeu, réf dossier),
-- distinct des réserves (ao_reserves) et des risques (ao_risks). Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  counterpart text not null,
  object text not null,
  amount_at_stake numeric(18,2) not null default 0,
  file_ref text,
  status text not null default 'ouvert' check (status in ('ouvert', 'en_cours', 'transige', 'clos')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_disputes_op_idx on public.ao_disputes(operation_id);
drop trigger if exists trg_ao_disputes_upd on public.ao_disputes;
create trigger trg_ao_disputes_upd before update on public.ao_disputes
  for each row execute function public.ao_set_updated_at();

alter table public.ao_disputes enable row level security;
drop policy if exists ao_disputes_iso on public.ao_disputes;
create policy ao_disputes_iso on public.ao_disputes
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
