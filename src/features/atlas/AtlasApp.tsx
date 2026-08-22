import { useState } from 'react';
import { NavProvider, useNav } from './router';
import { Shell } from './Shell';
import { LoginScreen } from './screens/LoginScreen';
import { WorkspacesScreen } from './screens/WorkspacesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MenuScreen } from './screens/MenuScreen';
import { OperationScreen } from './screens/OperationScreen';
import { BilanScreen } from './screens/BilanScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { MembersScreen } from './screens/MembersScreen';
import { StatesScreen } from './screens/StatesScreen';
import { ModuleScreen } from './screens/ModuleScreen';
import { DetailScreen, isDetail } from './screens/details';
import type { ScreenId } from './nav';

function InnerScreen({ screen }: { screen: ScreenId }) {
  if (isDetail(screen)) return <DetailScreen id={screen} />;
  switch (screen) {
    case 'm1': return <OperationScreen />;
    case 'm4': return <BilanScreen />;
    case 'approvals': return <ApprovalsScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'members': return <MembersScreen />;
    case 'states': return <StatesScreen />;
    default: return <ModuleScreen id={screen} />;
  }
}

function RouteView({ onSignOut }: { onSignOut: () => void }) {
  const { screen, navigate } = useNav();
  // Écrans d'entrée pleine page (chrome distinct, sans barre latérale)
  if (screen === 'workspaces') return <WorkspacesScreen onPick={() => navigate('home')} onSignOut={onSignOut} />;
  if (screen === 'home') return <HomeScreen />;
  if (screen === 'menu') return <MenuScreen />;
  // Écrans applicatifs dans le shell (sidebar + topbar)
  return <Shell><InnerScreen screen={screen} /></Shell>;
}

export function AtlasApp() {
  const [stage, setStage] = useState<'login' | 'workspaces' | 'app'>('login');
  if (stage === 'login') return <LoginScreen onEnter={() => setStage('workspaces')} />;
  if (stage === 'workspaces') return <WorkspacesScreen onPick={() => setStage('app')} onSignOut={() => setStage('login')} />;
  return (
    <NavProvider initial="home">
      <RouteView onSignOut={() => setStage('login')} />
    </NavProvider>
  );
}
