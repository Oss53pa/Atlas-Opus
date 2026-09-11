-- ============================================================================
-- Bootstrap pour tester la PILE DE MIGRATIONS (tables ao_) hors de Supabase.
-- À N'UTILISER QUE POUR LES TESTS LOCAUX. Émule les objets partagés du projet
-- « ATLAS STUDIO » que les migrations supposent déjà présents :
--   · auth.uid() / auth.role()  (lus des GUC app.user_id / app.role)
--   · le rôle non-propriétaire `authenticated` (la RLS ne s'applique qu'à lui)
--   · public.tenants        (cible des FK tenant_id)
--   · public.user_tenants   (mapping user_id → tenant_id, base de l'isolation)
-- Ne jamais appliquer ce fichier à une base de production.
-- ============================================================================
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- Objets partagés (pré-existants en production, créés ici pour le test).
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'tenant');

create table if not exists public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (user_id, tenant_id));
alter table public.user_tenants enable row level security;
drop policy if exists user_tenants_self on public.user_tenants;
create policy user_tenants_self on public.user_tenants
  using (user_id = auth.uid());
