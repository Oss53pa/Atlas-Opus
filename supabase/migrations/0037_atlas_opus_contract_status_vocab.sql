-- Atlas Opus — Aligne ao_contracts.status sur le vocabulaire applicatif.
-- Le type `ContractStatus` (src/domain/payments/types.ts) vaut
-- 'draft' | 'active' | 'closed', mais le CHECK déployé n'autorisait que
-- 'active'/'closed' : un futur flux « contrat en brouillon » aurait été rejeté.
-- On élargit (backward-compatible : les lignes existantes active/closed restent
-- valides ; aucune valeur retirée). Issu de l'audit vocabulaires CHECK ↔ enums.

alter table public.ao_contracts
  drop constraint if exists ao_contracts_status_check;

alter table public.ao_contracts
  add constraint ao_contracts_status_check
  check (status in ('draft', 'active', 'closed'));
