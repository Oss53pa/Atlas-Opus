/**
 * country_config — référentiel pays (réf CLAUDE.md §3, schema.sql §1).
 * Devise, régime de passation et taux de retenue par défaut sont hérités
 * par l'opération (RG-M1-01/04). Jamais codé en dur côté écran.
 */
/**
 * Nature de la prestation pour la retenue à la source (F6). OHADA : le taux de
 * précompte/retenue dépend de la nature (travaux, services, location, fournitures).
 */
export const WHT_NATURES = ['travaux', 'services', 'location', 'fournitures'] as const;
export type WhtNature = (typeof WHT_NATURES)[number];

export interface CountryConfig {
  code: string; // ISO-2
  nameKey: string; // clé i18n du libellé pays
  zone: 'UEMOA' | 'CEMAC';
  currency: string; // XOF | XAF
  localeDefault: string;
  retentionDefault: number; // 0..1
  defaultProcurementMode: 'private' | 'public';
  /** Taux de TVA du régime (F6). 0..1. Piloté par pays, jamais codé en dur. */
  vatRate: number;
  /** Taux de retenue à la source par nature (F6). Valeurs de référence à
   *  valider selon le régime fiscal exact de l'opération. */
  whtRates: Record<WhtNature, number>;
}

// Taux de référence UEMOA (TVA 18 %) et CEMAC (TVA 19,25 % CM, 18 % GA). Les
// retenues à la source sont des valeurs indicatives par nature — paramétrables.
const UEMOA_WHT: Record<WhtNature, number> = { travaux: 0.05, services: 0.05, location: 0.10, fournitures: 0.02 };
const CEMAC_WHT: Record<WhtNature, number> = { travaux: 0.055, services: 0.055, location: 0.15, fournitures: 0.022 };

export const COUNTRIES: CountryConfig[] = [
  { code: 'CI', nameKey: 'country.CI', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.18, whtRates: UEMOA_WHT },
  { code: 'SN', nameKey: 'country.SN', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.18, whtRates: UEMOA_WHT },
  { code: 'BJ', nameKey: 'country.BJ', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.18, whtRates: UEMOA_WHT },
  { code: 'BF', nameKey: 'country.BF', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.18, whtRates: UEMOA_WHT },
  { code: 'CM', nameKey: 'country.CM', zone: 'CEMAC', currency: 'XAF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.1925, whtRates: CEMAC_WHT },
  { code: 'GA', nameKey: 'country.GA', zone: 'CEMAC', currency: 'XAF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private', vatRate: 0.18, whtRates: CEMAC_WHT },
];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
