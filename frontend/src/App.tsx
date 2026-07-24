import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { MainLayout } from './components/layout/MainLayout';
import { CrimeMap } from './components/map/CrimeMap';
import NetworkGraph from './components/NetworkGraph';
import ReportHistoryPanel from './components/ReportHistoryPanel';

const AppContent = () => {
  const { activeView } = useDashboard();
  
  return (
    <MainLayout>
      <div className={activeView === 'map' ? 'block w-full h-full' : 'hidden'}>
        <CrimeMap />
      </div>
      {activeView === 'network' && <NetworkGraph />}
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
