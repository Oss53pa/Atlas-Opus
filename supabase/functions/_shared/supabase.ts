// Deux clients Supabase, aux privilèges distincts (CLAUDE.md §5).
//  · callerClient : clé anon + JWT du porteur → identifie l'utilisateur, RLS active.
//  · serviceClient : service_role → contourne la RLS, réservé à l'écriture sensible
//                    APRÈS revérification du rôle. Jamais exposé au client.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(500, `missing_env_${name}`);
  return v;
}

/** Client au nom du porteur (RLS active) — sert uniquement à valider le JWT. */
export function callerClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client service_role (RLS contournée) — écritures sensibles seulement. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
