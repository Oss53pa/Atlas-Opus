import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb, createOperationsRepo, createProgramRepo, type MockDb } from './mock';
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
});
