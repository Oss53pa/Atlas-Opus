-- Atlas Opus — M23 (dépouillement) : notation des offres. Note d'une offre sur
-- un critère (brute 0..100 + pondérée). Une note par couple offre/critère.
-- Opération-scopé : RLS tenant + operation_scope (cohérent 0034).

create table if not exists public.ao_offer_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  offer_id uuid not null references public.ao_offers(id) on delete cascade,
  criteria_id uuid not null references public.ao_evaluation_criteria(id) on delete cascade,
  raw_score numeric(9,4) not null default 0,
  weighted_score numeric(9,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, criteria_id)
);
create index if not exists ao_offer_scores_op_idx on public.ao_offer_scores(operation_id);
create index if not exists ao_offer_scores_offer_idx on public.ao_offer_scores(offer_id);
drop trigger if exists trg_ao_offer_scores_upd on public.ao_offer_scores;
create trigger trg_ao_offer_scores_upd before update on public.ao_offer_scores
  for each row execute function public.ao_set_updated_at();

alter table public.ao_offer_scores enable row level security;
drop policy if exists ao_offer_scores_iso on public.ao_offer_scores;
create policy ao_offer_scores_iso on public.ao_offer_scores
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));
