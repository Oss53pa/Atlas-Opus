/** M8 — Passation (réf schema.sql §7). Domaine pur. */

export type TenderMode = 'private' | 'public';

export const TENDER_PROCEDURES = ['AOO', 'AOR', 'consultation', 'gre_a_gre'] as const;
export type TenderProcedure = (typeof TENDER_PROCEDURES)[number];

export const TENDER_STATUSES = ['planned', 'published', 'opened', 'evaluated', 'awarded', 'notified'] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export interface Tender {
  id: string;
  tenantId: string;
  operationId: string;
  mode: TenderMode;
  procedure: TenderProcedure | null;
  object: string;
  thresholdOk: boolean | null;
  anoRequired: boolean;
  status: TenderStatus;
  awardedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderInput {
  mode: TenderMode;
  procedure?: TenderProcedure | null;
  object: string;
  anoRequired?: boolean;
}
