-- Atlas Opus — Journal d'audit M23 : trace append-only des écritures sensibles.
-- Aucune policy UPDATE (inaltérable). Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null check (action in ('create','update','approve','transition','export','access')),
  module text not null,
  object text not null,
  summary text
);
create index if not exists ao_audit_log_op_idx on public.ao_audit_log(operation_id);
create index if not exists ao_audit_log_at_idx on public.ao_audit_log(at desc);

alter table public.ao_audit_log enable row level security;
-- Lecture + insertion isolées par tenant ; aucune policy update/delete (append-only).
drop policy if exists ao_audit_log_select on public.ao_audit_log;
create policy ao_audit_log_select on public.ao_audit_log
  for select using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
drop policy if exists ao_audit_log_insert on public.ao_audit_log;
create policy ao_audit_log_insert on public.ao_audit_log
  for insert with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
