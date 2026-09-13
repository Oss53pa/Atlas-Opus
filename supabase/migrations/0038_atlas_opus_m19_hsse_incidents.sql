-- Atlas Opus — M19 (volet HSSE) : registre des incidents Santé-Sécurité-Environnement.
-- Journal des faits terrain (accidents, presqu'accidents, incidents env., maladies
-- pro), distinct du registre des risques (ao_risks). Opération-scopé : RLS tenant
-- + operation_scope (correctif v4.1, cohérent 0034) ; gardes de rôle non requises
-- (déclaration terrain ouverte à tout membre du périmètre).

create table if not exists public.ao_hsse_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  reference text not null,
  kind text not null check (kind in ('accident', 'presqu_accident', 'environnement', 'maladie_pro')),
  severity text not null check (severity in ('mineure', 'grave', 'critique')),
  occurred_at date not null,
  location text,
  description text not null,
  corrective_action text,
  status text not null default 'declare' check (status in ('declare', 'en_analyse', 'clos')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_hsse_incidents_op_idx on public.ao_hsse_incidents(operation_id);
drop trigger if exists trg_ao_hsse_incidents_upd on public.ao_hsse_incidents;
create trigger trg_ao_hsse_incidents_upd before update on public.ao_hsse_incidents
  for each row execute function public.ao_set_updated_at();

alter table public.ao_hsse_incidents enable row level security;
drop policy if exists ao_hsse_incidents_iso on public.ao_hsse_incidents;
create policy ao_hsse_incidents_iso on public.ao_hsse_incidents
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
