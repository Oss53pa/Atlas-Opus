-- ============================================================================
-- Harnais de test RLS — À N'UTILISER QUE POUR LES TESTS LOCAUX.
-- En production, Supabase fournit le schéma `auth` (auth.uid(), auth.role())
-- et le rôle `authenticated`. Ce fichier les émule sur un PostgreSQL nu afin
-- de pouvoir exécuter les politiques RLS de schema.sql hors de Supabase.
--   · auth.uid()  → lit le GUC de session `app.user_id`
--   · auth.role() → lit le GUC `app.role` (défaut: 'anon')
-- Ne jamais appliquer ce fichier à une base de production.
-- ============================================================================
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;

-- Rôle applicatif non-propriétaire : la RLS ne s'applique qu'à lui (le
-- propriétaire des tables la contourne, comme le service_role en production).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
