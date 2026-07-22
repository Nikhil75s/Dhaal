import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { MainLayout } from './components/layout/MainLayout';
import { CrimeMap } from './components/map/CrimeMap';
import NetworkGraph from './components/NetworkGraph';
import SocioEconomicPanel from './components/SocioEconomicPanel';
import ReportHistoryPanel from './components/ReportHistoryPanel';

const AppContent = () => {
  const { activeView } = useDashboard();
  
  return (
    <MainLayout>
      {activeView === 'map' && <CrimeMap />}
      {activeView === 'network' && <NetworkGraph />}
      {activeView === 'data' && <SocioEconomicPanel />}
      {activeView === 'reports' && <ReportHistoryPanel />}
      {activeView === 'settings' && (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-gray-400">Settings placeholder</p>
        </div>
      )}
    </MainLayout>
  );
};

function App() {
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}

export default App;
