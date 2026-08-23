-- Atlas Opus — Réception & GPA M19 : réserves & levées.
-- Une réception ne peut être prononcée tant qu'une réserve majeure est ouverte.
-- Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_reserves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  label text not null,
  location text not null default '',
  severity text not null check (severity in ('mineure','majeure')),
  status text not null default 'ouverte' check (status in ('ouverte','levee')),
  raised_at date not null,
  cleared_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_reserves_op_idx on public.ao_reserves(operation_id);
drop trigger if exists trg_ao_reserves_upd on public.ao_reserves;
create trigger trg_ao_reserves_upd before update on public.ao_reserves
  for each row execute function public.ao_set_updated_at();

alter table public.ao_reserves enable row level security;
drop policy if exists ao_reserves_iso on public.ao_reserves;
create policy ao_reserves_iso on public.ao_reserves
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
