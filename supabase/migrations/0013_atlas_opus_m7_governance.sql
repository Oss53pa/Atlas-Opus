-- Atlas Opus — Gouvernance M7 : matrice RACI (RG-M7-07) & registre des
-- décisions (append-only, RG-M7-08). Préfixe ao_ ; RLS via public.user_tenants.

-- Matrice RACI (§3) : par activité, une assignation intervenant → rôle RACI.
-- L'invariant « exactement un A par activité » (RG-M7-07) est garanti côté
-- domaine/UI (canAssignAccountable) ; ici on interdit seulement le doublon
-- exact (même activité + même intervenant).
create table if not exists public.ao_raci_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  activity text not null,
  stakeholder_id uuid not null references public.ao_stakeholders(id) on delete cascade,
  raci text not null check (raci in ('R','A','C','I')),
  created_at timestamptz not null default now(),
  unique (operation_id, activity, stakeholder_id)
);
create index if not exists ao_raci_assignments_op_idx on public.ao_raci_assignments(operation_id);

alter table public.ao_raci_assignments enable row level security;
drop policy if exists ao_raci_assignments_iso on public.ao_raci_assignments;
create policy ao_raci_assignments_iso on public.ao_raci_assignments
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- Registre des décisions (§3, RG-M7-08) : append-only. Aucune politique UPDATE
-- n'est créée → même le rôle authentifié ne peut modifier une décision actée.
create table if not exists public.ao_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  kind text not null check (kind in ('decision','courrier','OS','CR_reunion')),
  reference text not null,
  date date not null,
  summary text,
  decided_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists ao_decisions_op_idx on public.ao_decisions(operation_id);

alter table public.ao_decisions enable row level security;
-- Lecture + insertion isolées par tenant ; pas de policy update (append-only).
drop policy if exists ao_decisions_select on public.ao_decisions;
create policy ao_decisions_select on public.ao_decisions
  for select using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
drop policy if exists ao_decisions_insert on public.ao_decisions;
create policy ao_decisions_insert on public.ao_decisions
  for insert with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
drop policy if exists ao_decisions_delete on public.ao_decisions;
create policy ao_decisions_delete on public.ao_decisions
  for delete using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
