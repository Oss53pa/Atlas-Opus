-- ============================================================================
-- Atlas Opus — Tests RLS (tenant + operation_scope + rôle) · CDC gate.
-- Exécuté sous un rôle NON-propriétaire (`authenticated`) pour que la RLS
-- s'applique réellement. auth.uid() lit le GUC app.user_id (harnais de test).
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
insert into country_config(country_code, zone, currency) values ('CI','UEMOA','XOF') on conflict do nothing;
insert into tenants(id,name,country_code) values (:'tA','Tenant A','CI'), (:'tB','Tenant B','CI');
insert into operations(id,tenant_id,country_code,name,currency) values
  (:'opA1',:'tA','CI','Op A1','XOF'), (:'opA2',:'tA','CI','Op A2','XOF'), (:'opB1',:'tB','CI','Op B1','XOF');
insert into memberships(tenant_id,user_id,role,operation_scope) values
  (:'tA',:'uA_full','moa_director',null),
  (:'tA',:'uA_scoped','site', array[:'opA1']::uuid[]),
  (:'tB',:'uB','finance',null);
insert into program_items(tenant_id,operation_id,category,label,version,status)
  values (:'tA',:'opA1','surface','PI A1',1,'draft'),
         (:'tA',:'opA2','surface','PI A2',1,'draft'),
         (:'tB',:'opB1','surface','PI B1',1,'draft');
insert into budget_lines(tenant_id,operation_id,syscohada_account,label,amount_bac)
  values (:'tA',:'opA1','601','Coût A1',1000), (:'tB',:'opB1','601','Coût B1',2000);

-- ---------- Helper : exécuter une assertion sous un utilisateur ----------
-- (chaque test = une transaction : set_config local + set local role)

-- TEST 1 — Isolation tenant : uA_full voit les 2 ops de A, pas celle de B.
begin;
  set local app.user_id = :'uA_full'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from operations; assert c=2, format('T1 tenant-iso uA_full ops: got %s want 2',c);
    select count(*) into c from operations where id='00000000-0000-0000-0000-00000000b011'; assert c=0, 'T1 uA_full must NOT see Op B1';
    raise notice 'PASS T1 — isolation tenant (uA_full voit 2 ops, pas B)';
  end $$;
commit;

-- TEST 2 — Isolation tenant : uB ne voit que l'op de B.
begin;
  set local app.user_id = :'uB'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from operations; assert c=1, format('T2 tenant-iso uB ops: got %s want 1',c);
    raise notice 'PASS T2 — isolation tenant (uB voit 1 op)';
  end $$;
commit;

-- TEST 3 — operation_scope : uA_scoped (scope=[opA1]) ne voit QUE opA1 (correctif v4.1).
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare c int; begin
    select count(*) into c from operations; assert c=1, format('T3 scope uA_scoped ops: got %s want 1 (opA1 seule)',c);
    select count(*) into c from operations where id='00000000-0000-0000-0000-00000000a012'; assert c=0, 'T3 uA_scoped must NOT see Op A2 (hors périmètre)';
    select count(*) into c from program_items; assert c=1, format('T3 scope child rows: got %s want 1',c);
    raise notice 'PASS T3 — operation_scope (uA_scoped voit opA1 seulement, pas opA2)';
  end $$;
commit;

-- TEST 4 — Rôle écriture : uA_scoped (site) NE DOIT PAS pouvoir modifier un budget_line.
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare n int; begin
    update budget_lines set amount_bac=9999 where operation_id='00000000-0000-0000-0000-00000000a011';
    get diagnostics n = row_count;
    assert n=0, format('T4 role-gate: site a modifié %s ligne(s) de budget — devrait être 0',n);
    raise notice 'PASS T4 — garde rôle (site ne modifie pas budget_lines)';
  end $$;
commit;

-- TEST 5 — Rôle écriture : uB (finance) PEUT modifier un budget_line de son tenant.
begin;
  set local app.user_id = :'uB'; set local role authenticated;
  do $$ declare n int; begin
    update budget_lines set amount_bac=9999 where operation_id='00000000-0000-0000-0000-00000000b011';
    get diagnostics n = row_count;
    assert n=1, format('T5 finance devrait modifier 1 ligne, a modifié %s',n);
    raise notice 'PASS T5 — garde rôle (finance modifie budget_lines)';
  end $$;
commit;

-- TEST 6 — Rôle écriture (INSERT) : uA_scoped (site) NE DOIT PAS créer d'opération.
begin;
  set local app.user_id = :'uA_scoped'; set local role authenticated;
  do $$ declare blocked boolean := false; begin
    begin
      insert into operations(tenant_id,country_code,name,currency)
        values ('00000000-0000-0000-0000-0000000000aa','CI','Op pirate','XOF');
    exception when insufficient_privilege then blocked := true;
    end;
    assert blocked, 'T6 role-gate INSERT: site a pu créer une opération — devrait être bloqué';
    raise notice 'PASS T6 — garde rôle (site ne crée pas d''opération)';
  end $$;
commit;

\echo '>>> TOUS LES TESTS RLS SONT VERTS <<<'
