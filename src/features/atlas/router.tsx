import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ScreenId } from './nav';
import { findModule } from './nav';

interface NavApi {
  screen: ScreenId;
  navigate: (screen: ScreenId) => void;
  context: 'tenant' | 'operation';
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

const TENANT_SCREENS = new Set<ScreenId>(['workspaces', 'home', 'menu', 'members', 'notifications', 'approvals', 'onboarding', 'invite', 'states']);

const NavCtx = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('useNav doit être utilisé dans un NavProvider');
  return ctx;
}

export function NavProvider({ initial = 'home', children }: { initial?: ScreenId; children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(initial);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useCallback((next: ScreenId) => {
    setScreen(next);
    setPaletteOpen(false);
    window.scrollTo({ top: 0 });
  }, []);
  const context: 'tenant' | 'operation' = useMemo(() => {
    if (findModule(screen)) return 'operation';
    if (TENANT_SCREENS.has(screen)) return 'tenant';
    return 'operation'; // écrans de détail rattachés à un module
  }, [screen]);
  return (
    <NavCtx.Provider value={{ screen, navigate, context, paletteOpen, setPaletteOpen }}>{children}</NavCtx.Provider>
  );
}
