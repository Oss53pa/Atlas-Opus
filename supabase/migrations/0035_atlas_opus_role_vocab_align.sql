-- Atlas Opus — Aligne le vocabulaire de rôle de ao_tenant_roles (0034) sur le
-- domaine canonique : le type applicatif `Role` (src/domain/m1/types.ts) et
-- schema.sql (memberships.role). Le CHECK initial de 0034 utilisait un jeu
-- divergent ('moe', sans 'procurement'/'commercial'/'stakeholder') ; on le
-- remplace pour éviter tout rejet d'attribution côté F1 (onboarding).
-- Sûr : ao_tenant_roles n'est pas encore peuplée.
-- Réf : CLAUDE.md §5 (rôle → action), SCHEMA_COHERENCE.md (reliquat F1).

alter table public.ao_tenant_roles
  drop constraint if exists ao_tenant_roles_role_check;

alter table public.ao_tenant_roles
  add constraint ao_tenant_roles_role_check
  check (role in ('owner','moa_director','finance','amo','procurement','commercial','site','stakeholder','viewer'));
