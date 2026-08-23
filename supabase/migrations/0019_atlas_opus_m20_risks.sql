-- Atlas Opus — Registre des risques M20 : criticité = probabilité × impact.
-- La matrice RACI est portée par M7. Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null check (category in ('technique','financier','juridique','delai','hsse','externe')),
  probability smallint not null check (probability between 1 and 5),
  impact smallint not null check (impact between 1 and 5),
  status text not null default 'ouvert' check (status in ('ouvert','maitrise','clos')),
  mitigation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_risks_op_idx on public.ao_risks(operation_id);
drop trigger if exists trg_ao_risks_upd on public.ao_risks;
create trigger trg_ao_risks_upd before update on public.ao_risks
  for each row execute function public.ao_set_updated_at();

alter table public.ao_risks enable row level security;
drop policy if exists ao_risks_iso on public.ao_risks;
create policy ao_risks_iso on public.ao_risks
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
