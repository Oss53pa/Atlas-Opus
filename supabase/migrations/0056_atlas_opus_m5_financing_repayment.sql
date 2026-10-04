-- Atlas Opus — M5 (financement) : conditions de remboursement, pour le plan de
-- financement (échéance mensuelle, coût du crédit, service de la dette).
-- Colonnes additives et nullables : aucune donnée existante n'est modifiée.
-- RLS inchangée (héritée de ao_financing).

alter table public.ao_financing
  add column if not exists duration_months int check (duration_months is null or duration_months > 0),
  add column if not exists repayment text not null default 'in_fine'
    check (repayment in ('in_fine', 'amortissable'));
