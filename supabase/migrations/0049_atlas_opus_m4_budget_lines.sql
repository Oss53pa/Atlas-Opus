-- Atlas Opus — M4/M5 (bilan & financement) : lignes budgétaires. Budget autorisé
-- de crédit (BAC) par compte SYSCOHADA. Montant numeric(18,2) (jamais flottant).
-- Opération-scopé : RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_budget_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  syscohada_account text not null,
  label text not null,
  amount_bac numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_budget_lines_op_idx on public.ao_budget_lines(operation_id);
drop trigger if exists trg_ao_budget_lines_upd on public.ao_budget_lines;
create trigger trg_ao_budget_lines_upd before update on public.ao_budget_lines
  for each row execute function public.ao_set_updated_at();

alter table public.ao_budget_lines enable row level security;
drop policy if exists ao_budget_lines_iso on public.ao_budget_lines;
create policy ao_budget_lines_iso on public.ao_budget_lines
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
