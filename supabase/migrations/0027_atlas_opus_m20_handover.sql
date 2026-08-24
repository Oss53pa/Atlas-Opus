-- Atlas Opus — Passation vers exploitation (bascule) : dossier de transfert.
-- Un enregistrement par opération ; catégories DOE et équipements en jsonb.
-- Transfert conditionné au DOE complet et à la réception (RG-M20-01).
-- Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_handover (
  operation_id uuid primary key references public.ao_operations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doe jsonb not null default '[]'::jsonb,
  equipment jsonb not null default '[]'::jsonb,
  equipment_count integer not null default 0,
  guarantees_count integer not null default 0,
  guarantees_without_end integer not null default 0,
  transfer_state text not null default 'non_lance'
    check (transfer_state in ('non_lance','preparation','pret','transfere')),
  export_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_handover_tenant_idx on public.ao_handover(tenant_id);
drop trigger if exists trg_ao_handover_upd on public.ao_handover;
create trigger trg_ao_handover_upd before update on public.ao_handover
  for each row execute function public.ao_set_updated_at();

alter table public.ao_handover enable row level security;
drop policy if exists ao_handover_iso on public.ao_handover;
create policy ao_handover_iso on public.ao_handover
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
