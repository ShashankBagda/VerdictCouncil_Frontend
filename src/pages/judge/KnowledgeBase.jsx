import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Search, Trash2, FileText, Database, Loader } from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';

export default function KnowledgeBase() {
  const { showError, showNotification } = useAPI();

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.listKBDocuments();
      setDocuments(res.documents || []);
      setInitialized(res.initialized);
    } catch (err) {
      showError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      await api.initializeKB();
      setInitialized(true);
      showNotification('Knowledge base created', 'success');
    } catch (err) {
      showError(err.message || 'Failed to initialize');
    } finally {
      setInitializing(false);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      await api.uploadToKB(file, (progress) => setUploadProgress(progress));
      showNotification(`${file.name} uploaded and indexed`, 'success');
      await fetchDocuments();
    } catch (err) {
      showError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (fileId, filename) => {
    try {
      await api.deleteKBDocument(fileId);
      setDocuments((prev) => prev.filter((d) => d.file_id !== fileId));
      showNotification(`${filename} deleted`, 'success');
    } catch (err) {
      showError(err.message || 'Delete failed');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchKB(searchQuery);
      setSearchResults(res.results || []);
    } catch (err) {
      showError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <Database className="w-16 h-16 mx-auto text-gray-400 mb-6" />
        <h2 className="text-2xl font-bold text-navy-900 mb-3">Personal Knowledge Base</h2>
        <p className="text-gray-600 mb-8">
          Create a private vector store to upload your own legal documents, notes, and references.
          These will be searched during pipeline analysis alongside PAIR API precedents.
        </p>
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="px-8 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {initializing ? 'Creating...' : 'Initialize Knowledge Base'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Knowledge Base</h1>
        <p className="text-gray-600">
          Upload legal documents, notes, and references. These are searched during pipeline analysis.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors"
      >
        {uploading ? (
          <div>
            <Loader className="w-8 h-8 mx-auto text-teal-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600 mb-2">Uploading and indexing...</p>
            <div className="w-48 mx-auto h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-teal-500 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-semibold text-navy-900 mb-1">Drag and drop a file</p>
            <p className="text-xs text-gray-500 mb-3">PDF, Word, or text files</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg font-semibold hover:bg-teal-700"
            >
              Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search your knowledge base..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 disabled:opacity-50"
          >
            {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {searchResults && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No results found</p>
            ) : (
              searchResults.map((r, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-navy-900">{r.filename}</span>
                    <span className="text-xs text-gray-500">Score: {(r.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-3">{r.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-navy-900">Documents ({documents.length})</h3>
        </div>
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No documents uploaded yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.file_id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-navy-900">{doc.filename}</p>
                    <p className="text-xs text-gray-500">
                      {doc.bytes ? `${(doc.bytes / 1024).toFixed(1)} KB` : ''}
                      {doc.status && ` · ${doc.status}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.file_id, doc.filename)}
                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
