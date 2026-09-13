-- Atlas Opus — M12 (planning) : baselines de référence. Instantané figé des
-- tâches (jsonb) servant de repère pour mesurer le dérapage. Une seule baseline
-- active par opération. Opération-scopé : RLS tenant + operation_scope (0034).

create table if not exists public.ao_baselines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  label text not null,
  snapshot jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ao_baselines_op_idx on public.ao_baselines(operation_id);
-- Au plus une baseline active par opération.
create unique index if not exists ao_baselines_active_uq
  on public.ao_baselines(operation_id) where is_active;

alter table public.ao_baselines enable row level security;
drop policy if exists ao_baselines_iso on public.ao_baselines;
create policy ao_baselines_iso on public.ao_baselines
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
