import { Map, Network, Database, Settings } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useDashboard } from '../../context/DashboardContext';

export const Sidebar = () => {
  const { activeView, setActiveView } = useDashboard();

  return (
    <aside className="w-20 bg-[#0B1120] flex flex-col items-center py-6 border-r border-white/10 z-20 shadow-[4px_0_32px_rgba(0,0,0,0.8)] relative">
      <div className="mb-10">
        <img src={logo} alt="Crime Analytics" className="w-12 h-12 object-contain" />
      </div>
      
      <nav className="flex flex-col space-y-8 flex-1 w-full px-2">
        <NavItem icon={<Map size={24} />} label="Map" active={activeView === 'map'} onClick={() => setActiveView('map')} />
        <NavItem icon={<Network size={24} />} label="Graph" active={activeView === 'network'} onClick={() => setActiveView('network')} />
        <NavItem icon={<Database size={24} />} label="Data" active={activeView === 'data'} onClick={() => setActiveView('data')} />
      </nav>
      
      <div className="mt-auto w-full px-2">
        <NavItem icon={<Settings size={24} />} label="Settings" active={activeView === 'settings'} onClick={() => setActiveView('settings')} />
      </div>
    </aside>
  );
};

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-3 group transition-colors duration-200 rounded-xl cursor-pointer ${active ? 'text-khaki' : 'text-gray-400 hover:text-gray-100'}`}>
      <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-khaki/10 text-khaki' : 'group-hover:bg-navy-800'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium mt-1 uppercase tracking-widest">{label}</span>
    </button>
  );
};
