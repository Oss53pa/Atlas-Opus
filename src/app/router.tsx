import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'portfolio' }
  | { name: 'create' }
  | { name: 'cockpit'; id: string }
  | { name: 'program'; id: string }
  | { name: 'bilan'; id: string }
  | { name: 'stakeholders'; id: string }
  | { name: 'compliance'; id: string }
  | { name: 'financing'; id: string }
  | { name: 'commercialisation'; id: string }
  | { name: 'reporting'; id: string }
  | { name: 'payments'; id: string }
  | { name: 'planning'; id: string }
  | { name: 'passation'; id: string }
  | { name: 'etudes'; id: string }
  | { name: 'analyse'; id: string }
  | { name: 'achats'; id: string }
  | { name: 'reception'; id: string }
  | { name: 'cautions'; id: string }
  | { name: 'risques'; id: string }
  | { name: 'journal'; id: string }
  | { name: 'pilotage'; id: string }
  | { name: 'modifications'; id: string }
  | { name: 'conception'; id: string }
  | { name: 'rfi'; id: string }
  | { name: 'raccordements'; id: string }
  | { name: 'documents'; id: string }
  | { name: 'stakeholder'; id: string; sid: string }
  | { name: 'rfiDetail'; id: string; rid: string }
  | { name: 'docVisa'; id: string; did: string }
  | { name: 'offerDetail'; id: string; oid: string }
  | { name: 'siteReport'; id: string; crid: string }
  | { name: 'tresorerie'; id: string }
  | { name: 'marche'; id: string; cid: string }
  | { name: 'situation'; id: string; did: string }
  | { name: 'bilanPoste'; id: string; poste: string };

interface NavApi {
  route: Route;
  navigate: (route: Route) => void;
}

const NavCtx = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('useNav doit être utilisé dans un NavProvider');
  return ctx;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });
  const navigate = useCallback((next: Route) => {
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);
  return <NavCtx.Provider value={{ route, navigate }}>{children}</NavCtx.Provider>;
}
