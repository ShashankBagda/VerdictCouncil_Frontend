import { useEffect, useState, useCallback, useRef } from 'react';
import { Database, ShieldCheck, Clock, Upload, Trash2, FileText, BookOpen, Info } from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';
import { normalizeKnowledgeBaseStatus } from '../../lib/caseWorkspace';

export default function KnowledgeBase() {
  const { showError } = useAPI();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [systemDomains, setSystemDomains] = useState([]);
  const fileInputRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getKnowledgeBaseStatus();
      setStatus(normalizeKnowledgeBaseStatus(res));
    } catch (err) {
      showError(err.message || 'Failed to load knowledge base status');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await api.listKnowledgeBaseDocuments();
      setDocuments(res?.items || []);
    } catch (err) {
      showError(err.message || 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchStatus();
    api.listDomains()
      .then((domains) => setSystemDomains((domains || []).filter((d) => d.has_vector_store)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.initialized) fetchDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.initialized]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      await api.initializeKnowledgeBase();
      await fetchStatus();
    } catch (err) {
      showError(err.message || 'Failed to initialize knowledge base');
    } finally {
      setInitializing(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      await api.uploadKnowledgeBaseDocument(file);
      await Promise.all([fetchDocuments(), fetchStatus()]);
    } catch (err) {
      showError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    setDeletingId(fileId);
    try {
      await api.deleteKnowledgeBaseDocument(fileId);
      setDocuments((prev) => prev.filter((d) => d.id !== fileId));
      await fetchStatus();
    } catch (err) {
      showError(err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-12 pb-12">
      <div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px] mb-2">
        <ShieldCheck className="w-3 h-3" />
        Zero-Trust Vector Environment
      </div>
      <h1 className="text-4xl font-extrabold text-navy-900 tracking-tight mb-4">Knowledge Base</h1>
      <p className="text-gray-500 mb-10 max-w-xl">
        Upload private legal materials to enhance AI-supported precedent retrieval in case dossiers.
      </p>

      {/* System domain stores banner + list */}
      {systemDomains.length > 0 && (
        <div className="mb-6">
          <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 mb-3">
            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p className="text-[12px] text-teal-800 leading-snug">
              <span className="font-semibold">System domain stores</span> are curated by administrators
              and applied automatically to every case in that domain. You cannot edit them, but they
              are always active and visible to the AI during analysis.
            </p>
          </div>

          <div className="card-lg border-gray-200 divide-y divide-gray-100">
            {systemDomains.map((domain) => (
              <div key={domain.id} className="flex items-center gap-4 px-6 py-4">
                <div className="p-2 rounded-lg bg-navy-50 border border-navy-100 shrink-0">
                  <BookOpen className="w-5 h-5 text-navy-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900">{domain.name}</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">{domain.code}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Judge's personal KB status card */}
      <div className="card-lg border-gray-200 p-8 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
            <Database className="w-8 h-8 text-teal-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-navy-900 mb-2">Your Private Store</h2>
            {loading ? (
              <p className="text-sm text-gray-400 animate-pulse">Checking vector store…</p>
            ) : status ? (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm mb-4">
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
                {!status.initialized && (
                  <button
                    onClick={handleInitialize}
                    disabled={initializing}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {initializing ? 'Initializing…' : 'Initialize Knowledge Base'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Status unavailable.</p>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-navy-50 rounded-xl border border-navy-100/50">
            <Clock className="w-4 h-4 text-navy-400 shrink-0" />
            <p className="text-[11px] text-navy-700 leading-tight font-medium">
              Your private store supplements system domain stores — upload rulings, annotations, or
              practice notes that apply across multiple cases.
            </p>
          </div>
        </div>
      </div>

      {/* Documents card — only when initialized */}
      {status?.initialized && (
        <div className="card-lg border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-navy-900">Documents</h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.docx"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Upload Document'}
              </button>
            </div>
          </div>

          {docsLoading ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading documents…</p>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-500">No documents yet. Upload legal materials to activate precedent support.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{doc.filename}</p>
                      <p className="text-[11px] text-gray-400">
                        {doc.status}
                        {doc.bytes ? ` · ${(doc.bytes / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors shrink-0"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
