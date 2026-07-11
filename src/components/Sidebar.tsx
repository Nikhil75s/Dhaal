import { Map, MapPin, Archive, Network, Settings } from 'lucide-react';
import { useDashboardStore, type ActiveView } from '../store/dashboardStore';

interface NavItem {
  id: ActiveView;
  icon: React.ElementType;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'map', icon: Map, label: 'Crime Map' },
  { id: 'archive', icon: Archive, label: 'Intelligence Archive' },
  { id: 'network', icon: Network, label: 'Network Graph' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const activeView = useDashboardStore((s) => s.activeView);
  const setActiveView = useDashboardStore((s) => s.setActiveView);

  return (
    <nav className="fixed left-0 top-0 h-full w-16 flex flex-col items-center py-6 gap-2 z-50 bg-background">
      {/* Logo / brand mark */}
      <div className="mb-6 flex items-center justify-center w-10 h-10">
        <MapPin size={24} strokeWidth={2} className="text-accent-gold" />
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            title={item.label}
            className={`
              w-10 h-10 flex items-center justify-center rounded-lg
              transition-colors duration-200 cursor-pointer
              ${isActive
                ? 'text-accent-gold'
                : 'text-text-secondary hover:text-text-primary'
              }
            `}
          >
            <item.icon size={20} strokeWidth={1.5} />
          </button>
        );
      })}
    </nav>
  );
}
