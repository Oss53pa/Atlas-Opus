-- Atlas Opus — RFI & collaboration M12 : demandes d'information.
-- Machine ouverte → repondue → cloturee. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_rfis (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  number text not null,
  subject text not null,
  question text not null default '',
  raised_by text not null,
  priority text not null default 'normale' check (priority in ('normale','urgente')),
  status text not null default 'ouverte' check (status in ('ouverte','repondue','cloturee')),
  due_date date,
  document_ref text,
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_rfis_op_idx on public.ao_rfis(operation_id);
drop trigger if exists trg_ao_rfis_upd on public.ao_rfis;
create trigger trg_ao_rfis_upd before update on public.ao_rfis
  for each row execute function public.ao_set_updated_at();

alter table public.ao_rfis enable row level security;
drop policy if exists ao_rfis_iso on public.ao_rfis;
create policy ao_rfis_iso on public.ao_rfis
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
