// En-têtes CORS communs aux Edge Functions Atlas Opus.
// Le front (Vite) appelle ces fonctions ; on autorise l'en-tête Authorization
// (JWT du porteur) et le préflight OPTIONS.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
