-- Atlas Opus — F1 onboarding : relie l'annuaire ao_members au compte utilisateur
-- d'enforcement (auth.uid). Nullable : une invitation en attente n'a pas encore
-- de user_id ; il est renseigné à l'acceptation (sign-up). Permet à l'écran
-- d'attribution des droits de choisir un membre au lieu d'un uuid brut.
-- Sûr : colonne ajoutée nullable, aucune donnée existante impactée.

alter table public.ao_members
  add column if not exists user_id uuid;

create index if not exists ao_members_user_idx on public.ao_members(user_id);

comment on column public.ao_members.user_id is
  'Compte utilisateur lié (auth.uid) ; null tant que l''invitation est en attente. Base de l''attribution des droits (ao_tenant_roles/ao_operation_members).';
