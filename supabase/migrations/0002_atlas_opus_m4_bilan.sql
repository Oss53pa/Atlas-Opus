-- Atlas Opus — M4 (Bilan d'opération). Lignes de bilan coût/recette.
-- Appliquée au projet partagé (vgtmljfayiysuvrcmunt). Préfixe ao_ ; RLS via user_tenants.
create table if not exists public.ao_bilan_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  kind text not null check (kind in ('cost','revenue')),
  poste text not null,
  amount_planned numeric(18,2) not null default 0,
  amount_actual numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_bilan_lines_op_idx on public.ao_bilan_lines(operation_id);
drop trigger if exists trg_ao_bilan_lines_upd on public.ao_bilan_lines;
create trigger trg_ao_bilan_lines_upd before update on public.ao_bilan_lines
  for each row execute function public.ao_set_updated_at();

alter table public.ao_bilan_lines enable row level security;
drop policy if exists ao_bilan_lines_iso on public.ao_bilan_lines;
create policy ao_bilan_lines_iso on public.ao_bilan_lines
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
