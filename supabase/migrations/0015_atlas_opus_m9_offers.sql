-- Atlas Opus — Analyse des offres M9 : offres rattachées aux marchés (M8).
-- Note technique 0..100 ; statut recu → conforme | ecarte ; retenu = attribution.
-- Préfixe ao_ ; RLS par tenant.

create table if not exists public.ao_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  tender_id uuid not null references public.ao_tenders(id) on delete cascade,
  bidder text not null,
  amount numeric(18,2) not null default 0,
  score_technical numeric(5,2) not null default 0 check (score_technical >= 0 and score_technical <= 100),
  status text not null default 'recu' check (status in ('recu','conforme','ecarte','retenu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ao_offers_op_idx on public.ao_offers(operation_id);
create index if not exists ao_offers_tender_idx on public.ao_offers(tender_id);
drop trigger if exists trg_ao_offers_upd on public.ao_offers;
create trigger trg_ao_offers_upd before update on public.ao_offers
  for each row execute function public.ao_set_updated_at();

alter table public.ao_offers enable row level security;
drop policy if exists ao_offers_iso on public.ao_offers;
create policy ao_offers_iso on public.ao_offers
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));
