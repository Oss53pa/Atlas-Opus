-- Atlas Opus — M21 (cockpit & reporting) : règles d'alerte. Seuils configurables
-- par tenant, évalués par le cockpit contre les indicateurs. Tenant-scopée (pas
-- de périmètre opération) : RLS tenant seul (cohérent 0034, sans operation_scope).

create table if not exists public.ao_alert_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric text not null,
  threshold numeric(18,4),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_alert_rules_tenant_idx on public.ao_alert_rules(tenant_id);
drop trigger if exists trg_ao_alert_rules_upd on public.ao_alert_rules;
create trigger trg_ao_alert_rules_upd before update on public.ao_alert_rules
  for each row execute function public.ao_set_updated_at();

alter table public.ao_alert_rules enable row level security;
drop policy if exists ao_alert_rules_iso on public.ao_alert_rules;
create policy ao_alert_rules_iso on public.ao_alert_rules
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
