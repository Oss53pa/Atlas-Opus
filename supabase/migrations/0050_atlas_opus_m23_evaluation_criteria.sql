-- Atlas Opus — M23 (analyse & dépouillement) : grille de critères pondérés.
-- Critères d'évaluation d'une consultation et leur poids (fraction 0..1).
-- context_id : consultation/DAO rattaché (optionnel). Opération-scopé :
-- RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  context_id uuid,
  label text not null,
  type text not null check (type in ('technique', 'financier', 'administratif', 'delai')),
  weight numeric(5,4) not null default 0 check (weight >= 0 and weight <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_evaluation_criteria_op_idx on public.ao_evaluation_criteria(operation_id);
drop trigger if exists trg_ao_evaluation_criteria_upd on public.ao_evaluation_criteria;
create trigger trg_ao_evaluation_criteria_upd before update on public.ao_evaluation_criteria
  for each row execute function public.ao_set_updated_at();

alter table public.ao_evaluation_criteria enable row level security;
drop policy if exists ao_evaluation_criteria_iso on public.ao_evaluation_criteria;
create policy ao_evaluation_criteria_iso on public.ao_evaluation_criteria
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
