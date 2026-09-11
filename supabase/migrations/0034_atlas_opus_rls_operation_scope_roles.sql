-- Atlas Opus — Alignement du déployé sur les niveaux 2 & 3 de l'isolation §5.
-- Le déployé (tables ao_) n'appliquait que le niveau 1 (tenant). Cette migration
-- ajoute, sans casser l'existant :
--   · Niveau 2 — périmètre opération (operation_scope, correctif v4.1) :
--     ao_operation_members + ao_user_operations(), clause de périmètre sur
--     ao_operations (par id) et sur toutes les tables ao_ portant operation_id.
--   · Niveau 3 — rôle → action : ao_tenant_roles + ao_has_role(), politiques
--     d'écriture `as restrictive` sur les tables sensibles (miroir de schema.sql :
--     operations INSERT, bilan_lines/decomptes UPDATE).
-- COMPATIBILITÉ MIGRATION (fail-open until assigned) :
--   · aucune ligne ao_operation_members pour un (user,tenant) ⇒ toutes les
--     opérations du tenant (sémantique operation_scope null) ;
--   · aucun rôle ao_tenant_roles pour un user ⇒ écritures autorisées.
--   Les gardes s'activent par utilisateur au fur et à mesure des attributions,
--   donc appliquer cette migration ne change RIEN au comportement courant.
-- Réf : CLAUDE.md §5 (isolation à 3 niveaux), §3 (schema.sql source de vérité).

-- ── Niveau 2 : périmètre opération ───────────────────────────────────────────
create table if not exists public.ao_operation_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  operation_id uuid not null references public.ao_operations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create index if not exists ao_operation_members_user_tenant_idx
  on public.ao_operation_members(user_id, tenant_id);
alter table public.ao_operation_members enable row level security;
drop policy if exists ao_operation_members_iso on public.ao_operation_members;
create policy ao_operation_members_iso on public.ao_operation_members
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- Opérations visibles par l'utilisateur courant (respecte le périmètre).
-- security definer : contourne la RLS (pas de récursion sur ao_operations).
create or replace function public.ao_user_operations()
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id
  from public.ao_operations o
  join public.user_tenants ut on ut.tenant_id = o.tenant_id and ut.user_id = auth.uid()
  where not exists (
          select 1 from public.ao_operation_members m
          where m.user_id = auth.uid() and m.tenant_id = o.tenant_id)
     or exists (
          select 1 from public.ao_operation_members m
          where m.user_id = auth.uid() and m.tenant_id = o.tenant_id and m.operation_id = o.id);
$$;

-- ── Niveau 3 : rôle → action ─────────────────────────────────────────────────
create table if not exists public.ao_tenant_roles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','moa_director','finance','moe','amo','site','viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id, role)
);
create index if not exists ao_tenant_roles_user_idx on public.ao_tenant_roles(user_id);
alter table public.ao_tenant_roles enable row level security;
drop policy if exists ao_tenant_roles_iso on public.ao_tenant_roles;
create policy ao_tenant_roles_iso on public.ao_tenant_roles
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- Vrai si l'utilisateur a l'un des rôles — OU s'il n'a AUCun rôle assigné
-- (compat migration : la garde s'active dès qu'un rôle lui est attribué).
create or replace function public.ao_has_role(roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select
    not exists (select 1 from public.ao_tenant_roles r where r.user_id = auth.uid())
    or exists (select 1 from public.ao_tenant_roles r
               where r.user_id = auth.uid() and r.role = any(roles));
$$;

-- ── Niveau 2 appliqué : ao_operations (racine, périmètre par id) ─────────────
drop policy if exists ao_operations_iso on public.ao_operations;
create policy ao_operations_iso on public.ao_operations
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and id in (select public.ao_user_operations()))
  with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()));

-- ── Niveau 2 appliqué : tables ao_ à politique standard <table>_iso ──────────
-- On ne recrée QUE la politique standard <table>_iso (permissive, for all), en
-- y ajoutant la clause de périmètre (null-safe). Les tables à politiques par
-- COMMANDE (ao_decisions, ao_audit_log, ao_outbox) n'ont pas de _iso : elles
-- sont traitées explicitement plus bas pour préserver leurs sémantiques
-- (immutabilité de l'audit = absence de politique update/delete, etc.).
-- On cible la politique d'isolation standard par sa COMMANDE (permissive, for
-- all) et non par son nom (le nommage n'est pas uniforme, p. ex. ao_dd_iso). On
-- la recrée sous le même nom en ajoutant le périmètre. Les politiques par
-- commande (select/insert/delete/update) ne sont pas `for all` ⇒ non touchées.
do $$
declare r record;
begin
  for r in
    select p.polname, c.relname as tbl
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relname like 'ao\_%'
      and p.polcmd = '*' and p.polpermissive
      and exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attname = 'operation_id' and not a.attisdropped)
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, r.tbl);
    execute format(
      'create policy %I on public.%I '
      || 'using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()) '
      || 'and (operation_id is null or operation_id in (select public.ao_user_operations()))) '
      || 'with check (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()) '
      || 'and (operation_id is null or operation_id in (select public.ao_user_operations())))',
      r.polname, r.tbl);
  end loop;
end $$;

-- ── Niveau 2 appliqué : tables à politiques par commande (lecture scindée) ───
-- On ne touche QUE la politique de LECTURE (le correctif v4.1 porte sur la
-- visibilité : « un utilisateur restreint voyait tout »). Les politiques
-- insert/delete/update sont laissées intactes — en particulier l'audit reste
-- immuable (aucune politique update/delete).
drop policy if exists ao_decisions_select on public.ao_decisions;
create policy ao_decisions_select on public.ao_decisions for select
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));

drop policy if exists ao_audit_log_select on public.ao_audit_log;
create policy ao_audit_log_select on public.ao_audit_log for select
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));

drop policy if exists ao_outbox_select on public.ao_outbox;
create policy ao_outbox_select on public.ao_outbox for select
  using (tenant_id in (select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid())
         and (operation_id is null or operation_id in (select public.ao_user_operations())));

-- ── Niveau 3 appliqué : gardes d'écriture par rôle (miroir schema.sql) ───────
-- restrictive ⇒ combiné en ET avec _iso (une politique permissive serait sans
-- effet). Voir supabase/tests/README.md (note de conception).
drop policy if exists ao_operations_write on public.ao_operations;
create policy ao_operations_write on public.ao_operations as restrictive for insert
  with check (public.ao_has_role(array['owner','moa_director']));

drop policy if exists ao_bilan_lines_write on public.ao_bilan_lines;
create policy ao_bilan_lines_write on public.ao_bilan_lines as restrictive for update
  using (public.ao_has_role(array['finance','moa_director']));

drop policy if exists ao_decomptes_write on public.ao_decomptes;
create policy ao_decomptes_write on public.ao_decomptes as restrictive for update
  using (public.ao_has_role(array['finance','moa_director']));

comment on function public.ao_user_operations() is
  'Opérations visibles par auth.uid() (périmètre §5 niveau 2) ; aucune ligne ao_operation_members ⇒ toutes les opérations du tenant.';
comment on function public.ao_has_role(text[]) is
  'Garde de rôle §5 niveau 3 ; aucun rôle assigné ⇒ autorisé (compat migration, activation par utilisateur).';
