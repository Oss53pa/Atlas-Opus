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
import { useData } from './providers';
import { createRepoTransport } from './transport';

const STORAGE_KEY = 'ao.offline.queue';

/** Entrée de capture (sans les champs de cycle de vie, fixés par le domaine). */
export type CaptureInput = Omit<PendingMutation, 'status' | 'attempts' | 'lastError'>;

interface OfflineApi {
  online: boolean;
  queue: PendingMutation[];
  pendingCount: number;
  /** Mutations dont la synchro a échoué de façon terminale (à trancher). */
  conflictCount: number;
  rejectedCount: number;
  /** true si un transport de synchro est branché (bouton « Synchroniser »). */
  canSync: boolean;
  /**
   * Horodatage (ms) du dernier drainage ayant synchronisé ≥ 1 mutation. Signal
   * de réconciliation : les écrans le surveillent pour se rafraîchir et
   * remplacer leurs lignes optimistes « local-… » par les entités serveur.
   */
  syncedAt: number;
  /** Capture une mutation hors-ligne. Renvoie le verdict de recevabilité (§4). */
  capture(input: CaptureInput): { admitted: boolean; reason?: string };
  /** Vide la file via le transport (no-op si aucun transport ou hors-ligne). */
  flush(): Promise<void>;
  /** Retire les mutations terminales en échec (conflit/rejet), une fois tranchées. */
  discardResolved(): void;
  /** Re-tente une mutation en échec (conflit/rejet → queued) puis draine si possible. */
  retry(id: string): void;
  /** Retire une mutation précise de la file. */
  discard(id: string): void;
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
  const [syncedAt, setSyncedAt] = useState(0);
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

  const discardResolved = useCallback(() => {
    setQueue((q) => q.filter((m) => m.status !== 'conflict' && m.status !== 'rejected'));
  }, []);

  const discard = useCallback((id: string) => {
    setQueue((q) => q.filter((m) => m.id !== id));
  }, []);

  const retry = useCallback((id: string) => {
    setQueue((q) =>
      q.map((m) => (m.id === id && (m.status === 'conflict' || m.status === 'rejected') ? { ...m, status: 'queued', lastError: null } : m)),
    );
    // Le drainage opportuniste (effet sur `queue`) reprendra la mutation remise en file.
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
      // Réconciliation : signale aux écrans de se rafraîchir (lignes optimistes
      // remplacées par les entités serveur) uniquement si quelque chose a été livré.
      if (res.synced > 0) setSyncedAt(Date.now());
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
    const conflictCount = queue.filter((m) => m.status === 'conflict').length;
    const rejectedCount = queue.filter((m) => m.status === 'rejected').length;
    return {
      online,
      queue,
      pendingCount,
      conflictCount,
      rejectedCount,
      canSync: Boolean(transport),
      syncedAt,
      capture,
      flush,
      discardResolved,
      retry,
      discard,
      admits: (input) => admitOffline(input).ok,
    };
  }, [online, queue, transport, syncedAt, capture, flush, discardResolved, retry, discard]);

  return <OfflineCtx.Provider value={value}>{children}</OfflineCtx.Provider>;
}

/**
 * Branche le transport concret (repos courants, mock ou Supabase) sur le
 * provider. À placer sous DataProvider — ferme la boucle offline : les mutations
 * capturées sont rejouées via les repos au retour du réseau.
 */
export function OfflineBridge({ children }: { children: ReactNode }) {
  const api = useData();
  const transport = useMemo(() => createRepoTransport(api), [api]);
  return <OfflineProvider transport={transport}>{children}</OfflineProvider>;
}
