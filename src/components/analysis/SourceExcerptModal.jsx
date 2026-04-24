import { useEffect, useReducer } from 'react';
import { X } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';

const initial = { loading: true, data: null, error: null };
function reducer(state, action) {
  switch (action.type) {
    case 'reset': return initial;
    case 'success': return { loading: false, data: action.data, error: null };
    case 'error': return { loading: false, data: null, error: action.error };
    default: return state;
  }
}

export default function SourceExcerptModal({ documentId, page, onClose }) {
  const [{ loading, data, error }, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'reset' });
    api.getDocumentExcerpt(documentId, page)
      .then(result => { if (!cancelled) dispatch({ type: 'success', data: result }); })
      .catch(err => { if (!cancelled) dispatch({ type: 'error', error: getErrorMessage(err) }); });
    return () => { cancelled = true; };
  }, [documentId, page]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-navy-900">{data?.filename || 'Document'}</h3>
            {data && (
              <p className="text-xs text-gray-500 mt-0.5">
                Page {data.page_number} of {data.total_pages} — uploaded {new Date(data.uploaded_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="flex items-center justify-center h-32"><div className="spinner w-6 h-6" /></div>}
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-sm text-sm text-rose-700">{error}</div>}
          {data?.text && (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-sm border">{data.text}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
