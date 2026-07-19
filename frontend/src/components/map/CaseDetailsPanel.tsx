import { useState, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { X, User, FileText, AlertTriangle } from 'lucide-react';

interface CaseDetails {
  details: {
    CaseMasterID: string;
    CrimeNo: string;
    BriefFacts: string;
    CrimeRegisteredDate: string;
    CrimeGroupName: string;
  };
  accused: Array<{
    AccusedName: string;
    AgeYear: number;
    GenderID: number;
  }>;
  victims: Array<{
    VictimName: string;
    AgeYear: number;
    GenderID: number;
  }>;
}

export const CaseDetailsPanel = () => {
  const { filters, setFilters } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filters.selectedCaseId) {
      setCaseData(null);
      return;
    }

    const fetchCaseDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://dhaal-60077679458.development.catalystserverless.in/server/spatial_api/api/v1/map/case/${filters.selectedCaseId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch case details');
        const data = await res.json();
        setCaseData(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetails();
  }, [filters.selectedCaseId]);

  const handleClose = () => {
    setFilters(prev => ({ ...prev, selectedCaseId: null }));
  };

  if (!filters.selectedCaseId) return null;

  return (
    <div className={`absolute top-0 right-0 h-full w-96 bg-[#0B1120]/95 backdrop-blur-xl border-l border-white/10 shadow-[-12px_0_48px_rgba(0,0,0,0.8)] z-[9999] transform transition-transform duration-300 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold text-gray-100 flex items-center">
            <FileText size={18} className="mr-2 text-khaki" />
            Case Details
          </h2>
          {caseData && !loading && (
            <p className="text-xs text-gray-400 mt-1">{caseData.details.CrimeNo}</p>
          )}
        </div>
        <button onClick={handleClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {loading ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-1/3"></div>
              <div className="h-6 bg-white/10 rounded animate-pulse w-3/4"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-white/5 rounded animate-pulse w-1/4"></div>
              <div className="h-24 bg-white/5 rounded-lg animate-pulse w-full"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-white/5 rounded animate-pulse w-1/4"></div>
              <div className="h-16 bg-white/5 rounded-lg animate-pulse w-full"></div>
              <div className="h-16 bg-white/5 rounded-lg animate-pulse w-full"></div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 text-red-400 bg-red-900/10 rounded-lg border border-red-500/20 p-4 text-center">
            <AlertTriangle size={24} className="mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : caseData ? (
          <div className="space-y-6 animate-fade-in">
            
            {/* Overview */}
            <div className="mb-6">
              <div className="text-xs text-khaki font-semibold uppercase tracking-wider mb-1">Crime Type</div>
              <div className="text-gray-100 font-medium mb-3">{caseData.details.CrimeGroupName}</div>
              
              <div className="text-xs text-khaki font-semibold uppercase tracking-wider mb-1">Registered On</div>
              <div className="text-gray-300 text-sm">{caseData.details.CrimeRegisteredDate.substring(0, 10)}</div>
            </div>

            {/* Brief Facts */}
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2 border-b border-white/10 pb-2">Brief Facts</h3>
              <p className="text-sm text-gray-400 leading-relaxed py-2">
                {caseData.details.BriefFacts || "No brief facts available for this case."}
              </p>
            </div>

            {/* Accused */}
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2 border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Accused</span>
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">{caseData.accused.length}</span>
              </h3>
              {caseData.accused.length > 0 ? (
                <div className="space-y-1">
                  {caseData.accused.map((a, i) => (
                    <div key={i} className="flex items-center py-3 border-b border-white/5 last:border-0">
                      <div className="h-8 w-8 bg-red-500/10 rounded-full flex items-center justify-center mr-3">
                        <User size={14} className="text-red-400" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-200">{a.AccusedName || "Unknown"}</div>
                        <div className="text-xs text-gray-500">
                          {a.AgeYear ? `${a.AgeYear} years` : "Age Unknown"} • {a.GenderID === 1 ? 'Male' : a.GenderID === 2 ? 'Female' : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No accused recorded.</p>
              )}
            </div>

            {/* Victims */}
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2 border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Victims</span>
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{caseData.victims.length}</span>
              </h3>
              {caseData.victims.length > 0 ? (
                <div className="space-y-1">
                  {caseData.victims.map((v, i) => (
                    <div key={i} className="flex items-center py-3 border-b border-white/5 last:border-0">
                      <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center mr-3">
                        <User size={14} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-200">{v.VictimName || "Unknown"}</div>
                        <div className="text-xs text-gray-500">
                          {v.AgeYear ? `${v.AgeYear} years` : "Age Unknown"} • {v.GenderID === 1 ? 'Male' : v.GenderID === 2 ? 'Female' : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No victims recorded.</p>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
};
