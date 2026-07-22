import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useDashboard } from '../../context/DashboardContext';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { activeView } = useDashboard();
  
  return (
    <div className="flex h-screen w-full bg-navy-900 overflow-hidden font-sans text-gray-100">
      <Sidebar />
      <div id="app-content-area" className="flex-1 flex flex-col min-w-0 bg-[#0A0F1A]">
        {activeView !== 'network' && <TopNav />}
        {/* Main Content Area - Full Bleed, no padding to let Map breathe */}
        <main className="flex-1 relative overflow-hidden bg-[#0A0F1A]">
          {children}
        </main>
      </div>
    </div>
  );
};
