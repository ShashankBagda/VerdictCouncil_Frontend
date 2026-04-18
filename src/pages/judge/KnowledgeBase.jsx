import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Search, Trash2, FileText, Database, Loader, ShieldCheck, Clock, FileCheck } from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';
import { normalizeKBList, normalizeKBSearch } from '../../lib/caseWorkspace';

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
      setDocuments(normalizeKBList(res));
      setInitialized(Boolean(res.initialized ?? res.data?.initialized));
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

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      showError(`File exceeds 50 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      return false;
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      showError(`File type "${file.type}" not supported. Use PDF, PNG, JPEG, TXT, or DOC.`);
      return false;
    }
    return true;
  };

  const handleUpload = async (file) => {
    if (!validateFile(file)) return;
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
      setSearchResults(normalizeKBSearch(res));
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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center">
          <div className="spinner w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 mb-4" />
          <p className="text-gray-500 font-medium animate-pulse">Syncing Knowledge Base...</p>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full" />
          <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
            <Database className="w-16 h-16 text-teal-600" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-navy-900 mb-4 tracking-tight">Private Judicial Knowledge Base</h2>
        <p className="text-gray-600 mb-10 leading-relaxed text-lg max-w-lg mx-auto">
          Establish an isolated vector environment to host sensitive regulatory frameworks, private precedents, and judicial notes. 
          Your data remains localized and is queried exclusively during analysis.
        </p>
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="group relative px-10 py-4 bg-navy-900 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
        >
          {initializing ? (
            <div className="flex items-center gap-3">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Provisioning...</span>
            </div>
          ) : (
            'Initialize Vector Store'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px] mb-2">
            <ShieldCheck className="w-3 h-3" />
            Zero-Trust Vector Environment
          </div>
          <h1 className="text-4xl font-extrabold text-navy-900 tracking-tight">Knowledge Base</h1>
          <p className="text-gray-500 mt-2 max-w-xl">
            Manage and query your private legal corpus. All documents are automatically chunked and indexed for low-latency semantic retrieval.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
          <div className="text-right px-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Documents</div>
            <div className="text-xl font-black text-navy-900">{documents.length}</div>
          </div>
          <div className="w-[1px] h-8 bg-gray-200" />
          <div className="text-right px-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Status</div>
            <div className="text-sm font-bold text-emerald-600">ENCRYPTED</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Search */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Section */}
          <div className="card-lg shadow-sm border-gray-200 p-1">
            <div className="flex bg-gray-50 rounded-lg p-1">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Semantic query of your knowledge base..."
                  className="w-full pl-12 pr-4 py-3 bg-transparent text-navy-900 font-medium placeholder:text-gray-400 outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-2 bg-navy-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-navy-800 transition-all disabled:opacity-50"
              >
                {searching ? <Loader className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
            
            {searchResults && (
              <div className="mt-4 p-4 space-y-4 max-h-[500px] overflow-y-auto">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Retrieval Results</h3>
                  <button onClick={() => setSearchResults(null)} className="text-[10px] text-gray-400 hover:text-navy-900 font-bold uppercase transition-colors">Clear</button>
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 italic font-medium">No semantically relevant fragments found.</p>
                  </div>
                ) : (
                  searchResults.map((r, i) => (
                    <div key={i} className="group p-5 bg-white rounded-xl border border-gray-100 hover:border-teal-200 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-teal-600" />
                          <span className="text-[11px] font-black text-navy-900 uppercase tracking-tight">{r.filename}</span>
                        </div>
                        <div className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-black">
                          SCORE {(r.score * 100).toFixed(0)}%
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed font-serif italic border-l-2 border-teal-100 pl-4 py-1">
                        "{r.content}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`relative group border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              uploading ? 'bg-teal-50 border-teal-400' : 'bg-white border-gray-200 hover:border-teal-400 hover:bg-gray-50/50'
            }`}
          >
            {uploading ? (
              <div className="space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                   <Loader className="w-full h-full text-teal-500 animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-teal-700">
                     {uploadProgress}%
                   </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-navy-900 mb-1">Vectorizing Corpus...</p>
                  <p className="text-xs text-gray-500">Document is being chunked and embedded in real-time.</p>
                </div>
                <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300 shadow-[0_0_10px_rgba(20,184,166,0.5)]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-teal-600 transition-colors" />
                </div>
                <div>
                  <p className="text-base font-bold text-navy-900 mb-1 leading-tight">Drop your legal materials here</p>
                  <p className="text-xs text-gray-500 font-medium tracking-tight">Supports PDF, DOCX, TXT (Maximum 50MB per file)</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-navy-900 uppercase tracking-widest hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm active:scale-95"
                >
                  Browse Files
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
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Documents Inventory */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-lg border-gray-200 h-full flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-6 px-1">
              <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Inventory
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">
                {documents.length} FILES
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-2">
                <Database className="w-10 h-10 text-gray-300 mb-4" />
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  Your knowledge base is currently empty. Upload documents to provide contextual grounding for analysis.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
                {documents.map((doc) => (
                  <div key={doc.file_id} className="group relative bg-white rounded-xl border border-gray-100 p-4 transition-all hover:shadow-md hover:border-teal-100">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-teal-50 transition-colors">
                        <FileText className="w-5 h-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <p className="text-sm font-bold text-navy-900 truncate leading-tight capitalize">{doc.filename.replace(/_/g, ' ')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-mono font-medium">
                            {doc.bytes ? `${(doc.bytes / 1024).toFixed(1)} KB` : 'N/A'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className={`text-[9px] font-black uppercase ${
                            doc.status === 'indexed' || doc.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {doc.status || 'PROCESSED'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(doc.file_id, doc.filename)}
                      className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Permanently remove from vector store"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-100">
               <div className="flex items-center gap-3 p-3 bg-navy-50 rounded-xl border border-navy-100/50">
                 <Clock className="w-4 h-4 text-navy-400 flex-shrink-0" />
                 <p className="text-[10px] text-navy-700 leading-tight font-medium">
                   All uploads are automatically processed through the RAG pipeline using semantic chunking strategies.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
