import { FileSearch, Search, ExternalLink } from 'lucide-react';

function MetaBadge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
}

export default function PrecedentSearchPanel({
  query,
  onQueryChange,
  domain,
  onDomainChange,
  onSearch,
  results = [],
  searching = false,
  searched = false,
  searchedAt = null,
}) {
  return (
    <div className="space-y-4">
      <div className="card-lg">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-cyan-600" />
            Live Precedent Search
          </h2>
          {searchedAt && (
            <p className="text-xs text-gray-500 mt-1 shrink-0">
              Last live search: {new Date(searchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Search precedents directly from the dossier to validate the current legal theory before issuing a decision.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-3">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search by issue, statute, holding, or legal principle"
            className="input-field"
          />
          <input
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Domain or court"
            className="input-field"
          />
          <button
            onClick={onSearch}
            disabled={searching}
            className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {searching ? (
              <div className="spinner-white w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {searching ? 'Searching...' : 'Search Live Database'}
          </button>
        </div>
      </div>

      <div className="card-lg">
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-cyan-200 bg-cyan-50/30 p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-navy-900 flex items-center gap-2">
                      {item.title || item.case_name || item.name || `Precedent ${idx + 1}`}
                      {item.year && <span className="text-gray-400 font-normal">({item.year})</span>}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {[item.citation, item.court, item.jurisdiction].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(item.score !== undefined || item.relevance !== undefined) && (
                      <MetaBadge tone="cyan">
                        Match {Math.round((item.score ?? item.relevance) * ((item.score ?? item.relevance) <= 1 ? 100 : 1))}%
                      </MetaBadge>
                    )}
                    {item.source === 'live_search'
                      ? <MetaBadge tone="amber">live</MetaBadge>
                      : item.source && <MetaBadge tone="gray">{item.source}</MetaBadge>}
                  </div>
                </div>

                {(item.summary || item.holding || item.snippet || item.text) && (
                  <div className="mt-3 p-3 bg-white/50 rounded-sm border border-cyan-100/50">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {item.summary || item.holding || item.snippet || item.text}
                    </p>
                  </div>
                )}

                {(item.url || item.link) && (
                  <a
                    href={item.url || item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800 mt-3 transition-colors"
                  >
                    Open Full Report
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : searched ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No precedent matches returned for this search.</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your keywords or domain filter.</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">Ready to search</p>
            <p className="text-sm text-gray-500 mt-1">Run a search to load matching legal precedents.</p>
          </div>
        )}
      </div>
    </div>
  );
}
