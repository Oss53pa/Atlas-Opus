import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb, createOperationsRepo, createProgramRepo, createComplianceRepo, createBilanRepo, createStakeholdersRepo, createFinancingRepo, createCommercialisationRepo, createGovernanceRepo, createOffersRepo, createRisksRepo, createAuditRepo, type MockDb } from './mock';
import { verifyAuditChain } from '../domain/m23';
import { Money } from '../domain/money/Money';
import { recettesEncaissees } from '../domain/m6';
import type { Session } from './repo';
import { createTelemetry, type Telemetry } from '../lib/telemetry';
import { evaluateTransition } from '../domain/m1/stateMachine';

let n = 0;
const deps = (telemetry: Telemetry) => ({
  telemetry,
  id: () => `id-${++n}`,
  now: () => '2026-06-10T00:00:00.000Z',
});

const sessionFor = (tenantId: string): Session => ({
  userId: 'u-1',
  tenantId,
  role: 'moa_director',
  operationScope: null,
});

describe('Couche données mock — Gherkin §12', () => {
  let db: MockDb;
  let tel: Telemetry;

  beforeEach(() => {
    n = 0;
    db = createMockDb();
    tel = createTelemetry();
  });

  it('Création d’une opération commerciale (amont, devise héritée, télémétrie)', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const op = await ops.create({ name: 'Cosmos X', countryCode: 'CI', opType: 'commercial' });
    expect(op.phase).toBe('amont');
    expect(op.currency).toBe('XOF');
    expect(tel.events).toContainEqual({
      name: 'operation.created',
      operationId: op.id,
      opType: 'commercial',
      countryCode: 'CI',
    });
  });

  it('Transition de phase bloquée : amont sans programme validé', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const op = await ops.create({ name: 'Sans programme', countryCode: 'CI', opType: 'residential' });
    const ctx = await ops.getTransitionContext(op.id);
    const d = evaluateTransition('amont', 'conception', ctx, { role: 'moa_director' });
    expect(d.ok).toBe(false);
    if (!d.ok && d.code === 'guard_unmet') {
      expect(d.missing).toContain('op.transition.cond.programValidated');
    } else {
      throw new Error('attendu guard_unmet');
    }
  });

  it('Isolation multitenant : un tenant ne voit pas les opérations d’un autre', async () => {
    const demo = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const names = (await demo.list()).map((o) => o.name);
    expect(names).not.toContain('Tour Atlantique'); // tenant-other
    expect(await demo.get('op-atlantique')).toBeNull();

    const other = createOperationsRepo(db, sessionFor('tenant-other'), deps(tel));
    expect((await other.list()).map((o) => o.name)).toEqual(['Tour Atlantique']);
  });

  it('Périmètre du membership (operation_scope) restreint la liste', async () => {
    const scoped = createOperationsRepo(
      db,
      { userId: 'u', tenantId: 'tenant-demo', role: 'site', operationScope: ['op-palmiers'] },
      deps(tel),
    );
    expect((await scoped.list()).map((o) => o.id)).toEqual(['op-palmiers']);
  });

  it('RG-M1-11 : valider le programme incrémente la version et conserve l’historique', async () => {
    const session = sessionFor('tenant-demo');
    const program = createProgramRepo(db, session, deps(tel));
    expect(await program.versions('op-cosmos')).toEqual([1]);
    const before = await program.currentVersion('op-cosmos');

    const frozen = await program.validateVersion('op-cosmos');
    expect(frozen).toBe(before);
    expect(await program.versions('op-cosmos')).toEqual([1]); // v1 figée
    expect(await program.currentVersion('op-cosmos')).toBe(before + 1); // copie de travail ouverte
    expect(tel.events).toContainEqual({ name: 'program.version_created', operationId: 'op-cosmos', version: frozen });

    // L'historique reste consultable
    expect((await program.list('op-cosmos', 1)).length).toBeGreaterThan(0);
  });

  it('Programme validé débloque la garde programValidated', async () => {
    const session = sessionFor('tenant-demo');
    const ops = createOperationsRepo(db, session, deps(tel));
    const program = createProgramRepo(db, session, deps(tel));
    const op = await ops.create({
      name: 'Avec programme',
      countryCode: 'CI',
      opType: 'residential',
      program: [{ category: 'surface', label: 'Surface', targetValue: '1000', unit: 'm²' }],
    });
    let ctx = await ops.getTransitionContext(op.id);
    expect(ctx.validatedProgramItems).toBe(0);
    await program.validateVersion(op.id);
    ctx = await ops.getTransitionContext(op.id);
    expect(ctx.validatedProgramItems).toBeGreaterThanOrEqual(1);
  });

  it('Gardes permis (M2) & DO (M7) dérivées des tables authorizations/insurances', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));

    // op-palmiers : permis « granted » + police DO couvrante → gardes levées.
    const palmiers = await ops.getTransitionContext('op-palmiers');
    expect(palmiers.permitGranted).toBe(true);
    expect(palmiers.doInsuranceValid).toBe(true);

    // op-cosmos : permis « submitted » + aucune DO → gardes bloquantes.
    const cosmos = await ops.getTransitionContext('op-cosmos');
    expect(cosmos.permitGranted).toBe(false);
    expect(cosmos.doInsuranceValid).toBe(false);
  });

  it('Garde DD (M2) dérivée : Riviera bloquée par litige critique, Palmiers levée', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    // op-riviera : litige « critical » ouvert → DD non levée.
    expect((await ops.getTransitionContext('op-riviera')).ddCleared).toBe(false);
    // op-palmiers : seule réserve « high » déjà « cleared » → DD levée.
    expect((await ops.getTransitionContext('op-palmiers')).ddCleared).toBe(true);
  });

  it('Une DD critique ouverte bloque amont → conception (RG-M2-03)', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const ctx = await ops.getTransitionContext('op-riviera');
    const d = evaluateTransition(
      'amont',
      'conception',
      { ...ctx, validatedProgramItems: 1, bilanInitialized: true },
      { role: 'moa_director' },
    );
    expect(d.ok).toBe(false);
    if (!d.ok && d.code === 'guard_unmet') {
      expect(d.missing).toContain('op.transition.cond.ddCleared');
    } else {
      throw new Error('attendu guard_unmet');
    }
  });

  it('Une opération sans permis ni DO ne peut pas passer en réalisation', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const ctx = await ops.getTransitionContext('op-cosmos');
    // Même avec un marché notifié, l'absence de permis/DO bloque (RG-M2-07 / RG-M7-04).
    const d = evaluateTransition('passation', 'realisation', { ...ctx, marketsNotified: 1 }, { role: 'moa_director' });
    expect(d.ok).toBe(false);
    if (!d.ok && d.code === 'guard_unmet') {
      expect(d.missing).toContain('op.transition.cond.permitGranted');
      expect(d.missing).toContain('op.transition.cond.doInsurance');
    } else {
      throw new Error('attendu guard_unmet');
    }
  });

  it('CRUD conformité : ajouter permis « granted » + DO lève les gardes de réalisation', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const compliance = createComplianceRepo(db, sessionFor('tenant-demo'), deps(tel));

    let ctx = await ops.getTransitionContext('op-cosmos');
    expect(ctx.permitGranted).toBe(false);
    expect(ctx.doInsuranceValid).toBe(false);

    const permit = await compliance.addAuthorization('op-cosmos', { type: 'permis_construire', authority: 'Mairie', validity: '2031-01-01' });
    // Machine à états gardée : draft → submitted → granted (pas de saut direct).
    await compliance.setAuthorizationStatus(permit.id, 'submitted');
    await compliance.setAuthorizationStatus(permit.id, 'granted');
    await compliance.addInsurance('op-cosmos', { type: 'DO', insurer: 'NSIA', validFrom: '2026-01-01', validTo: '2031-01-01' });

    ctx = await ops.getTransitionContext('op-cosmos');
    expect(ctx.permitGranted).toBe(true);
    expect(ctx.doInsuranceValid).toBe(true);
  });

  it('CRUD conformité : lever une DD critique débloque la garde conception', async () => {
    const ops = createOperationsRepo(db, sessionFor('tenant-demo'), deps(tel));
    const compliance = createComplianceRepo(db, sessionFor('tenant-demo'), deps(tel));

    expect((await ops.getTransitionContext('op-riviera')).ddCleared).toBe(false);
    const items = await compliance.dueDiligence('op-riviera');
    const critical = items.find((i) => i.severity === 'critical' && i.status === 'open')!;
    await compliance.setDueDiligenceStatus(critical.id, 'cleared');
    expect((await ops.getTransitionContext('op-riviera')).ddCleared).toBe(true);
  });

  it('CRUD conformité : isolation tenant sur les autorisations', async () => {
    const other = createComplianceRepo(db, sessionFor('tenant-other'), deps(tel));
    expect(await other.authorizations('op-palmiers')).toEqual([]);
  });

  it('Foncier : ajout parcelle (prospection), titres, suppression cascade', async () => {
    const compliance = createComplianceRepo(db, sessionFor('tenant-demo'), deps(tel));
    const p = await compliance.addLandParcel('op-cosmos', { reference: 'TF-NEW', area: 1000, tenureType: 'titre_foncier', price: 10_000_000 });
    expect(p.acquisitionStatus).toBe('prospection');

    const td = await compliance.addTitle(p.id, { docType: 'acte_notarie', reference: 'AN-1' });
    expect(td.status).toBe('pending');
    const verified = await compliance.setTitleStatus(td.id, 'verified');
    expect(verified.status).toBe('verified');
    expect(await compliance.titles(p.id)).toHaveLength(1);

    await compliance.removeLandParcel(p.id);
    expect((await compliance.landParcels('op-cosmos')).some((x) => x.id === p.id)).toBe(false);
    expect(await compliance.titles(p.id)).toHaveLength(0); // titres en cascade
  });

  it('Foncier : parcelle Palmiers seedée « acquis » avec acte notarié vérifié', async () => {
    const compliance = createComplianceRepo(db, sessionFor('tenant-demo'), deps(tel));
    const parcels = await compliance.landParcels('op-palmiers');
    expect(parcels).toHaveLength(1);
    expect(parcels[0].acquisitionStatus).toBe('acquis');
    const titles = await compliance.titles(parcels[0].id);
    expect(titles.some((td) => td.docType === 'acte_notarie' && td.status === 'verified')).toBe(true);
  });

  it('Foncier : isolation tenant sur les parcelles', async () => {
    const other = createComplianceRepo(db, sessionFor('tenant-other'), deps(tel));
    expect(await other.landParcels('op-palmiers')).toEqual([]);
  });

  it('Financement CRUD : source négociée, tranche planifiée, déblocage gardé par l’avancement (RG-M5-01)', async () => {
    const financing = createFinancingRepo(db, sessionFor('tenant-demo'), deps(tel));
    const f = await financing.add('op-cosmos', { source: 'bailleur', amount: Money.of(800_000_000, 'XOF'), rate: 0.06 });
    expect(f.status).toBe('negocie');
    const d = await financing.addDrawdown(f.id, { amount: Money.of(200_000_000, 'XOF'), condition: 0.3 });
    expect(d.status).toBe('planifie');

    const demande = await financing.setDrawdownStatus(d.id, 'demande');
    expect(demande.status).toBe('demande');
    // Déblocage effectif : la garde RG-M5-01 est évaluée côté écran (evaluateDrawdown) ;
    // le repo persiste le statut + la date de déblocage.
    const released = await financing.setDrawdownStatus(d.id, 'debloque', '2026-06-01');
    expect(released.status).toBe('debloque');
    expect(released.date).toBe('2026-06-01');

    await financing.remove(f.id);
    expect((await financing.list('op-cosmos')).some((x) => x.id === f.id)).toBe(false);
    expect(await financing.drawdowns(f.id)).toHaveLength(0); // tranches en cascade
  });

  it('Financement : isolation tenant', async () => {
    const other = createFinancingRepo(db, sessionFor('tenant-other'), deps(tel));
    expect(await other.list('op-palmiers')).toEqual([]);
  });

  it('Commercialisation CRUD : unité → réservation → encaissement (RG-M6-02)', async () => {
    const com = createCommercialisationRepo(db, sessionFor('tenant-demo'), deps(tel));
    const u = await com.addUnit('op-cosmos', { typology: 'Cellule A', area: 120, price: Money.of(80_000_000, 'XOF') });
    expect(u.status).toBe('disponible');
    const s = await com.addSale('op-cosmos', { kind: 'reservation', unitId: u.id, counterpart: 'Enseigne X', amount: Money.of(80_000_000, 'XOF') });
    expect(s.status).toBe('draft');

    const r1 = await com.addReceipt(s.id, { amount: Money.of(4_000_000, 'XOF'), method: 'virement' });
    await com.setReceiptStatus(r1.id, 'settled');
    await com.addReceipt(s.id, { amount: Money.of(1_000_000, 'XOF'), method: 'mobile_money' }); // pending
    const receipts = await com.receipts(s.id);
    expect(recettesEncaissees(receipts, 'XOF').equals(Money.of(4_000_000, 'XOF'))).toBe(true);

    await com.removeSale(s.id);
    expect(await com.receipts(s.id)).toHaveLength(0); // encaissements en cascade
  });

  it('Commercialisation : parcours seed Palmiers (unité vendue, recettes settled)', async () => {
    const com = createCommercialisationRepo(db, sessionFor('tenant-demo'), deps(tel));
    const units = await com.units('op-palmiers');
    expect(units.some((u) => u.status === 'vendu')).toBe(true);
    const receipts = await com.receipts('sa-p1');
    expect(recettesEncaissees(receipts, 'XOF').gt(Money.zero('XOF'))).toBe(true);
  });

  it('Commercialisation : isolation tenant', async () => {
    const other = createCommercialisationRepo(db, sessionFor('tenant-other'), deps(tel));
    expect(await other.units('op-palmiers')).toEqual([]);
  });

  it('Recettes M6 → bilan M4 : recettesRealisees = encaissements settled (RG-M6-02)', async () => {
    const bilan = createBilanRepo(db, sessionFor('tenant-demo'), deps(tel));
    const com = createCommercialisationRepo(db, sessionFor('tenant-demo'), deps(tel));
    // Seed Palmiers : re-p1 (2,1M) + re-p2 (14,7M) settled = 16,8M ; re-p3 pending exclu.
    const view = await bilan.summary('op-palmiers');
    expect(view!.summary.recettesRealisees.equals(Money.of(16_800_000, 'XOF'))).toBe(true);

    // Encaisser un montant supplémentaire met à jour la recette réalisée.
    const r = await com.addReceipt('sa-p2', { amount: Money.of(2_750_000, 'XOF'), method: 'virement' });
    await com.setReceiptStatus(r.id, 'settled');
    const after = await bilan.summary('op-palmiers');
    expect(after!.summary.recettesRealisees.equals(Money.of(19_550_000, 'XOF'))).toBe(true);
  });

  it('Financement M5 → bilan M4 : frais_financiers dérivés des tranches débloquées (RG-M5-02)', async () => {
    const bilan = createBilanRepo(db, sessionFor('tenant-demo'), deps(tel));
    const lines = await bilan.lines('op-palmiers');
    const ff = lines.filter((l) => l.kind === 'cost' && l.poste === 'frais_financiers');
    // Une seule ligne dérivée, > 0 (tranche dw-p1 débloquée ; dw-p2 « demande » ignorée).
    expect(ff).toHaveLength(1);
    expect(ff[0].amountPlanned).toBeGreaterThan(0);
    // La ligne frais_financiers seedée manuellement (bl-p5) est supersédée (pas de doublon).
    expect(lines.filter((l) => l.poste === 'frais_financiers')).toHaveLength(1);
  });

  it('Honoraires M7 → bilan M4 : poste honoraires dérivé des intervenants (RG-M7-09)', async () => {
    const bilan = createBilanRepo(db, sessionFor('tenant-demo'), deps(tel));
    // Palmiers : MOE 180M + BET 60M = 240M honoraires ; entreprise 1450M exclue (travaux).
    const lines = await bilan.lines('op-palmiers');
    const hono = lines.filter((l) => l.kind === 'cost' && l.poste === 'honoraires');
    expect(hono).toHaveLength(1);
    expect(hono[0].amountPlanned).toBe(240_000_000);
  });

  it('Honoraires M7 → bilan M4 : ajouter un intervenant met à jour le poste', async () => {
    const bilan = createBilanRepo(db, sessionFor('tenant-demo'), deps(tel));
    const stakeholders = createStakeholdersRepo(db, sessionFor('tenant-demo'), deps(tel));
    await stakeholders.add('op-palmiers', { type: 'amo', name: 'AMO Conseil', feeAmount: 40_000_000 });
    const lines = await bilan.lines('op-palmiers');
    const hono = lines.find((l) => l.kind === 'cost' && l.poste === 'honoraires')!;
    expect(hono.amountPlanned).toBe(280_000_000); // 240M + 40M
  });

  it('Gouvernance M7 : RACI refuse un second « A » sur une même activité (RG-M7-07)', async () => {
    const gov = createGovernanceRepo(db, sessionFor('tenant-demo'), deps(tel));
    await gov.addRaci('op-cosmos', { activity: 'Conception', stakeholderId: 'st-c1', raci: 'A' });
    await gov.addRaci('op-cosmos', { activity: 'Conception', stakeholderId: 'st-c2', raci: 'C' }); // autre rôle : OK
    await expect(
      gov.addRaci('op-cosmos', { activity: 'Conception', stakeholderId: 'st-c2', raci: 'A' }),
    ).rejects.toThrow('raci_duplicate_accountable');
    // Un « A » sur une autre activité reste autorisé.
    const other = await gov.addRaci('op-cosmos', { activity: 'Passation', stakeholderId: 'st-c1', raci: 'A' });
    expect(other.raci).toBe('A');
  });

  it('Gouvernance M7 : registre append-only, ordre antéchronologique, isolation tenant (RG-M7-08)', async () => {
    const gov = createGovernanceRepo(db, sessionFor('tenant-demo'), deps(tel));
    const before = await gov.decisions('op-palmiers');
    expect(before.length).toBeGreaterThan(0);
    const rec = await gov.addDecision('op-palmiers', {
      kind: 'courrier', reference: 'C-2026-099', date: '2026-07-01', decidedBy: 'MOA', summary: 'Notification',
    });
    const after = await gov.decisions('op-palmiers');
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].id).toBe(rec.id); // le plus récent en tête
    // GovernanceRepo n'expose aucune méthode d'édition/suppression de décision.
    expect('updateDecision' in gov).toBe(false);
    expect('removeDecision' in gov).toBe(false);
    // Isolation tenant.
    const other = createGovernanceRepo(db, sessionFor('tenant-other'), deps(tel));
    expect(await other.decisions('op-palmiers')).toEqual([]);
    expect(await other.raci('op-palmiers')).toEqual([]);
  });
});

describe('Machines à états gardées au point de mutation (RG CLAUDE.md §5)', () => {
  let db: MockDb;
  let tel: Telemetry;
  beforeEach(() => { n = 0; db = createMockDb(); tel = createTelemetry(); });

  it('autorisation : draft→granted rejeté, chemin draft→submitted→granted accepté', async () => {
    const c = createComplianceRepo(db, sessionFor('tenant-demo'), deps(tel));
    const a = await c.addAuthorization('op-cosmos', { type: 'permis_construire', authority: 'Mairie', validity: null });
    await expect(c.setAuthorizationStatus(a.id, 'granted')).rejects.toThrow('invalid_transition');
    const submitted = await c.setAuthorizationStatus(a.id, 'submitted');
    expect(submitted.status).toBe('submitted');
    const granted = await c.setAuthorizationStatus(a.id, 'granted');
    expect(granted.status).toBe('granted');
    // Depuis un état terminal, plus aucune transition.
    await expect(c.setAuthorizationStatus(a.id, 'submitted')).rejects.toThrow('invalid_transition');
  });

  it('offre : reçue→retenue rejeté (doit passer par conforme)', async () => {
    const offers = createOffersRepo(db, sessionFor('tenant-demo'), deps(tel));
    const o = await offers.add('op-palmiers', { tenderId: null, bidder: 'ACME', amount: 1000, scoreTechnical: 80 });
    await expect(offers.setStatus(o.id, 'retenu')).rejects.toThrow('invalid_transition');
    const conforme = await offers.setStatus(o.id, 'conforme');
    expect(conforme.status).toBe('conforme');
    const retenu = await offers.setStatus(o.id, 'retenu');
    expect(retenu.status).toBe('retenu');
  });

  it('risque : clos→maîtrisé rejeté, réouverture clos→ouvert acceptée', async () => {
    const risks = createRisksRepo(db, sessionFor('tenant-demo'), deps(tel));
    const r = await risks.add('op-palmiers', { code: 'R-99', label: 'Test', category: 'technique', probability: 3, impact: 3 });
    const clos = await risks.setStatus(r.id, 'clos'); // ouvert→clos autorisé
    expect(clos.status).toBe('clos');
    await expect(risks.setStatus(r.id, 'maitrise')).rejects.toThrow('invalid_transition');
    const reopened = await risks.setStatus(r.id, 'ouvert');
    expect(reopened.status).toBe('ouvert');
  });
});

describe('Journal d’audit rejouable (chaîne SHA-256 au point de mutation)', () => {
  let db: MockDb;
  let tel: Telemetry;
  beforeEach(() => { n = 0; db = createMockDb(); tel = createTelemetry(); });

  it('le journal seedé se rejoue et vérifie', async () => {
    const audit = createAuditRepo(db, sessionFor('tenant-demo'), deps(tel));
    const entries = await audit.list('op-palmiers');
    expect(entries.length).toBeGreaterThan(0);
    expect(verifyAuditChain(entries)).toEqual({ ok: true, brokenAt: null, reason: 'ok' });
  });

  it('une entrée ajoutée prolonge la chaîne et reste vérifiable', async () => {
    const audit = createAuditRepo(db, sessionFor('tenant-demo'), deps(tel));
    const before = await audit.list('op-palmiers');
    const added = await audit.append('op-palmiers', { action: 'approve', module: 'M15', object: 'Décompte n°3', summary: 'Validation' });
    // Chaînage : la nouvelle entrée référence le hash de la précédente (tip).
    const tipHash = before.map((e) => e).sort((a, b) => (a.at < b.at ? 1 : -1))[0].hash;
    expect(added.hashPrev).toBe(tipHash);
    const after = await audit.list('op-palmiers');
    expect(verifyAuditChain(after)).toEqual({ ok: true, brokenAt: null, reason: 'ok' });
  });

  it('altérer une entrée du journal est détecté', async () => {
    const audit = createAuditRepo(db, sessionFor('tenant-demo'), deps(tel));
    const entries = await audit.list('op-palmiers');
    const tampered = entries.map((e, i) => (i === 0 ? { ...e, summary: 'FALSIFIÉ' } : e));
    expect(verifyAuditChain(tampered).ok).toBe(false);
  });
});
