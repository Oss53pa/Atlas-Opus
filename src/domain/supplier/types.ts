/**
 * M9 — Référentiel fournisseurs · types du domaine, purs. Transposé d'Advancity.
 * Le fournisseur est rattaché à l'**espace**, pas à une opération : on le
 * référence une fois et on le réutilise d'une opération à l'autre. Les bons de
 * commande (M10) le citent par `supplierId`.
 * Table : ao_suppliers (niveau espace).
 */

export const SUPPLIER_CATEGORIES = ['travaux', 'fournitures', 'services', 'etudes'] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

/** Cycle de référencement : en référencement → actif ; écarté = plus consultable. */
export const SUPPLIER_STATUSES = ['en_referencement', 'actif', 'ecarte'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  category: SupplierCategory;
  contact: string | null;
  email: string | null;
  /** Identifiant fiscal / RCCM — utile au rapprochement comptable. */
  taxId: string | null;
  status: SupplierStatus;
}

export interface SupplierInput {
  name: string;
  category: SupplierCategory;
  contact?: string | null;
  email?: string | null;
  taxId?: string | null;
}

export type SupplierPatch = Partial<Pick<Supplier, 'name' | 'category' | 'contact' | 'email' | 'taxId' | 'status'>>;
