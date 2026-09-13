-- Atlas Opus — M13 (pilotage de réalisation) : relevé d'actions. Actions à mener
-- issues du pilotage (réunions de chantier) : responsable, échéance, statut.
-- Lien optionnel au compte rendu de chantier source (ao_site_reports).
-- Opération-scopé : RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  site_report_id uuid references public.ao_site_reports(id) on delete set null,
  description text not null,
  owner text not null,
  due_date date not null,
  status text not null default 'ouvert' check (status in ('ouvert', 'en_cours', 'fait', 'annule')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_action_items_op_idx on public.ao_action_items(operation_id);
create index if not exists ao_action_items_report_idx on public.ao_action_items(site_report_id);
drop trigger if exists trg_ao_action_items_upd on public.ao_action_items;
create trigger trg_ao_action_items_upd before update on public.ao_action_items
  for each row execute function public.ao_set_updated_at();

alter table public.ao_action_items enable row level security;
drop policy if exists ao_action_items_iso on public.ao_action_items;
create policy ao_action_items_iso on public.ao_action_items
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
