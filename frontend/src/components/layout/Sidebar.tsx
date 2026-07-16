import { Map, Network, Database, Settings } from 'lucide-react';
import logo from '../../assets/logo.png';

export const Sidebar = () => {
  return (
    <aside className="w-20 bg-[#0B1120] flex flex-col items-center py-6 border-r border-white/10 z-20 shadow-[4px_0_32px_rgba(0,0,0,0.8)] relative">
      <div className="mb-10">
        <img src={logo} alt="Crime Analytics" className="w-12 h-12 object-contain" />
      </div>
      
      <nav className="flex flex-col space-y-8 flex-1 w-full px-2">
        <NavItem icon={<Map size={24} />} label="Map" active />
        <NavItem icon={<Network size={24} />} label="Graph" />
        <NavItem icon={<Database size={24} />} label="Data" />
      </nav>
      
      <div className="mt-auto w-full px-2">
        <NavItem icon={<Settings size={24} />} label="Settings" />
      </div>
    </aside>
  );
};

const NavItem = ({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) => {
  return (
    <button className={`flex flex-col items-center justify-center w-full py-3 group transition-colors duration-200 rounded-xl ${active ? 'text-khaki' : 'text-gray-400 hover:text-gray-100'}`}>
      <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-khaki/10 text-khaki' : 'group-hover:bg-navy-800'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium mt-1 uppercase tracking-widest">{label}</span>
    </button>
  );
};
