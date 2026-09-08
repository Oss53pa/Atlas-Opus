-- Atlas Opus — M15/F6 : scellement fiscal du décompte au mandatement.
-- Le net à payer et sa décomposition (TVA + retenues) sont figés au moment du
-- mandatement par l'Edge Function ao-mandatement (service_role, garde de rôle,
-- audit chaîné). Le calcul monétaire reste en TypeScript (Money.ts, invariant §5) ;
-- l'Edge vérifie la cohérence des composantes fournies puis les persiste.
-- Colonnes nullables : renseignées uniquement à partir du mandatement.

alter table public.ao_decomptes
  add column if not exists vat_rate numeric(7,4),
  add column if not exists wht_rate numeric(7,4),
  add column if not exists tva numeric(18,2),
  add column if not exists retenue_source numeric(18,2),
  add column if not exists net_a_payer numeric(18,2),
  add column if not exists sealed_at timestamptz;

comment on column public.ao_decomptes.net_a_payer is
  'Net à payer scellé au mandatement (F6) : base_ht + tva − retenue_source − retenue_garantie − avance − pénalités. Calcul Money.ts.';
comment on column public.ao_decomptes.sealed_at is
  'Horodatage du scellement fiscal (transition → mandated).';
