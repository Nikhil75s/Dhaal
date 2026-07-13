import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen w-full bg-navy-900 overflow-hidden font-sans text-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1 relative h-full w-full">
        <TopNav />
        {/* Main Content Area - Full Bleed, no padding to let Map breathe */}
        <main className="flex-1 relative w-full h-full overflow-hidden bg-[#0A0F1A]">
          {children}
        </main>
      </div>
    </div>
  );
};
