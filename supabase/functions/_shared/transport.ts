// Transport HTTP vers un système tiers (F5). Traduit la réponse en CallOutcome :
//  · 2xx                    → succès ;
//  · 408 / 429 / 5xx / réseau → échec RETRIABLE (reprise avec backoff) ;
//  · autres 4xx             → échec NON retriable (lettre morte immédiate).
// La clé d'idempotence est transmise pour que le tiers dédoublonne à son tour.
import type { CallOutcome } from './f5.ts';

const TIMEOUT_MS = 10_000;

export interface Dispatchable {
  idempotency_key: string;
  payload: unknown;
}

export async function httpDispatch(url: string, msg: Dispatchable): Promise<CallOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': msg.idempotency_key },
      body: JSON.stringify(msg.payload ?? {}),
      signal: controller.signal,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true };
    const retriable = res.status === 408 || res.status === 429 || res.status >= 500;
    return { ok: false, retriable, error: `http_${res.status}` };
  } catch (e) {
    // Abandon (timeout) ou erreur réseau → retriable.
    const error = e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, retriable: true, error };
  } finally {
    clearTimeout(timer);
  }
}
