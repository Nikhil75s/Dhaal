import { useState, useEffect, useRef } from 'react';
import { Search, Loader, X } from 'lucide-react';
import { fetchNetworkSearch } from '../../data/api';
import type { NetworkNode } from '../../data/schemas';
import { GROUP_LABELS, nodeColor } from '../../utils/networkStyles';

export default function NetworkSearchBar({ onSelect }: { onSelect: (node: NetworkNode) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchNetworkSearch(query);
        setResults(res);
      } catch (err) {
        console.error('Search error', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeout);
  }, [query]);

  // Grouping results
  const groupedResults = results.reduce((acc, node) => {
    const group = node.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(node);
    return acc;
  }, {} as Record<string, NetworkNode[]>);

  return (
    <div className="relative z-50 w-full max-w-md" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-text-secondary" />
        </div>
        <input
          type="text"
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
          placeholder="Search suspects, victims, cases..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full mt-2 w-full bg-[#0F172A] border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 flex items-center justify-center text-text-secondary">
              <Loader size={16} className="animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {Object.entries(groupedResults).map(([group, nodes]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-3 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider bg-slate-800/30">
                    {GROUP_LABELS[group] || group}
                  </div>
                  <ul>
                    {nodes.map((node) => (
                      <li key={node.id}>
                        <button
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                          onClick={() => {
                            onSelect(node);
                            setIsOpen(false);
                            setQuery('');
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: nodeColor(node.group) }}
                          />
                          <span className="truncate text-text-primary">{node.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-text-secondary">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
