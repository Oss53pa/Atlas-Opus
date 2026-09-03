// SHA-256 (Web Crypto) + sérialisation déterministe.
// DOIT rester identique à src/domain/m23/sha256.ts et src/domain/f5/contract.ts
// pour que les chaînes scellées côté serveur soient vérifiables côté client.

/** SHA-256 hexadécimal (minuscule) d'une chaîne UTF-8. */
export async function sha256Hex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Sérialisation déterministe (clés triées) — miroir de F5 stableStringify. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}
