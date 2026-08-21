import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'danger';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}
interface ToastApi {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return ctx;
}

let seq = 0;
const ICON = { success: CheckCircle2, info: Info, danger: AlertTriangle } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++seq;
    setItems((s) => [...s, { id, tone, message }]);
    setTimeout(() => setItems((s) => s.filter((it) => it.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="ax-toast-wrap" aria-live="polite">
        {items.map((it) => {
          const Icon = ICON[it.tone];
          const color =
            it.tone === 'danger' ? 'var(--ax-danger)' : it.tone === 'info' ? 'var(--ax-info)' : 'var(--ax-success)';
          return (
            <div key={it.id} className="ax-toast">
              <span style={{ color, marginTop: 1 }}>
                <Icon size={16} />
              </span>
              <span className="flex-1 text-ink-2">{it.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
