// Edge Function ao-mandatement (M15) — avance sensible d'un décompte.
// Couvre le mandatement et la mise en paiement : machine draft → validated →
// mandated → paid. service_role, mais rôle financier revérifié
// (finance / moa_director / owner) et transition gardée. Trace auditée.
//
// Scellement F6 : au passage → mandated, la décomposition fiscale (TVA + retenues
// + net à payer) est FIGÉE sur le décompte. Le calcul monétaire reste en
// TypeScript (Money.ts, invariant §5) : le client fournit les composantes, l'Edge
// en VÉRIFIE la cohérence (en centimes entiers, sans arrondi monétaire propre) et
// les persiste — jamais de recalcul monétaire côté Deno.
import { handler, json, HttpError } from '../_shared/http.ts';
import { requireCaller, requireRoleForTenant, requireString } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { guardLinear } from '../_shared/transition.ts';
import { appendAudit } from '../_shared/audit.ts';

const DECOMPTE_STATUSES = ['draft', 'validated', 'mandated', 'paid'] as const;
type DecompteStatus = (typeof DECOMPTE_STATUSES)[number];
const ALLOWED_ROLES = ['owner', 'moa_director', 'finance'] as const;

// Composantes fiscales fournies par l'appelant (unités majeures ; calcul Money.ts).
interface Seal {
  baseHT: number;
  tva: number;
  retenueSource: number;
  retenueGarantie: number;
  avanceRemboursee: number;
  penalites: number;
  netAPayer: number;
  vatRate: number;
  whtRate: number;
}

const cents = (n: number) => Math.round(n * 100);

function readSeal(body: unknown): Seal | null {
  const s = (body as Record<string, unknown>).seal;
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : NaN);
  const seal: Seal = {
    baseHT: num('baseHT'), tva: num('tva'), retenueSource: num('retenueSource'),
    retenueGarantie: num('retenueGarantie'), avanceRemboursee: num('avanceRemboursee'),
    penalites: num('penalites'), netAPayer: num('netAPayer'), vatRate: num('vatRate'), whtRate: num('whtRate'),
  };
  if (Object.values(seal).some((v) => Number.isNaN(v))) throw new HttpError(422, 'seal_incomplete');
  return seal;
}

Deno.serve(handler(async (req, body) => {
  const caller = await requireCaller(req);
  const service = serviceClient();
  const decompteId = requireString(body, 'decompteId');
  const target = (body as Record<string, unknown>).targetStatus as DecompteStatus | undefined;

  const { data: decompte, error } = await service
    .from('ao_decomptes')
    .select('id, tenant_id, operation_id, number, status, amount_gross')
    .eq('id', decompteId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'load_failed');
  if (!decompte) throw new HttpError(404, 'decompte_not_found');
  const d = decompte as { tenant_id: string; operation_id: string; number: number; status: DecompteStatus; amount_gross: number };

  await requireRoleForTenant(service, caller.userId, d.tenant_id, ALLOWED_ROLES);

  const to = guardLinear(DECOMPTE_STATUSES, d.status, target);

  const patch: Record<string, unknown> = { status: to };

  // Scellement fiscal au mandatement.
  if (to === 'mandated') {
    const seal = readSeal(body);
    if (!seal) throw new HttpError(422, 'seal_required');
    // La base scellée doit correspondre au brut enregistré.
    if (cents(seal.baseHT) !== cents(Number(d.amount_gross))) throw new HttpError(422, 'seal_base_mismatch');
    // Cohérence de la décomposition (centimes entiers, aucun arrondi monétaire ici).
    const expected = cents(seal.baseHT) + cents(seal.tva) - cents(seal.retenueSource) - cents(seal.retenueGarantie) - cents(seal.avanceRemboursee) - cents(seal.penalites);
    if (expected !== cents(seal.netAPayer)) throw new HttpError(422, 'seal_inconsistent');
    patch.vat_rate = seal.vatRate;
    patch.wht_rate = seal.whtRate;
    patch.tva = seal.tva;
    patch.retenue_source = seal.retenueSource;
    patch.net_a_payer = seal.netAPayer;
    patch.sealed_at = new Date().toISOString();
  }

  const { error: upErr } = await service.from('ao_decomptes').update(patch).eq('id', decompteId);
  if (upErr) throw new HttpError(500, 'update_failed');

  await appendAudit(service, {
    tenantId: d.tenant_id,
    operationId: d.operation_id,
    actor: caller.userId,
    action: 'transition',
    module: 'M15',
    object: `decompte:${d.number}`,
    summary: to === 'mandated' && patch.net_a_payer !== undefined ? `${d.status}→${to} net=${patch.net_a_payer}` : `${d.status}→${to}`,
  });

  return json({ ok: true, id: decompteId, status: to, sealed: to === 'mandated' });
}));
