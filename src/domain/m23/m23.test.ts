import { describe, it, expect } from 'vitest';
import { canModifyAudit, sortByDateDesc, groupByDay, distinctModules, GENESIS_HASH, computeAuditHash, verifyAuditChain, chronological } from './audit';
import { sha256Hex } from './sha256';
import type { AuditEntry } from './types';

const e = (id: string, at: string, module: string): AuditEntry => ({
  id, tenantId: 't', operationId: 'op', at, actor: 'MOA', action: 'update', module, object: 'x', summary: null,
  hashPrev: GENESIS_HASH, hash: '',
});

/** Scelle une liste d'entrées en une chaîne valide (ordre chronologique). */
function seal(entries: AuditEntry[]): AuditEntry[] {
  let prev = GENESIS_HASH;
  return chronological(entries).map((base) => {
    const sealed = { ...base, hashPrev: prev, hash: computeAuditHash(prev, base) };
    prev = sealed.hash;
    return sealed;
  });
}

describe('M23 — journal append-only', () => {
  it('une entrée n’est jamais modifiable', () => {
    expect(canModifyAudit()).toBe(false);
  });
  it('tri antéchronologique', () => {
    const s = sortByDateDesc([e('a', '2026-08-01T10:00:00Z', 'M4'), e('b', '2026-08-02T09:00:00Z', 'M4')]);
    expect(s.map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('regroupement par jour, jours décroissants', () => {
    const g = groupByDay([
      e('a', '2026-08-01T10:00:00Z', 'M4'),
      e('b', '2026-08-02T09:00:00Z', 'M8'),
      e('c', '2026-08-02T12:00:00Z', 'M4'),
    ]);
    expect(g.map((x) => x.day)).toEqual(['2026-08-02', '2026-08-01']);
    expect(g[0].entries.map((x) => x.id)).toEqual(['c', 'b']); // 12h avant 9h
  });
  it('modules distincts', () => {
    expect(distinctModules([e('a', '2026-08-01T10:00:00Z', 'M4'), e('b', '2026-08-01T11:00:00Z', 'M4'), e('c', '2026-08-01T12:00:00Z', 'M8')])).toBe(2);
  });
});

describe('M23 — SHA-256 (vecteurs FIPS 180-4)', () => {
  it('empreintes de référence', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });
});

describe('M23 — journal rejouable (chaîne de hachage)', () => {
  const raw = [
    e('a', '2026-08-01T10:00:00Z', 'M1'),
    e('b', '2026-08-02T09:00:00Z', 'M4'),
    e('c', '2026-08-03T08:00:00Z', 'M16'),
  ];

  it('une chaîne scellée se rejoue et vérifie (genesis + 3 entrées)', () => {
    const chain = seal(raw);
    expect(chain[0].hashPrev).toBe(GENESIS_HASH);
    expect(chain[1].hashPrev).toBe(chain[0].hash);
    expect(chain[2].hashPrev).toBe(chain[1].hash);
    expect(verifyAuditChain(chain)).toEqual({ ok: true, brokenAt: null, reason: 'ok' });
  });

  it('modifier le contenu d’une entrée casse son hash (inaltérabilité)', () => {
    const chain = seal(raw);
    const tampered = chain.map((x, i) => (i === 1 ? { ...x, object: 'MODIFIÉ' } : x));
    const check = verifyAuditChain(tampered);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('hash_mismatch');
    expect(check.brokenAt).toBe(1);
  });

  it('supprimer une entrée casse le chaînage', () => {
    const chain = seal(raw);
    const withHole = [chain[0], chain[2]]; // entrée du milieu retirée
    const check = verifyAuditChain(withHole);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('broken_link');
    expect(check.brokenAt).toBe(1);
  });

  it('journal vide : intégrité triviale', () => {
    expect(verifyAuditChain([]).ok).toBe(true);
  });
});
