-- Atlas Opus — Reporting M21 : snapshots datés & conservés (RG-M21-03).
-- Le snapshot fige les indicateurs (jsonb) ; aucun recalcul (RG-M21-01).
-- Préfixe ao_ ; RLS via public.user_tenants.

create table if not exists public.ao_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  type text not null check (type in ('hebdo','mensuel','deep_dive')),
  period text not null,
  data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
create index if not exists ao_report_snapshots_op_idx on public.ao_report_snapshots(operation_id);

alter table public.ao_report_snapshots enable row level security;
drop policy if exists ao_report_snapshots_iso on public.ao_report_snapshots;
create policy ao_report_snapshots_iso on public.ao_report_snapshots
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
