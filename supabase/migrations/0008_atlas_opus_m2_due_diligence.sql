-- Atlas Opus — Garde M1 : due diligence foncière/juridique (M2, RG-M2-03).
-- Un item « critical »/« high » non « cleared » bloque amont → conception.
-- Alimente getTransitionContext (ddCleared). Préfixe ao_ ; RLS via public.user_tenants.

create table if not exists public.ao_due_diligence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  category text not null check (category in ('servitude','litige','hypotheque','bornage','conformite')),
  finding text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_dd_op_idx on public.ao_due_diligence_items(operation_id);
drop trigger if exists trg_ao_dd_upd on public.ao_due_diligence_items;
create trigger trg_ao_dd_upd before update on public.ao_due_diligence_items
  for each row execute function public.ao_set_updated_at();

alter table public.ao_due_diligence_items enable row level security;
drop policy if exists ao_dd_iso on public.ao_due_diligence_items;
create policy ao_dd_iso on public.ao_due_diligence_items
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
