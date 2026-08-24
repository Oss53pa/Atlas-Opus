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
import { ReportingScreen } from './features/m1/ReportingScreen';
import { PaymentsScreen } from './features/m1/PaymentsScreen';
import { PlanningScreen } from './features/m1/PlanningScreen';
import { PassationScreen } from './features/m1/PassationScreen';
import { EtudesScreen } from './features/m1/EtudesScreen';
import { AnalyseScreen } from './features/m1/AnalyseScreen';
import { AchatsScreen } from './features/m1/AchatsScreen';
import { ReceptionScreen } from './features/m1/ReceptionScreen';
import { CautionsScreen } from './features/m1/CautionsScreen';
import { RisquesScreen } from './features/m1/RisquesScreen';
import { JournalScreen } from './features/m1/JournalScreen';
import { PilotageScreen } from './features/m1/PilotageScreen';
import { ModificationsScreen } from './features/m1/ModificationsScreen';
import { ConceptionScreen } from './features/m1/ConceptionScreen';
import { RfiScreen } from './features/m1/RfiScreen';
import { RaccordementsScreen } from './features/m1/RaccordementsScreen';
import { DocumentsScreen } from './features/m1/DocumentsScreen';
import { StakeholderDetailScreen } from './features/m1/StakeholderDetailScreen';
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
    case 'reporting':
      return <ReportingScreen id={route.id} />;
    case 'payments':
      return <PaymentsScreen id={route.id} />;
    case 'planning':
      return <PlanningScreen id={route.id} />;
    case 'passation':
      return <PassationScreen id={route.id} />;
    case 'etudes':
      return <EtudesScreen id={route.id} />;
    case 'analyse':
      return <AnalyseScreen id={route.id} />;
    case 'achats':
      return <AchatsScreen id={route.id} />;
    case 'reception':
      return <ReceptionScreen id={route.id} />;
    case 'cautions':
      return <CautionsScreen id={route.id} />;
    case 'risques':
      return <RisquesScreen id={route.id} />;
    case 'journal':
      return <JournalScreen id={route.id} />;
    case 'pilotage':
      return <PilotageScreen id={route.id} />;
    case 'modifications':
      return <ModificationsScreen id={route.id} />;
    case 'conception':
      return <ConceptionScreen id={route.id} />;
    case 'rfi':
      return <RfiScreen id={route.id} />;
    case 'raccordements':
      return <RaccordementsScreen id={route.id} />;
    case 'documents':
      return <DocumentsScreen id={route.id} />;
    case 'stakeholder':
      return <StakeholderDetailScreen id={route.id} sid={route.sid} />;
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
