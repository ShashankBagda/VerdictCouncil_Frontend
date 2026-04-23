import { useEffect, useState } from 'react';
import { Database, ShieldCheck, Clock } from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';
import { normalizeKnowledgeBaseStatus } from '../../lib/caseWorkspace';

export default function KnowledgeBase() {
  const { showError } = useAPI();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getKnowledgeBaseStatus();
        if (!cancelled) setStatus(normalizeKnowledgeBaseStatus(res));
      } catch (err) {
        if (!cancelled) showError(err.message || 'Failed to load knowledge base status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showError]);

  return (
    <div className="max-w-3xl mx-auto mt-12 pb-12">
      <div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px] mb-2">
        <ShieldCheck className="w-3 h-3" />
        Zero-Trust Vector Environment
      </div>
      <h1 className="text-4xl font-extrabold text-navy-900 tracking-tight mb-4">Knowledge Base</h1>
      <p className="text-gray-500 mb-10 max-w-xl">
        This screen focuses on the status, freshness, and readiness of the judicial knowledge base.
        It does not attempt to mirror every backend maintenance action in the UI.
      </p>

      <div className="card-lg border-gray-200 p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
            <Database className="w-8 h-8 text-teal-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-navy-900 mb-2">Current Status</h2>
            {loading ? (
              <p className="text-sm text-gray-400 animate-pulse">Checking vector store…</p>
            ) : status ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                <div>
                  <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Initialized</dt>
                  <dd className={`font-bold ${status.initialized ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {status.initialized ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Documents</dt>
                  <dd className="font-bold text-navy-900">{status.documents_count ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Status unavailable.</p>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-navy-50 rounded-xl border border-navy-100/50">
            <Clock className="w-4 h-4 text-navy-400 shrink-0" />
            <p className="text-[11px] text-navy-700 leading-tight font-medium">
              Judges can use this page to verify store readiness, freshness, and document volume
              before relying on AI-supported legal retrieval in the dossier.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
