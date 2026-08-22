/**
 * M2 — Foncier : parcelles, titres, acquisition (réf Spec M2 §3/§4/§5), domaine pur.
 * Machine d'acquisition : prospection → sous_promesse → conditions_levées → acquis.
 * Un titre_foncier exige un acte notarié vérifié pour « acquis » (RG-M2-02) ;
 * une condition suspensive non levée bloque conditions_levées (RG-M2-05).
 */

export const TENURE_TYPES = ['titre_foncier', 'bail_emphyteotique', 'droit_coutumier', 'concession'] as const;
export type TenureType = (typeof TENURE_TYPES)[number];

export const ACQUISITION_STATUSES = ['prospection', 'sous_promesse', 'conditions_levees', 'acquis'] as const;
export type AcquisitionStatus = (typeof ACQUISITION_STATUSES)[number];

export const TITLE_DOC_TYPES = ['titre_foncier', 'acte_notarie', 'certificat', 'bornage'] as const;
export type TitleDocType = (typeof TITLE_DOC_TYPES)[number];

export type TitleDocStatus = 'pending' | 'verified';

export interface LandParcel {
  id: string;
  tenantId: string;
  operationId: string;
  reference: string;
  area: number;
  tenureType: TenureType;
  price: number;
  acquisitionStatus: AcquisitionStatus;
  notary: string | null;
  /** Conditions suspensives non encore levées (RG-M2-05) ; vide = aucune. */
  suspensiveConditions: string[];
}

export interface TitleDocument {
  id: string;
  tenantId: string;
  parcelId: string;
  docType: TitleDocType;
  reference: string;
  status: TitleDocStatus;
  fileRef: string | null;
}

export interface LandParcelInput {
  reference: string;
  area: number;
  tenureType: TenureType;
  price: number;
  notary?: string | null;
  suspensiveConditions?: string[];
}

export interface TitleDocumentInput {
  docType: TitleDocType;
  reference: string;
  fileRef?: string | null;
}

// ── Machine d'acquisition (§4) ──────────────────────────────────────────────
const TRANSITIONS: Record<AcquisitionStatus, AcquisitionStatus[]> = {
  prospection: ['sous_promesse'],
  sous_promesse: ['conditions_levees'],
  conditions_levees: ['acquis'],
  acquis: [],
};

/** Une parcelle possède-t-elle un acte notarié vérifié ? (RG-M2-02) */
export function hasVerifiedNotarialDeed(titles: Pick<TitleDocument, 'docType' | 'status'>[]): boolean {
  return titles.some((tdoc) => tdoc.docType === 'acte_notarie' && tdoc.status === 'verified');
}

export type AcquisitionDecision =
  | { ok: true; to: AcquisitionStatus }
  | { ok: false; code: 'invalid_transition' }
  | { ok: false; code: 'conditions_pending' }
  | { ok: false; code: 'notarial_deed_required' };

export interface AcquisitionContext {
  /** Conditions suspensives restant à lever (RG-M2-05). */
  suspensiveConditions: string[];
  /** Titres de la parcelle, pour la vérification de l'acte notarié (RG-M2-02). */
  titles: Pick<TitleDocument, 'docType' | 'status'>[];
}

/**
 * Évalue une transition d'acquisition.
 *  - sous_promesse → conditions_levees : refusée si des conditions restent (RG-M2-05).
 *  - conditions_levees → acquis : un titre_foncier exige un acte notarié vérifié (RG-M2-02).
 */
export function evaluateAcquisition(
  from: AcquisitionStatus,
  to: AcquisitionStatus,
  parcel: Pick<LandParcel, 'tenureType'>,
  ctx: AcquisitionContext,
): AcquisitionDecision {
  if (!TRANSITIONS[from].includes(to)) return { ok: false, code: 'invalid_transition' };

  if (from === 'sous_promesse' && to === 'conditions_levees' && ctx.suspensiveConditions.length > 0) {
    return { ok: false, code: 'conditions_pending' };
  }

  if (to === 'acquis' && parcel.tenureType === 'titre_foncier' && !hasVerifiedNotarialDeed(ctx.titles)) {
    return { ok: false, code: 'notarial_deed_required' };
  }

  return { ok: true, to };
}

export function nextAcquisitionStatus(from: AcquisitionStatus): AcquisitionStatus | null {
  return TRANSITIONS[from][0] ?? null;
}

/** Progression d'acquisition normalisée 0..1 (pour l'affichage du dossier foncier). */
export function acquisitionProgress(status: AcquisitionStatus): number {
  return ACQUISITION_STATUSES.indexOf(status) / (ACQUISITION_STATUSES.length - 1);
}

// ── Validations (§8) ────────────────────────────────────────────────────────
export type FieldErrors = Partial<Record<string, string>>;

/** Saisie d'une parcelle : référence requise, tenure ∈ énum, area/price ≥ 0. */
export function validateParcel(input: Partial<LandParcelInput>): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.reference || input.reference.trim().length === 0) errors.reference = 'parcel.error.reference';
  if (!input.tenureType || !TENURE_TYPES.includes(input.tenureType)) errors.tenureType = 'parcel.error.tenureType';
  if (input.area !== undefined && input.area < 0) errors.area = 'parcel.error.area';
  if (input.price !== undefined && input.price < 0) errors.price = 'parcel.error.price';
  return errors;
}

/** Saisie d'un titre : type ∈ énum, référence requise. */
export function validateTitle(input: Partial<TitleDocumentInput>): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.docType || !TITLE_DOC_TYPES.includes(input.docType)) errors.docType = 'title.error.docType';
  if (!input.reference || input.reference.trim().length === 0) errors.reference = 'title.error.reference';
  return errors;
}
