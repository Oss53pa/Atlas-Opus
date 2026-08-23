-- Atlas Opus — Concessionnaires & raccordements M18.
-- Machine demande → etude → devis → paye → raccorde. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  utility text not null check (utility in ('eau','electricite','telecom','assainissement','gaz')),
  concessionaire text not null,
  reference text not null,
  status text not null default 'demande' check (status in ('demande','etude','devis','paye','raccorde')),
  cost numeric(18,2) not null default 0,
  requested_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_connections_op_idx on public.ao_connections(operation_id);
drop trigger if exists trg_ao_connections_upd on public.ao_connections;
create trigger trg_ao_connections_upd before update on public.ao_connections
  for each row execute function public.ao_set_updated_at();

alter table public.ao_connections enable row level security;
drop policy if exists ao_connections_iso on public.ao_connections;
create policy ao_connections_iso on public.ao_connections
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
