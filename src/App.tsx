import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import MainLayout from './components/MainLayout';

export default function App() {
  return (
    <div className="w-full h-full bg-background">
      <Sidebar />
      <TopNav />
      <MainLayout />
    </div>
  );
}
