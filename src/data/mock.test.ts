import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb, createOperationsRepo, createProgramRepo, createComplianceRepo, createBilanRepo, createStakeholdersRepo, type MockDb } from './mock';
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
});
