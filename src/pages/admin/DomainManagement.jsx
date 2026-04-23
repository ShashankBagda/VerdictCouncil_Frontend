import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Upload, FileText, AlertTriangle, CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function StatusBadge({ isActive }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

const STATUS_META = {
  pending:  { label: 'Queued',    color: 'bg-gray-100 text-gray-600',     spin: false },
  uploading:{ label: 'Uploading', color: 'bg-blue-100 text-blue-700',     spin: true  },
  parsed:   { label: 'Scanning',  color: 'bg-yellow-100 text-yellow-700', spin: true  },
  indexing: { label: 'Indexing',  color: 'bg-yellow-100 text-yellow-700', spin: true  },
  indexed:  { label: 'Ready',     color: 'bg-green-100 text-green-800',   spin: false },
  failed:   { label: 'Failed',    color: 'bg-red-100 text-red-700',       spin: false },
};

const STEP_DESCRIPTIONS = {
  uploading: 'Step 1/3 — Uploading to OpenAI',
  parsed:    'Step 2/3 — Running security scan',
  indexing:  'Step 3/3 — Building vector index',
};

function DocStatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
      {meta.spin && (
        <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {meta.label}
    </span>
  );
}

export default function DomainManagement() {
  const [domains, setDomains] = useState([]);
  const [capabilities, setCapabilities] = useState({ uploads_enabled: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pollingRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Create domain form state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      const [domainsData, capsData] = await Promise.all([
        api.listDomainsAdmin(),
        api.getDomainCapabilities(),
      ]);
      setDomains(domainsData);
      setCapabilities(capsData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const fetchDocuments = useCallback(async (domainId) => {
    setDocsLoading(true);
    try {
      const docs = await api.listDomainDocuments(domainId);
      setDocuments(docs);
    } catch (err) {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const handleSelectDomain = (domain) => {
    stopPolling();
    setSelectedDomain(domain);
    fetchDocuments(domain.id);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const newDomain = await api.createDomain(createForm);
      setDomains((prev) => [...prev, newDomain]);
      setCreateOpen(false);
      setCreateForm({ code: '', name: '', description: '' });
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRetire = async (domainId) => {
    if (!window.confirm('Retire this domain? New cases will no longer be accepted for this domain.')) return;
    try {
      const updated = await api.retireDomain(domainId);
      setDomains((prev) => prev.map((d) => (d.id === domainId ? updated : d)));
      if (selectedDomain?.id === domainId) setSelectedDomain(updated);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleReactivate = async (domainId) => {
    try {
      const updated = await api.updateDomain(domainId, { is_active: true });
      setDomains((prev) => prev.map((d) => (d.id === domainId ? updated : d)));
      if (selectedDomain?.id === domainId) setSelectedDomain(updated);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file || !selectedDomain) return;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      alert('Unsupported file type. Allowed: PDF, TXT, Markdown, DOCX');
      return;
    }
    setUploading(true);
    try {
      const doc = await api.uploadDomainDocument(selectedDomain.id, file);
      setDocuments((prev) => [doc, ...prev]);

      const domainId = selectedDomain.id;
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const docs = await api.listDomainDocuments(domainId);
          setDocuments(docs);
          const hasInProgress = docs.some((d) => !['indexed', 'failed'].includes(d.status));
          if (!hasInProgress) stopPolling();
        } catch {
          stopPolling();
        }
      }, 2500);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Delete this document from the domain knowledge base?')) return;
    try {
      await api.deleteDomainDocument(selectedDomain.id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domain Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage legal domains with per-domain knowledge bases.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Domain
        </button>
      </div>

      {!capabilities.uploads_enabled && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>File uploads are disabled</strong> by the platform administrator. Contact the
            platform team to re-enable.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain list */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Domains
          </h2>
          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                onClick={() => handleSelectDomain(domain)}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedDomain?.id === domain.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">{domain.name}</span>
                      <StatusBadge isActive={domain.is_active} />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{domain.code}</span>
                    {domain.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{domain.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {domain.is_active ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetire(domain.id); }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Retire domain"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReactivate(domain.id); }}
                        className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                        title="Reactivate domain"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {domains.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                No domains yet. Create the first one.
              </div>
            )}
          </div>
        </div>

        {/* Document panel */}
        <div>
          {selectedDomain ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {selectedDomain.name} — Documents
                </h2>
                {capabilities.uploads_enabled && (
                  <label
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      uploading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                    }`}
                    title={uploading ? 'Sending file to server…' : 'Upload a document'}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-400" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt,.md,.docx"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              {docsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 border border-gray-200 rounded-lg p-3 bg-white"
                    >
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {doc.filename}
                          </span>
                          <DocStatusBadge status={doc.status} />
                          {doc.status === 'indexed' && (
                            <span
                              title="Content passed 2-layer security scan (regex + semantic classifier)"
                              className="flex items-center text-green-600"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        {doc.error_reason && (
                          <p className="text-xs text-red-600 mt-1">{doc.error_reason}</p>
                        )}
                        {STEP_DESCRIPTIONS[doc.status] && (
                          <p className="text-xs text-blue-500 mt-0.5">{STEP_DESCRIPTIONS[doc.status]}</p>
                        )}
                        {doc.size_bytes && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(doc.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                      {capabilities.uploads_enabled
                        ? 'No documents yet. Upload one to populate the knowledge base.'
                        : 'Document uploads are disabled by the platform administrator.'}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
              Select a domain to manage its documents.
            </div>
          )}
        </div>
      </div>

      {/* Create domain modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Domain</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.code}
                  onChange={(e) => setCreateForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
                  placeholder="e.g. small_claims"
                  pattern="[a-z0-9_]+"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Lowercase letters, digits, underscores only.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Small Claims Tribunal"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description of this domain's scope."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {createError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {createError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCreateOpen(false); setCreateError(null); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium"
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Create Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
