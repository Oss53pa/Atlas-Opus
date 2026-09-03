// Réponses JSON + erreurs typées pour les Edge Functions.
import { corsHeaders } from './cors.ts';

/** Erreur porteuse d'un code HTTP (401/403/404/409/422…). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Enveloppe un handler : préflight CORS, parsing JSON, mapping des HttpError. */
export function handler(fn: (req: Request, body: unknown) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body: unknown = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    try {
      return await fn(req, body);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[edge] unhandled', e);
      return json({ error: 'internal_error' }, 500);
    }
  };
}
