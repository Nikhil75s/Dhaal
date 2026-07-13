import { DashboardProvider } from './context/DashboardContext';
import { MainLayout } from './components/layout/MainLayout';
import { CrimeMap } from './components/map/CrimeMap';

function App() {
  return (
    <DashboardProvider>
      <MainLayout>
        {/* Phase 3: Geospatial Map Integrated */}
        <CrimeMap />
      </MainLayout>
    </DashboardProvider>
  );
}

export default App;
