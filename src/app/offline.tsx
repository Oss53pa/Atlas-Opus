/**
 * F3 — branchement UI de l'offline-first (CLAUDE.md §4).
 * Contexte React : état réseau (navigator.onLine + events), file de mutations
 * persistée (localStorage), capture gardée par l'invariant §4, et vidage
 * déterministe via un transport injecté. La logique déterministe vit dans le
 * domaine (src/domain/f3) ; ici, seulement l'état et l'IO.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  admitOffline, deserializeQueue, drainQueue, enqueue as enqueueMutation, serializeQueue,
  type OfflineTransport, type PendingMutation,
} from '../domain/f3';

const STORAGE_KEY = 'ao.offline.queue';

/** Entrée de capture (sans les champs de cycle de vie, fixés par le domaine). */
export type CaptureInput = Omit<PendingMutation, 'status' | 'attempts' | 'lastError'>;

interface OfflineApi {
  online: boolean;
  queue: PendingMutation[];
  pendingCount: number;
  /** true si un transport de synchro est branché (bouton « Synchroniser »). */
  canSync: boolean;
  /** Capture une mutation hors-ligne. Renvoie le verdict de recevabilité (§4). */
  capture(input: CaptureInput): { admitted: boolean; reason?: string };
  /** Vide la file via le transport (no-op si aucun transport ou hors-ligne). */
  flush(): Promise<void>;
  admits(input: Pick<PendingMutation, 'financial' | 'payload' | 'op'>): boolean;
}

const OfflineCtx = createContext<OfflineApi | null>(null);

export function useOffline(): OfflineApi {
  const ctx = useContext(OfflineCtx);
  if (!ctx) throw new Error('useOffline doit être utilisé dans un OfflineProvider');
  return ctx;
}

function readOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function loadQueue(): PendingMutation[] {
  try {
    return deserializeQueue(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function OfflineProvider({ transport, children }: { transport?: OfflineTransport; children: ReactNode }) {
  const [online, setOnline] = useState<boolean>(readOnline);
  const [queue, setQueue] = useState<PendingMutation[]>(loadQueue);
  const flushing = useRef(false);

  // Persistance : toute évolution de la file est sauvegardée localement.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeQueue(queue));
    } catch {
      /* stockage indisponible (mode privé) : la file reste en mémoire */
    }
  }, [queue]);

  // État réseau.
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const capture = useCallback((input: CaptureInput) => {
    const verdict = admitOffline(input);
    setQueue((q) => enqueueMutation(q, input).queue);
    return verdict.ok ? { admitted: true } : { admitted: false, reason: verdict.reason };
  }, []);

  const flush = useCallback(async () => {
    if (!transport || !online || flushing.current) return;
    flushing.current = true;
    try {
      const current = loadQueue();
      const res = await drainQueue(current, transport);
      // Ne conserve que ce qui reste à faire (queued/conflict/rejected).
      setQueue(res.queue.filter((m) => m.status !== 'synced'));
    } finally {
      flushing.current = false;
    }
  }, [transport, online]);

  // Vidage opportuniste au retour du réseau.
  useEffect(() => {
    if (online && transport && queue.some((m) => m.status === 'queued')) void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const value = useMemo<OfflineApi>(() => {
    const pendingCount = queue.filter((m) => m.status === 'queued').length;
    return {
      online,
      queue,
      pendingCount,
      canSync: Boolean(transport),
      capture,
      flush,
      admits: (input) => admitOffline(input).ok,
    };
  }, [online, queue, transport, capture, flush]);

  return <OfflineCtx.Provider value={value}>{children}</OfflineCtx.Provider>;
}
