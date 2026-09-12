-- ============================================================================
-- Atlas Opus — Tests RLS de la PILE DE MIGRATIONS (tables ao_, déployé réel).
-- Complète rls_test.sql (qui valide schema.sql). Vérifie que le correctif
-- 0034 apporte les niveaux 2 (operation_scope) et 3 (rôle) au déployé.
-- Exécuté sous `authenticated` (sinon la RLS est contournée). auth.uid() lit
-- le GUC app.user_id (bootstrap de test).
-- ============================================================================
\set ON_ERROR_STOP on
\set uA_full   '00000000-0000-0000-0000-0000000a0001'
\set uA_scoped '00000000-0000-0000-0000-0000000a0002'
\set uB        '00000000-0000-0000-0000-0000000b0001'
\set tA        '00000000-0000-0000-0000-0000000000aa'
\set tB        '00000000-0000-0000-0000-0000000000bb'
\set opA1      '00000000-0000-0000-0000-00000000a011'
\set opA2      '00000000-0000-0000-0000-00000000a012'
\set opB1      '00000000-0000-0000-0000-00000000b011'

-- ---------- Seed (rôle propriétaire → RLS contournée) ----------
insert into tenants(id,name) values (:'tA','Tenant A'), (:'tB','Tenant B');
insert into user_tenants(user_id,tenant_id) values
  (:'uA_full',:'tA'), (:'uA_scoped',:'tA'), (:'uB',:'tB');
insert into ao_operations(id,tenant_id,country_code,name,currency) values
  (:'opA1',:'tA','CI','Op A1','XOF'), (:'opA2',:'tA','CI','Op A2','XOF'), (:'opB1',:'tB','CI','Op B1','XOF');

-- uA_scoped restreint à opA1 (une ligne ⇒ périmètre explicite) ; uA_full sans
-- ligne ⇒ toutes les opérations du tenant A.
insert into ao_operation_members(tenant_id,user_id,operation_id) values (:'tA',:'uA_scoped',:'opA1');

-- Rôles : uA_scoped = site (pas d'écriture sensible) ; uB = finance.
-- uA_full reste sans rôle (fail-open) pour vérifier la compat migration.
insert into ao_tenant_roles(tenant_id,user_id,role) values
  (:'tA',:'uA_scoped','site'), (:'tB',:'uB','finance');

insert into ao_bilan_lines(tenant_id,operation_id,kind,poste,amount_planned)
  values (:'tA',:'opA1','cost','foncier',1000), (:'tB',:'opB1','cost','foncier',2000);
insert into ao_program_items(tenant_id,operation_id,category,label,version,status)
  values (:'tA',:'opA1','surface','PI A1',1,'draft'),
         (:'tA',:'opA2','surface','PI A2',1,'draft'),
         (:'tB',:'opB1','surface','PI B1',1,'draft');

-- TEST 1 — Tenant : uA_full voit les 2 ops de A, pas B (aucun rôle ⇒ compat).
begin;
  set local app.user_id = :'uA_full'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from ao_operations; assert c=2, format('MT1 uA_full ops: got %s want 2',c);
    select count(*) into c from ao_operations where id='00000000-0000-0000-0000-00000000b011'; assert c=0, 'MT1 uA_full must NOT see Op B1';
    raise notice 'PASS MT1 — tenant (uA_full voit 2 ops de A, pas B)';
  end $$;
commit;

-- TEST 2 — Tenant : uB ne voit que l'op de B.
begin;
  set local app.user_id = :'uB'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from ao_operations; assert c=1, format('MT2 uB ops: got %s want 1',c);
    raise notice 'PASS MT2 — tenant (uB voit 1 op)';
  end $$;
commit;

-- TEST 3 — operation_scope (0034) : uA_scoped ne voit QUE opA1 — ni opA2, ni ses filles.
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from ao_operations; assert c=1, format('MT3 scope ops: got %s want 1',c);
    select count(*) into c from ao_operations where id='00000000-0000-0000-0000-00000000a012'; assert c=0, 'MT3 uA_scoped must NOT see Op A2';
    select count(*) into c from ao_program_items; assert c=1, format('MT3 scope filles: got %s want 1',c);
    raise notice 'PASS MT3 — operation_scope déployé (uA_scoped = opA1 seule)';
  end $$;
commit;

-- TEST 4 — Rôle (0034) : uA_scoped (site) NE PEUT PAS modifier ao_bilan_lines.
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare n int; begin
    update ao_bilan_lines set amount_planned=9999 where operation_id='00000000-0000-0000-0000-00000000a011';
    get diagnostics n = row_count;
    assert n=0, format('MT4 role-gate: site a modifié %s ligne(s) bilan — devrait être 0',n);
    raise notice 'PASS MT4 — garde rôle (site ne modifie pas ao_bilan_lines)';
  end $$;
commit;

-- TEST 5 — Rôle (0034) : uB (finance) PEUT modifier ao_bilan_lines de son tenant.
begin;
  set local app.user_id = :'uB'; set local role authenticated;
  do $$ declare n int; begin
    update ao_bilan_lines set amount_planned=9999 where operation_id='00000000-0000-0000-0000-00000000b011';
    get diagnostics n = row_count;
    assert n=1, format('MT5 finance devrait modifier 1 ligne, a modifié %s',n);
    raise notice 'PASS MT5 — garde rôle (finance modifie ao_bilan_lines)';
  end $$;
commit;

-- TEST 6 — Compat migration (fail-open) : uA_full (sans rôle) PEUT créer une op.
begin;
  set local app.user_id = :'uA_full'; set local role authenticated;
  do $$ declare c int; begin
    insert into ao_operations(tenant_id,country_code,name,currency)
      values ('00000000-0000-0000-0000-0000000000aa','CI','Op compat','XOF');
    select count(*) into c from ao_operations; assert c=3, format('MT6 fail-open: uA_full devrait créer (voit %s)',c);
    raise notice 'PASS MT6 — compat migration (sans rôle ⇒ écriture autorisée)';
  end $$;
rollback;  -- ne pas polluer les autres tests

-- TEST 7 — Rôle assigné : uA_scoped (site) NE PEUT PAS créer d'opération.
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare blocked boolean := false; begin
    begin
      insert into ao_operations(tenant_id,country_code,name,currency)
        values ('00000000-0000-0000-0000-0000000000aa','CI','Op pirate','XOF');
    exception when insufficient_privilege then blocked := true;
    end;
    assert blocked, 'MT7 role-gate INSERT: site a pu créer une opération — devrait être bloqué';
    raise notice 'PASS MT7 — garde rôle (site ne crée pas d''opération)';
  end $$;
commit;

-- TEST 8 — Méta : toute table ao_ portant operation_id filtre par ao_user_operations().
do $$ declare bad text; begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relname like 'ao\_%'
    and exists (select 1 from pg_attribute a
                where a.attrelid = c.oid and a.attname = 'operation_id' and not a.attisdropped)
    and not exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.relname
                      and p.qual like '%ao_user_operations%');
  assert bad is null, format('MT8 méta-scope : tables ao_ operation_id sans filtre : %s', bad);
  raise notice 'PASS MT8 — méta : toutes les tables ao_ operation_id filtrent par périmètre';
end $$;

-- TEST 9 — Immutabilité de l'audit préservée : 0034 ne doit PAS avoir ajouté de
-- politique update/delete sur ao_audit_log (il n'a que select + insert).
do $$ declare c int; begin
  select count(*) into c from pg_policies
  where schemaname='public' and tablename='ao_audit_log' and cmd in ('UPDATE','DELETE','ALL');
  assert c=0, format('MT9 audit immuable : %s politique(s) update/delete/all sur ao_audit_log (attendu 0)', c);
  raise notice 'PASS MT9 — audit immuable (aucune politique update/delete après 0034)';
end $$;

-- TEST 10 — Vocabulaire de rôle aligné (0035) : 'procurement' (type app Role)
-- accepté, 'moe' (ancien vocabulaire 0034) rejeté par le CHECK.
begin;
  do $$ declare ok boolean := true; blocked boolean := false; begin
    begin
      insert into ao_tenant_roles(tenant_id,user_id,role)
        values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000a0001','procurement');
    exception when others then ok := false;
    end;
    assert ok, 'MT10 vocab rôle : procurement devrait être accepté';
    begin
      insert into ao_tenant_roles(tenant_id,user_id,role)
        values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000a0001','moe');
    exception when check_violation then blocked := true;
    end;
    assert blocked, 'MT10 vocab rôle : moe devrait être rejeté (hors vocabulaire app)';
    raise notice 'PASS MT10 — vocabulaire de rôle aligné (procurement ok, moe rejeté)';
  end $$;
rollback;

\echo '>>> TESTS RLS MIGRATIONS (déployé ao_) VERTS <<<'
