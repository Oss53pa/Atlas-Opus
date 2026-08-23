-- Atlas Opus — Pilotage de réalisation M13 : comptes rendus de chantier.
-- Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_site_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  number integer not null,
  date date not null,
  author text not null,
  progress numeric(5,4) not null default 0 check (progress >= 0 and progress <= 1),
  summary text not null default '',
  blockers integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_site_reports_op_idx on public.ao_site_reports(operation_id);
drop trigger if exists trg_ao_site_reports_upd on public.ao_site_reports;
create trigger trg_ao_site_reports_upd before update on public.ao_site_reports
  for each row execute function public.ao_set_updated_at();

alter table public.ao_site_reports enable row level security;
drop policy if exists ao_site_reports_iso on public.ao_site_reports;
create policy ao_site_reports_iso on public.ao_site_reports
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
