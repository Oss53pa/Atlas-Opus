import { fr, type Dict, type MessageKey } from './fr';

// Locale par défaut : français (réf CLAUDE.md). Le multi-pays/locale
// (XOF/XAF, formats) se branchera ici via country_config.
let dict: Dict = fr;
export let locale = 'fr-FR';

export function setLocale(next: Dict, code: string): void {
  dict = next;
  locale = code;
}

/** Traduction avec interpolation simple : t('bilan.progress', { pct: '62 %' }). */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let out: string = dict[key];
  if (vars) {
    for (const k of Object.keys(vars)) {
      out = out.replace(`{${k}}`, String(vars[k]));
    }
  }
  return out;
}

export type { MessageKey };
