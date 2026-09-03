// Scellement du journal d'audit côté serveur (M23, CLAUDE.md §5).
// Chaîne SHA-256 par opération : hash = SHA-256(hash_prev ‖ payload), avec
// payload = [id, operationId, at, actor, action, module, object, summary].join(' ').
// Formule identique à src/domain/m23/audit.ts → la chaîne reste vérifiable
// hors ligne par verifyAuditChain côté client.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from './hash.ts';

const GENESIS_HASH = '0'.repeat(64);
const TABLE = 'ao_audit_log';

export type AuditAction = 'create' | 'update' | 'approve' | 'transition' | 'export' | 'access';

export interface AuditInput {
  tenantId: string;
  operationId: string;
  actor: string;
  action: AuditAction;
  module: string;
  object: string;
  summary?: string;
}

function payload(e: {
  id: string; operationId: string; at: string; actor: string;
  action: string; module: string; object: string; summary: string | null;
}): string {
  return [e.id, e.operationId, e.at, e.actor, e.action, e.module, e.object, e.summary ?? ''].join(' ');
}

/**
 * Ajoute une entrée scellée et chaînée. `at` et `id` sont fixés ici (et non par
 * les défauts SQL) car ils entrent dans le hash : la valeur stockée doit être
 * exactement celle hachée. NB : sceller côté serveur évite une course entre
 * deux insertions concurrentes (un seul writer par requête).
 */
export async function appendAudit(service: SupabaseClient, input: AuditInput): Promise<string> {
  const tip = await service
    .from(TABLE)
    .select('hash')
    .eq('operation_id', input.operationId)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const hashPrev = (tip.data as { hash: string | null } | null)?.hash ?? GENESIS_HASH;

  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const summary = input.summary ?? null;
  const hash = await sha256Hex(
    hashPrev + '' + payload({
      id, operationId: input.operationId, at, actor: input.actor,
      action: input.action, module: input.module, object: input.object, summary,
    }),
  );

  const { error } = await service.from(TABLE).insert({
    id,
    tenant_id: input.tenantId,
    operation_id: input.operationId,
    at,
    actor: input.actor,
    action: input.action,
    module: input.module,
    object: input.object,
    summary,
    hash_prev: hashPrev,
    hash,
  });
  if (error) throw new Error(`audit_insert_failed: ${error.message}`);
  return hash;
}
