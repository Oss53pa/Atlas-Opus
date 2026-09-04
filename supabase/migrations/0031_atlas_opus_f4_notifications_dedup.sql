-- Atlas Opus — F4 : dédoublonnage des relances/échéances (CLAUDE.md §3).
-- Le job pg_cron « relances & échéances » tourne périodiquement ; sans clé de
-- dédoublonnage il ré-émettrait la même notification à chaque passage. On ajoute
-- une clé métier stable et une contrainte d'unicité par tenant. Colonne nullable
-- (les notifications ad hoc n'en portent pas ; Postgres autorise plusieurs NULL).

alter table public.ao_notifications
  add column if not exists dedup_key text;

-- Unicité par tenant sur la clé (upsert « on conflict do nothing » côté job).
create unique index if not exists ao_notifications_dedup_uq
  on public.ao_notifications(tenant_id, dedup_key)
  where dedup_key is not null;

comment on column public.ao_notifications.dedup_key is
  'Clé métier stable des relances automatiques (F4) — idempotence du cron ; NULL pour les notifications ad hoc.';
