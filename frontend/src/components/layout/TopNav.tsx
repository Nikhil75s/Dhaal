import { Search, Filter } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { DistrictDropdown } from '../common/DistrictDropdown';
import { DateRangeDropdown } from '../common/DateRangeDropdown';

export const TopNav = () => {
  const { filters } = useDashboard();

  return (
    <header className="h-16 bg-navy-900 border-b border-navy-800 flex items-center px-8 justify-between z-10 relative shadow-sm">
      
      {/* Global Search */}
      <div className="flex items-center bg-navy-800/50 rounded-full px-4 py-2 w-96 border border-navy-800 focus-within:border-khaki/50 focus-within:bg-navy-800 transition-all duration-300">
        <Search size={18} className="text-gray-400 mr-3" />
        <input 
          type="text" 
          placeholder="Search suspects, FIRs, locations..." 
          className="bg-transparent border-none outline-none text-sm w-full text-gray-100 placeholder-gray-500"
        />
      </div>

      {/* Filter Section */}
      <div className="flex items-center space-x-4">
        
        <DateRangeDropdown />
        
        <DistrictDropdown />
        
        <button className="bg-khaki text-navy-900 px-5 py-2 rounded-full font-semibold text-sm hover:bg-[#E5BE4A] transition-colors flex items-center shadow-lg shadow-khaki/20">
          <Filter size={16} className="mr-2" />
          More Filters
        </button>
      </div>

    </header>
  );
};
