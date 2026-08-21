-- Atlas Opus — M12 (Planning, MVP). Tâches datées + jalons. Préfixe ao_ ; RLS user_tenants.
create table if not exists public.ao_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  start_date date,
  end_date date,
  is_milestone boolean not null default false,
  is_critical boolean not null default false,
  progress numeric(5,4) not null default 0 check (progress >= 0 and progress <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ao_tasks_end_after_start check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists ao_tasks_op_idx on public.ao_tasks(operation_id);
drop trigger if exists trg_ao_tasks_upd on public.ao_tasks;
create trigger trg_ao_tasks_upd before update on public.ao_tasks
  for each row execute function public.ao_set_updated_at();
alter table public.ao_tasks enable row level security;
drop policy if exists ao_tasks_iso on public.ao_tasks;
create policy ao_tasks_iso on public.ao_tasks
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
