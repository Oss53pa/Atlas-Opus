-- =====================================================================
-- Atlas Opus — Schéma v4.1 (Supabase / PostgreSQL)
-- Application de Maîtrise d'Ouvrage · multitenant + périmètre opération (RLS) · multi-pays · multi-régime
-- Réf : CDC v4.1 + Atlas-Opus_Specifications_Modules.md (23 modules + 7 fondations).
-- Correctifs v4.1 : RLS par operation_scope, RLS par rôle (écritures sensibles),
--                   tables des 23 modules, fiscalité, notifications, intégrations, workflow.
-- Montants numeric(18,2). service_role (Edge Functions) contourne la RLS.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------- Helpers d'accès ----------
create or replace function public.user_tenants()
returns setof uuid language sql stable security definer set search_path=public as $$
  select tenant_id from public.memberships where user_id = auth.uid();
$$;

-- Périmètre opération : respecte memberships.operation_scope (null = toutes les opérations du tenant).
create or replace function public.user_operations()
returns setof uuid language sql stable security definer set search_path=public as $$
  select o.id
  from public.operations o
  join public.memberships m on m.tenant_id = o.tenant_id and m.user_id = auth.uid()
  where m.operation_scope is null or o.id = any(m.operation_scope);
$$;

-- Contrôle de rôle : pour les politiques d'écriture sensibles.
create or replace function public.has_role(roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.memberships where user_id = auth.uid() and role = any(roles));
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- CONVENTIONS DE POLITIQUE (RLS)
--  - Table à operation_id  => ISO OP  : tenant_id ∈ user_tenants() ET operation_id ∈ user_operations()
--  - Table enfant (sans operation_id) => ISO TENANT : tenant_id ∈ user_tenants()
--    (le périmètre opération est garanti par la table parente)
--  - Écritures sensibles => politiques INSERT/UPDATE distinctes gardées par has_role(...),
--    ET revérifiées dans les Edge Functions.

-- =====================================================================
-- RÉFÉRENTIEL & IDENTITÉ (F1)
-- =====================================================================
create table public.country_config (
  country_code char(2) primary key,
  zone text not null check (zone in ('UEMOA','CEMAC')),
  currency char(3) not null,
  locale_default text not null default 'fr',
  vat_rate numeric(5,4) not null default 0,               -- F6 fiscalité
  wht_rules jsonb not null default '{}'::jsonb,            -- F6 retenues à la source
  chart_of_accounts text not null default 'SYSCOHADA',
  retention_default numeric(5,4) not null default 0.05,
  public_holidays jsonb not null default '[]'::jsonb,
  procurement_regime jsonb not null default '{}'::jsonb,
  price_indices jsonb not null default '{}'::jsonb,        -- révision de prix
  legal_templates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.country_config enable row level security;
create policy country_read on public.country_config for select using (auth.role() = 'authenticated');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) not null references public.country_config(country_code),
  plan text not null default 'standard',
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_tenants_upd before update on public.tenants for each row execute function public.set_updated_at();
alter table public.tenants enable row level security;
create policy tenant_member_read on public.tenants for select using (id in (select public.user_tenants()));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','moa_director','finance','amo','procurement','commercial','site','stakeholder','viewer')),
  operation_scope uuid[] null,   -- null = toutes les opérations du tenant
  delegated_by uuid null,        -- F7 délégation
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
alter table public.memberships enable row level security;
create policy membership_read on public.memberships for select using (user_id = auth.uid() or tenant_id in (select public.user_tenants()));

create table public.invitations (   -- F1 onboarding
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null,
  operation_scope uuid[] null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  token text not null,
  created_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
create policy invitations_iso on public.invitations using (tenant_id in (select public.user_tenants()) and public.has_role(array['owner','moa_director'])) with check (tenant_id in (select public.user_tenants()) and public.has_role(array['owner','moa_director']));

-- =====================================================================
-- OPÉRATION (racine) & STRUCTURE
-- =====================================================================
create table public.operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  country_code char(2) not null references public.country_config(country_code),
  name text not null,
  op_type text not null default 'commercial' check (op_type in ('residential','commercial','public','mixed')),
  procurement_mode text not null default 'private' check (procurement_mode in ('private','public')),
  phase text not null default 'amont',
  currency char(3) not null,
  budget_bac numeric(18,2) not null default 0,
  retention_rate numeric(5,4) not null default 0.05,
  start_date date, end_date date,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.operations(tenant_id);
create trigger trg_operations_upd before update on public.operations for each row execute function public.set_updated_at();
alter table public.operations enable row level security;
create policy operations_iso on public.operations using (tenant_id in (select public.user_tenants()) and id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()));
-- Écriture réservée à owner/moa_director (création/modification d'opération) :
create policy operations_write on public.operations as restrictive for insert with check (public.has_role(array['owner','moa_director']));

-- Macro d'ISO OP répétée sur les tables à operation_id (voir conventions).
create table public.program_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  category text not null, label text not null, target_value text, unit text,
  version int not null default 1, status text not null default 'draft',
  created_at timestamptz not null default now());
create index on public.program_items(operation_id);
alter table public.program_items enable row level security;
create policy program_items_iso on public.program_items using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  code text not null, name text not null, created_at timestamptz not null default now());
create index on public.lots(operation_id);
alter table public.lots enable row level security;
create policy lots_iso on public.lots using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  syscohada_account text not null, label text not null,
  amount_bac numeric(18,2) not null default 0, created_at timestamptz not null default now());
create index on public.budget_lines(operation_id);
alter table public.budget_lines enable row level security;
create policy budget_lines_iso on public.budget_lines using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));
create policy budget_lines_write on public.budget_lines as restrictive for update using (public.has_role(array['finance','moa_director']));

create table public.ouvrages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines(id),
  label text not null, quantity numeric(18,3) not null default 0,
  progress numeric(5,4) not null default 0 check (progress between 0 and 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.ouvrages(operation_id);
create trigger trg_ouvrages_upd before update on public.ouvrages for each row execute function public.set_updated_at();
alter table public.ouvrages enable row level security;
create policy ouvrages_iso on public.ouvrages using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- ---------- Planning (M12) ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  wbs_code text, name text not null, start_date date, duration_days int not null default 0,
  end_date date, is_milestone boolean not null default false,
  progress numeric(5,4) not null default 0, is_critical boolean not null default false,
  created_at timestamptz not null default now());
create index on public.tasks(operation_id);
alter table public.tasks enable row level security;
create policy tasks_iso on public.tasks using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  predecessor_id uuid not null references public.tasks(id) on delete cascade,
  successor_id uuid not null references public.tasks(id) on delete cascade,
  type text not null default 'FS', lag_days int not null default 0);
alter table public.dependencies enable row level security;
create policy dependencies_iso on public.dependencies using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  label text not null, snapshot jsonb not null, is_active boolean not null default true,
  created_at timestamptz not null default now());
create index on public.baselines(operation_id);
alter table public.baselines enable row level security;
create policy baselines_iso on public.baselines using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- ---------- Parties prenantes & contrats (M7) ----------
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text not null, name text not null, contact jsonb not null default '{}'::jsonb,
  status text not null default 'active', created_at timestamptz not null default now());
create index on public.stakeholders(operation_id);
alter table public.stakeholders enable row level security;
create policy stakeholders_iso on public.stakeholders using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.stakeholder_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  mission text not null, fee_amount numeric(18,2) not null default 0,
  fee_schedule jsonb not null default '[]'::jsonb, start_date date, end_date date,
  status text not null default 'draft', created_at timestamptz not null default now());
alter table public.stakeholder_contracts enable row level security;
create policy stk_contracts_iso on public.stakeholder_contracts using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.insurances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  type text not null, insurer text not null, policy_number text,
  valid_from date not null, valid_to date, attestation_ref text,
  status text not null default 'valid', created_at timestamptz not null default now());
alter table public.insurances enable row level security;
create policy insurances_iso on public.insurances using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.stakeholder_contracts(id) on delete cascade,
  label text not null, due_date date not null,
  status text not null default 'pending', created_at timestamptz not null default now());
alter table public.deliverables enable row level security;
create policy deliverables_iso on public.deliverables using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  kind text not null, reference text not null, date date not null,
  summary text, decided_by uuid not null, related_stakeholder uuid, file_ref text,
  created_at timestamptz not null default now());  -- append-only (pas d'UPDATE applicatif)
create index on public.decisions(operation_id);
alter table public.decisions enable row level security;
create policy decisions_iso on public.decisions using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.raci_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  activity text not null, stakeholder_id uuid not null references public.stakeholders(id),
  raci text not null check (raci in ('R','A','C','I')));
alter table public.raci_assignments enable row level security;
create policy raci_iso on public.raci_assignments using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- ---------- Foncier & juridique (M2) ----------
create table public.land_parcels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  reference text not null, area numeric(18,2), tenure_type text not null,
  price numeric(18,2) not null default 0, acquisition_status text not null default 'prospection',
  notary text, geo jsonb, created_at timestamptz not null default now());
create index on public.land_parcels(operation_id);
alter table public.land_parcels enable row level security;
create policy parcels_iso on public.land_parcels using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.title_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parcel_id uuid not null references public.land_parcels(id) on delete cascade,
  doc_type text not null, reference text not null, issued_by text,
  status text not null default 'pending', file_ref text);
alter table public.title_documents enable row level security;
create policy titles_iso on public.title_documents using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.due_diligence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  category text not null, finding text not null, severity text not null,
  status text not null default 'open');
create index on public.due_diligence_items(operation_id);
alter table public.due_diligence_items enable row level security;
create policy dd_iso on public.due_diligence_items using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  structure_type text not null, name text not null, rccm text,
  shareholders jsonb not null default '[]'::jsonb, status text not null default 'draft');
alter table public.legal_entities enable row level security;
create policy legal_iso on public.legal_entities using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text not null, authority text not null, reference text,
  status text not null default 'draft', validity date, conditions jsonb not null default '[]'::jsonb);
alter table public.authorizations enable row level security;
create policy auth_iso on public.authorizations using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- ---------- Études amont (M3) ----------
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text not null, provider_id uuid, status text not null default 'commandée',
  findings text, file_ref text, created_at timestamptz not null default now());
alter table public.studies enable row level security;
create policy studies_iso on public.studies using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.eies_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  impact text not null, milieu text, severity text, mesure_attenuation text,
  status text not null default 'planifiée');
alter table public.eies_items enable row level security;
create policy eies_iso on public.eies_items using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.pges_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  action text not null, responsable uuid, echeance date, indicateur text,
  status text not null default 'open');
alter table public.pges_actions enable row level security;
create policy pges_iso on public.pges_actions using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- ---------- Financement (M5) ----------
create table public.financing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  source text not null, amount numeric(18,2) not null default 0, rate numeric(7,4) not null default 0,
  tranches jsonb not null default '[]'::jsonb, created_at timestamptz not null default now());
alter table public.financing enable row level security;
create policy financing_iso on public.financing using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.drawdowns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  financing_id uuid not null references public.financing(id) on delete cascade,
  amount numeric(18,2) not null default 0, condition text,
  status text not null default 'planifié', date date);
alter table public.drawdowns enable row level security;
create policy drawdowns_iso on public.drawdowns using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

-- ---------- Commercialisation & recettes (M6) ----------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id), typology text, area numeric(18,2),
  price numeric(18,2) not null default 0, status text not null default 'disponible');
create index on public.units(operation_id);
alter table public.units enable row level security;
create policy units_iso on public.units using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  kind text not null check (kind in ('reservation','lease')), unit_id uuid references public.units(id),
  counterpart text not null, amount numeric(18,2) not null default 0,
  schedule jsonb not null default '[]'::jsonb, status text not null default 'draft',
  created_at timestamptz not null default now());
create index on public.sales(operation_id);
alter table public.sales enable row level security;
create policy sales_iso on public.sales using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(18,2) not null, method text, status text not null default 'pending', reference text,
  created_at timestamptz not null default now());
alter table public.receipts enable row level security;
create policy receipts_iso on public.receipts using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

-- =====================================================================
-- PASSATION, ACHATS & ANALYSE DES OFFRES (M8 / M9 / M23)
-- =====================================================================
create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  mode text not null check (mode in ('private','public')), procedure text, object text not null,
  threshold_ok boolean, ano_required boolean not null default false,
  status text not null default 'planned', awarded_to uuid,
  created_at timestamptz not null default now());
create index on public.tenders(operation_id);
alter table public.tenders enable row level security;
create policy tenders_iso on public.tenders using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null, tender_id uuid references public.tenders(id),
  reference text not null, contractor text not null, amount numeric(18,2) not null default 0,
  status text not null default 'active', created_at timestamptz not null default now());
create index on public.contracts(operation_id);
alter table public.contracts enable row level security;
create policy contracts_iso on public.contracts using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.bpu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  code text not null, label text not null, unit text not null, unit_price numeric(18,2) not null default 0);
alter table public.bpu_items enable row level security;
create policy bpu_iso on public.bpu_items using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, category text, contact jsonb not null default '{}'::jsonb, status text not null default 'active');
alter table public.suppliers enable row level security;
create policy suppliers_iso on public.suppliers using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id), reference text not null,
  amount numeric(18,2) not null default 0, status text not null default 'draft', eta date,
  created_at timestamptz not null default now());
create index on public.purchase_orders(operation_id);
alter table public.purchase_orders enable row level security;
create policy po_iso on public.purchase_orders using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  incoterm text, customs_status text not null default 'en_attente', eta date, received_at date);
alter table public.shipments enable row level security;
create policy shipments_iso on public.shipments using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.offers (        -- M23
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  tender_id uuid references public.tenders(id), po_id uuid references public.purchase_orders(id),
  bidder text not null, total_amount numeric(18,2) not null default 0,
  admin_compliant boolean, received_at timestamptz not null default now());
create index on public.offers(operation_id);
alter table public.offers enable row level security;
create policy offers_iso on public.offers using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.offer_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  bpu_code text, unit_price numeric(18,2) not null default 0, quantity numeric(18,3) not null default 0);
alter table public.offer_lines enable row level security;
create policy offer_lines_iso on public.offer_lines using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  context_id uuid, label text not null, type text not null, weight numeric(5,4) not null default 0);
alter table public.evaluation_criteria enable row level security;
create policy eval_crit_iso on public.evaluation_criteria using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.offer_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  criteria_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  raw_score numeric(9,4), weighted_score numeric(9,4));
alter table public.offer_scores enable row level security;
create policy offer_scores_iso on public.offer_scores using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  context_id uuid, ranking jsonb not null default '[]'::jsonb, recommendation text,
  sealed boolean not null default false, hash text, created_at timestamptz not null default now());
alter table public.analysis_reports enable row level security;
create policy analysis_iso on public.analysis_reports using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- =====================================================================
-- CONCEPTION & GED (M10) / RFI (M11)
-- =====================================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  code text not null, title text not null, discipline text, program_item_id uuid,
  current_version text, created_at timestamptz not null default now());
create index on public.documents(operation_id);
alter table public.documents enable row level security;
create policy documents_iso on public.documents using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  indice text not null, file_ref text, status text not null default 'draft',
  issued_by uuid, issued_at timestamptz);
alter table public.document_versions enable row level security;
create policy docver_iso on public.document_versions using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.doc_distribution (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  recipient_stakeholder_id uuid, sent_at timestamptz, acknowledged_at timestamptz);
alter table public.doc_distribution enable row level security;
create policy docdist_iso on public.doc_distribution using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.rfis (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  reference text not null, question text not null, raised_by uuid, assigned_to uuid,
  due_date date, priority text not null default 'medium', status text not null default 'open',
  answer text, answered_at timestamptz, created_at timestamptz not null default now());
create index on public.rfis(operation_id);
alter table public.rfis enable row level security;
create policy rfis_iso on public.rfis using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.rfi_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rfi_id uuid not null references public.rfis(id) on delete cascade,
  author_id uuid, message text not null, created_at timestamptz not null default now());
alter table public.rfi_threads enable row level security;
create policy rfithreads_iso on public.rfi_threads using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

-- =====================================================================
-- RÉALISATION (M13) / MODIFICATIONS (M14)
-- =====================================================================
create table public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id), period text not null,
  physical_progress numeric(5,4) not null default 0, source text not null, comment text,
  created_at timestamptz not null default now());
create index on public.progress_reports(operation_id);
alter table public.progress_reports enable row level security;
create policy progress_iso on public.progress_reports using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  contract_id uuid references public.contracts(id), type text not null, reference text not null,
  content text not null, status text not null default 'draft', created_at timestamptz not null default now());
alter table public.service_orders enable row level security;
create policy os_iso on public.service_orders using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.site_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  date date not null, attendees jsonb not null default '[]'::jsonb, minutes text not null,
  created_at timestamptz not null default now());
alter table public.site_meetings enable row level security;
create policy meetings_iso on public.site_meetings using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  meeting_id uuid references public.site_meetings(id) on delete cascade,
  description text not null, owner_id uuid not null, due_date date not null,
  status text not null default 'open');
alter table public.action_items enable row level security;
create policy actionitems_iso on public.action_items using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null, origin text not null,
  description text not null, impact_cost numeric(18,2) not null default 0, impact_days int not null default 0,
  impact_quality text, status text not null default 'requested', avenant_ref text, decided_by uuid,
  created_at timestamptz not null default now());
create index on public.change_orders(operation_id);
alter table public.change_orders enable row level security;
create policy chg_iso on public.change_orders using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.change_approval_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  threshold_amount numeric(18,2) not null default 0, required_role text not null);
alter table public.change_approval_rules enable row level security;
create policy chgrules_iso on public.change_approval_rules using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- =====================================================================
-- BILAN (M4) / PAIEMENT (M15) / CAUTIONS (M16) / FISCALITÉ (F6)
-- =====================================================================
create table public.bilan_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  kind text not null check (kind in ('cost','revenue')), poste text not null,
  amount_planned numeric(18,2) not null default 0, amount_committed numeric(18,2) not null default 0,
  amount_actual numeric(18,2) not null default 0, created_at timestamptz not null default now());
create index on public.bilan_lines(operation_id);
alter table public.bilan_lines enable row level security;
create policy bilan_iso on public.bilan_lines using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));
create policy bilan_write on public.bilan_lines as restrictive for update using (public.has_role(array['finance','moa_director']));

create table public.bilan_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  label text not null, data jsonb not null, hash text not null, created_by uuid not null,
  created_at timestamptz not null default now());
alter table public.bilan_snapshots enable row level security;
create policy snap_iso on public.bilan_snapshots using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.decomptes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade, number integer not null,
  amount_gross numeric(18,2) not null default 0, retention numeric(18,2) not null default 0,
  amount_net numeric(18,2) not null default 0, status text not null default 'draft',
  created_at timestamptz not null default now(), unique (contract_id, number));
create index on public.decomptes(operation_id);
alter table public.decomptes enable row level security;
create policy decomptes_iso on public.decomptes using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));
create policy decomptes_write on public.decomptes as restrictive for update using (public.has_role(array['finance','moa_director']));

create table public.tax_lines (       -- F6 fiscalité (TVA + retenues)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  decompte_id uuid references public.decomptes(id) on delete cascade,
  kind text not null check (kind in ('tva','retenue_source')), base numeric(18,2) not null default 0,
  rate numeric(5,4) not null default 0, amount numeric(18,2) not null default 0);
alter table public.tax_lines enable row level security;
create policy tax_iso on public.tax_lines using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.price_revisions (  -- révision de prix par indices
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  formula jsonb not null default '{}'::jsonb, period text, revised_amount numeric(18,2));
alter table public.price_revisions enable row level security;
create policy pricerev_iso on public.price_revisions using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  decompte_id uuid not null references public.decomptes(id) on delete cascade,
  method text not null check (method in ('mobile_money','virement')), amount numeric(18,2) not null,
  status text not null default 'pending', reference text, idempotency_key text unique,
  created_at timestamptz not null default now());
alter table public.payments enable row level security;
create policy payments_iso on public.payments using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));
create policy payments_write on public.payments as restrictive for insert with check (public.has_role(array['finance']));

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  contract_id uuid references public.contracts(id), amount_engaged numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0);
alter table public.engagements enable row level security;
create policy engag_iso on public.engagements using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.decompte_validations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  decompte_id uuid not null references public.decomptes(id) on delete cascade,
  step text not null, status text not null default 'pending', actor_id uuid not null, comment text,
  created_at timestamptz not null default now());
alter table public.decompte_validations enable row level security;
create policy decval_iso on public.decompte_validations using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.guarantees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade, kind text not null,
  amount numeric(18,2) not null default 0, status text not null default 'emise', expiry date, issuer text,
  created_at timestamptz not null default now());
alter table public.guarantees enable row level security;
create policy guarantees_iso on public.guarantees using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- =====================================================================
-- RACCORDEMENTS (M17) / RÉCEPTION & GPA (M18) / RISQUES-HSSE (M19) / EXPLOITATION (M20)
-- =====================================================================
create table public.utility_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text not null, provider text, status text not null default 'requested', target_date date,
  cost numeric(18,2) not null default 0, created_at timestamptz not null default now());
alter table public.utility_connections enable row level security;
create policy util_iso on public.utility_connections using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.receptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id), type text not null, pv_ref text, decision text, date date);
alter table public.receptions enable row level security;
create policy receptions_iso on public.receptions using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.reserves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id), description text not null,
  status text not null default 'open', created_at timestamptz not null default now(), lifted_at timestamptz);
create index on public.reserves(operation_id);
alter table public.reserves enable row level security;
create policy reserves_iso on public.reserves using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.gpa (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  start_date date, end_date date, status text not null default 'en_cours');
alter table public.gpa enable row level security;
create policy gpa_iso on public.gpa using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  title text not null, probability int check (probability between 1 and 5),
  impact int check (impact between 1 and 5), score int, mitigation text, owner_id uuid,
  status text not null default 'open');
create index on public.risks(operation_id);
alter table public.risks enable row level security;
create policy risks_iso on public.risks using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  counterpart text, object text, amount_at_stake numeric(18,2) not null default 0,
  status text not null default 'ouvert', file_ref text);
alter table public.disputes enable row level security;
create policy disputes_iso on public.disputes using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  insurance_id uuid references public.insurances(id), event text, amount numeric(18,2) not null default 0,
  status text not null default 'déclaré');
alter table public.claims enable row level security;
create policy claims_iso on public.claims using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.hsse_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text, severity text, date date, description text, corrective_action text,
  status text not null default 'déclaré');
create index on public.hsse_incidents(operation_id);
alter table public.hsse_incidents enable row level security;
create policy hsse_iso on public.hsse_incidents using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.doe_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  category text not null, file_ref text, validated boolean not null default false);
alter table public.doe_documents enable row level security;
create policy doe_iso on public.doe_documents using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.handover_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  label text not null, type text, location text, warranty_end date, target_system text);
alter table public.handover_assets enable row level security;
create policy hoassets_iso on public.handover_assets using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.handover (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  status text not null default 'preparation', transferred_at timestamptz);
alter table public.handover enable row level security;
create policy handover_iso on public.handover using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

-- =====================================================================
-- COCKPIT (M21) / COPILOTE (M22) / FONDATIONS TRANSVERSES (F4, F5)
-- =====================================================================
create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  type text not null, period text, data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now());
alter table public.report_snapshots enable row level security;
create policy reports_iso on public.report_snapshots using (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations())) with check (tenant_id in (select public.user_tenants()) and operation_id in (select public.user_operations()));

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric text not null, threshold numeric(18,4), severity text not null default 'info');
alter table public.alert_rules enable row level security;
create policy alertrules_iso on public.alert_rules using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.notifications (   -- F4
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.operations(id) on delete cascade,
  user_id uuid not null, channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  title text not null, body text, severity text not null default 'info',
  status text not null default 'pending' check (status in ('pending','sent','read','failed')),
  created_at timestamptz not null default now());
create index on public.notifications(user_id);
alter table public.notifications enable row level security;
create policy notif_read on public.notifications for select using (user_id = auth.uid() or tenant_id in (select public.user_tenants()));

create table public.integration_endpoints (  -- F5 contrats d'intégration
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system text not null check (system in ('atlas_finance','advist','cinetpay','atlas_lease','keystone','duedeck')),
  config jsonb not null default '{}'::jsonb, status text not null default 'active');
alter table public.integration_endpoints enable row level security;
create policy integ_iso on public.integration_endpoints using (tenant_id in (select public.user_tenants()) and public.has_role(array['owner','moa_director'])) with check (tenant_id in (select public.user_tenants()) and public.has_role(array['owner','moa_director']));

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  system text not null, direction text not null check (direction in ('inbound','outbound')),
  payload jsonb not null default '{}'::jsonb, idempotency_key text,
  status text not null default 'pending' check (status in ('pending','ok','failed','retrying')),
  created_at timestamptz not null default now());
alter table public.integration_events enable row level security;
create policy integev_iso on public.integration_events using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.rag_chunks (      -- M22
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid references public.operations(id) on delete cascade,
  source_module text, source_id uuid, content text, embedding vector(1024));
alter table public.rag_chunks enable row level security;
create policy rag_iso on public.rag_chunks using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prompt text, model text, sensitivity text, no_data_retention boolean not null default false,
  tokens int, created_by uuid, created_at timestamptz not null default now());
alter table public.ai_runs enable row level security;
create policy airuns_iso on public.ai_runs using (tenant_id in (select public.user_tenants())) with check (tenant_id in (select public.user_tenants()));

-- =====================================================================
-- AUDIT (hash chaîné)
-- =====================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid, entity text not null, entity_id uuid, action text not null,
  payload jsonb not null default '{}'::jsonb, prev_hash text, hash text not null,
  created_at timestamptz not null default now());
create index on public.audit_log(tenant_id, entity, entity_id);
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select using (tenant_id in (select public.user_tenants()));
-- Écriture audit + étapes de passation publique : via Edge Function (service_role).

-- =====================================================================
-- FIN — v4.1. À tester sur base Supabase neuve :
--   1) isolation tenant, 2) isolation operation_scope, 3) refus d'écriture par rôle,
--   4) idempotence paiement (payments.idempotency_key), 5) audit rejouable.
-- =====================================================================
