-- Atlas Opus — Financement M5 : sources & tranches de déblocage.
-- Les tranches débloquées alimentent le poste frais_financiers du bilan (M4, RG-M5-02).
-- Préfixe ao_ ; RLS via public.user_tenants.

create table if not exists public.ao_financing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  source text not null check (source in ('credit_promoteur','bailleur','fonds_propres')),
  amount numeric(18,2) not null default 0,
  rate numeric(7,4) not null default 0,
  status text not null default 'negocie' check (status in ('negocie','accorde','en_cours','solde')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_financing_op_idx on public.ao_financing(operation_id);
drop trigger if exists trg_ao_financing_upd on public.ao_financing;
create trigger trg_ao_financing_upd before update on public.ao_financing
  for each row execute function public.ao_set_updated_at();

alter table public.ao_financing enable row level security;
drop policy if exists ao_financing_iso on public.ao_financing;
create policy ao_financing_iso on public.ao_financing
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

create table if not exists public.ao_drawdowns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  financing_id uuid not null references public.ao_financing(id) on delete cascade,
  amount numeric(18,2) not null default 0,
  condition numeric(5,4) not null default 0,
  status text not null default 'planifie' check (status in ('planifie','demande','debloque','refuse')),
  date date,
  created_at timestamptz not null default now()
);
create index if not exists ao_drawdowns_fin_idx on public.ao_drawdowns(financing_id);

alter table public.ao_drawdowns enable row level security;
drop policy if exists ao_drawdowns_iso on public.ao_drawdowns;
create policy ao_drawdowns_iso on public.ao_drawdowns
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
