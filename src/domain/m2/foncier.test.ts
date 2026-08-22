import { describe, it, expect } from 'vitest';
import {
  evaluateAcquisition,
  hasVerifiedNotarialDeed,
  nextAcquisitionStatus,
  acquisitionProgress,
  validateParcel,
  validateTitle,
  type AcquisitionContext,
  type LandParcel,
  type TitleDocument,
} from './foncier';

const parcel = (over: Partial<LandParcel> = {}): Pick<LandParcel, 'tenureType'> => ({
  tenureType: 'titre_foncier',
  ...over,
});
const ctx = (over: Partial<AcquisitionContext> = {}): AcquisitionContext => ({
  suspensiveConditions: [],
  titles: [],
  ...over,
});
const deed = (status: TitleDocument['status']): Pick<TitleDocument, 'docType' | 'status'> => ({
  docType: 'acte_notarie',
  status,
});

describe('M2 foncier — machine d’acquisition (§4)', () => {
  it('chaîne prospection → sous_promesse → conditions_levees → acquis', () => {
    expect(nextAcquisitionStatus('prospection')).toBe('sous_promesse');
    expect(nextAcquisitionStatus('sous_promesse')).toBe('conditions_levees');
    expect(nextAcquisitionStatus('conditions_levees')).toBe('acquis');
    expect(nextAcquisitionStatus('acquis')).toBeNull();
  });

  it('refuse une transition illégale (saut d’étape)', () => {
    expect(evaluateAcquisition('prospection', 'acquis', parcel(), ctx())).toEqual({
      ok: false,
      code: 'invalid_transition',
    });
  });

  it('RG-M2-05 — condition suspensive non levée bloque conditions_levees', () => {
    const d = evaluateAcquisition('sous_promesse', 'conditions_levees', parcel(), ctx({ suspensiveConditions: ['bornage'] }));
    expect(d).toEqual({ ok: false, code: 'conditions_pending' });
    expect(evaluateAcquisition('sous_promesse', 'conditions_levees', parcel(), ctx())).toEqual({
      ok: true,
      to: 'conditions_levees',
    });
  });

  it('RG-M2-02 — titre_foncier « acquis » exige un acte notarié vérifié', () => {
    expect(evaluateAcquisition('conditions_levees', 'acquis', parcel({ tenureType: 'titre_foncier' }), ctx())).toEqual({
      ok: false,
      code: 'notarial_deed_required',
    });
    expect(
      evaluateAcquisition('conditions_levees', 'acquis', parcel({ tenureType: 'titre_foncier' }), ctx({ titles: [deed('pending')] })),
    ).toEqual({ ok: false, code: 'notarial_deed_required' });
    expect(
      evaluateAcquisition('conditions_levees', 'acquis', parcel({ tenureType: 'titre_foncier' }), ctx({ titles: [deed('verified')] })),
    ).toEqual({ ok: true, to: 'acquis' });
  });

  it('RG-M2-02 — autre régime foncier n’exige pas l’acte notarié', () => {
    expect(
      evaluateAcquisition('conditions_levees', 'acquis', parcel({ tenureType: 'droit_coutumier' }), ctx()),
    ).toEqual({ ok: true, to: 'acquis' });
  });

  it('hasVerifiedNotarialDeed', () => {
    expect(hasVerifiedNotarialDeed([deed('verified')])).toBe(true);
    expect(hasVerifiedNotarialDeed([deed('pending'), { docType: 'bornage', status: 'verified' }])).toBe(false);
  });

  it('acquisitionProgress', () => {
    expect(acquisitionProgress('prospection')).toBe(0);
    expect(acquisitionProgress('acquis')).toBe(1);
  });
});

describe('M2 foncier — validations (§8)', () => {
  it('validateParcel', () => {
    expect(validateParcel({ reference: 'TF-1234', tenureType: 'titre_foncier', area: 1200, price: 50_000_000 })).toEqual({});
    expect(validateParcel({ area: -1, price: -1 })).toEqual({
      reference: 'parcel.error.reference',
      tenureType: 'parcel.error.tenureType',
      area: 'parcel.error.area',
      price: 'parcel.error.price',
    });
  });

  it('validateTitle', () => {
    expect(validateTitle({ docType: 'acte_notarie', reference: 'AN-99' })).toEqual({});
    expect(validateTitle({}).docType).toBe('title.error.docType');
  });
});
