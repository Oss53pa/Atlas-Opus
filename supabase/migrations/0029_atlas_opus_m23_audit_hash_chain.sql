-- Atlas Opus — Journal d'audit rejouable : chaîne de hachage SHA-256 (M23).
-- Chaque entrée référence le hash de la précédente (par opération) et porte son
-- propre hash ; le journal devient inaltérable ET vérifiable hors ligne
-- (CLAUDE.md §5). Toujours append-only : aucune policy update/delete.

alter table public.ao_audit_log
  add column if not exists hash_prev text not null default repeat('0', 64),
  add column if not exists hash text not null default '';

-- Index de rejeu : parcours chronologique par opération.
create index if not exists ao_audit_log_chain_idx on public.ao_audit_log(operation_id, at);

comment on column public.ao_audit_log.hash_prev is 'Hash de l''entrée précédente de l''opération (genesis = 64 zéros).';
comment on column public.ao_audit_log.hash is 'SHA-256(hash_prev ‖ payload) — scellé côté serveur (Edge Function) en production.';
