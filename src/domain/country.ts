/**
 * country_config — référentiel pays (réf CLAUDE.md §3, schema.sql §1).
 * Devise, régime de passation et taux de retenue par défaut sont hérités
 * par l'opération (RG-M1-01/04). Jamais codé en dur côté écran.
 */
export interface CountryConfig {
  code: string; // ISO-2
  nameKey: string; // clé i18n du libellé pays
  zone: 'UEMOA' | 'CEMAC';
  currency: string; // XOF | XAF
  localeDefault: string;
  retentionDefault: number; // 0..1
  defaultProcurementMode: 'private' | 'public';
}

export const COUNTRIES: CountryConfig[] = [
  { code: 'CI', nameKey: 'country.CI', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
  { code: 'SN', nameKey: 'country.SN', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
  { code: 'BJ', nameKey: 'country.BJ', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
  { code: 'BF', nameKey: 'country.BF', zone: 'UEMOA', currency: 'XOF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
  { code: 'CM', nameKey: 'country.CM', zone: 'CEMAC', currency: 'XAF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
  { code: 'GA', nameKey: 'country.GA', zone: 'CEMAC', currency: 'XAF', localeDefault: 'fr-FR', retentionDefault: 0.05, defaultProcurementMode: 'private' },
];

export function getCountry(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
