import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const backend = (import.meta.env.VITE_DATA_BACKEND as string | undefined) ?? 'mock';

/** Vrai si le backend Supabase est demandé et configuré. */
export function supabaseBackendEnabled(): boolean {
  return backend === 'supabase' && Boolean(url && anonKey);
}

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
