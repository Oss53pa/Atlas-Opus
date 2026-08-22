import type { ReactNode } from 'react';
import { Aurora, ToastProvider } from './ui';
import { AuthProvider, useAuth } from './app/auth';
import { DataProvider } from './app/providers';
import { NavProvider, useNav } from './app/router';
import { LoginScreen } from './features/auth/LoginScreen';
import { AppShell } from './features/m1/AppShell';
import { DashboardScreen } from './features/m1/DashboardScreen';
import { PortfolioScreen } from './features/m1/PortfolioScreen';
import { CreateOperationWizard } from './features/m1/CreateOperationWizard';
import { OperationCockpit } from './features/m1/OperationCockpit';
import { ProgramEditor } from './features/m1/ProgramEditor';
import { BilanEditor } from './features/m1/BilanEditor';
import { StakeholdersScreen } from './features/m1/StakeholdersScreen';
import { ComplianceScreen } from './features/m1/ComplianceScreen';
import { FinancingScreen } from './features/m1/FinancingScreen';
import { CommercialisationScreen } from './features/m1/CommercialisationScreen';
import { PaymentsScreen } from './features/m1/PaymentsScreen';
import { PlanningScreen } from './features/m1/PlanningScreen';
import { PassationScreen } from './features/m1/PassationScreen';
import { t } from './i18n';

function RouteView() {
  const { route } = useNav();
  switch (route.name) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'portfolio':
      return <PortfolioScreen />;
    case 'create':
      return <CreateOperationWizard />;
    case 'cockpit':
      return <OperationCockpit id={route.id} />;
    case 'program':
      return <ProgramEditor id={route.id} />;
    case 'bilan':
      return <BilanEditor id={route.id} />;
    case 'stakeholders':
      return <StakeholdersScreen id={route.id} />;
    case 'compliance':
      return <ComplianceScreen id={route.id} />;
    case 'financing':
      return <FinancingScreen id={route.id} />;
    case 'commercialisation':
      return <CommercialisationScreen id={route.id} />;
    case 'payments':
      return <PaymentsScreen id={route.id} />;
    case 'planning':
      return <PlanningScreen id={route.id} />;
    case 'passation':
      return <PassationScreen id={route.id} />;
    default:
      return <DashboardScreen />;
  }
}

/** Décide login / chargement / app selon le mode d'auth. */
function AuthGate({ children }: { children: ReactNode }) {
  const { mode, user, loading } = useAuth();
  if (mode === 'mock') return <>{children}</>;
  if (loading) {
    return <div className="flex min-h-[80vh] items-center justify-center text-[14px] text-ink-3">{t('auth.loading')}</div>;
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="relative min-h-full">
      <Aurora />
      <div className="relative z-[1]">
        <ToastProvider>
          <AuthProvider>
            <AuthGate>
              <DataProvider>
                <NavProvider>
                  <AppShell>
                    <RouteView />
                  </AppShell>
                </NavProvider>
              </DataProvider>
            </AuthGate>
          </AuthProvider>
        </ToastProvider>
      </div>
    </div>
  );
}
