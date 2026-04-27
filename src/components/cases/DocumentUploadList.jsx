import React from 'react';
import { UploadCloud, X, FileText, Files, AlertCircle } from 'lucide-react';

const AUTHORITATIVE_KINDS = new Set(['notice_of_traffic_offence', 'charge_sheet']);

function formatKindLabel(kind) {
  if (!kind || kind === 'other') return 'EVIDENCE';
  return kind.replace(/_/g, ' ').toUpperCase();
}

export default function DocumentUploadList({
  selectedFiles = [],
  onRemoveFile,
  uploadProgress = {},
  uploadErrors = {},
  onUpload,
  uploading = false,
  documents = [],
}) {
  return (
    <div className="space-y-4">
      {/* Upload Selection Area */}
      {selectedFiles.length > 0 && (
        <div className="card-lg bg-teal-50/30 border-teal-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />
              Upload Queue ({selectedFiles.length})
            </h3>
            {!uploading && (
              <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Pending</p>
            )}
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {selectedFiles.map((file, index) => {
              const error = uploadErrors[index];
              const progress = uploadProgress[index];

              return (
                <div key={`${file.name}-${index}`} className="rounded-lg bg-white border border-teal-100 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-sm bg-teal-50">
                        <FileText className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-navy-900 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => onRemoveFile(index)}
                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {progress !== undefined && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-bold text-teal-700 mb-1">
                        <span>{progress === 100 ? 'Indexed' : 'Uploading...'}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-teal-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-teal-600 h-full transition-all duration-300 shadow-[0_0_8px_rgba(13,148,136,0.4)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-2 flex items-center gap-1.5 p-2 rounded-sm bg-rose-50 border border-rose-100">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <p className="text-[10px] text-rose-700 font-medium leading-tight">{error}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={onUpload}
            disabled={uploading}
            className={`w-full mt-4 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg ${
              uploading 
                ? 'bg-teal-700 text-teal-100 shadow-none' 
                : 'bg-teal-600 text-white hover:bg-teal-700 hover:-translate-y-0.5 shadow-teal-600/20'
            } disabled:opacity-50 disabled:translate-y-0`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="spinner-white w-4 h-4" />
                <span>Processing Pipeline...</span>
              </div>
            ) : (
              'Confirm & Start Analysis'
            )}
          </button>
        </div>
      )}

      {/* Uploaded Documents List */}
      <div className="card-lg bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
            <Files className="w-4 h-4 text-navy-400" />
            Uploaded Documents
          </h2>
          <div className="px-1.5 py-0.5 rounded-sm bg-gray-100 text-[10px] font-bold text-gray-500">
            {documents.length} {documents.length === 1 ? 'FILE' : 'FILES'}
          </div>
        </div>

        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc, idx) => {
              const isAuthoritative = AUTHORITATIVE_KINDS.has(doc.kind);
              return (
                <div key={doc.id || idx} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-gray-200 bg-white shrink-0">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-navy-900 truncate">
                        {doc.filename}
                      </p>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        isAuthoritative
                          ? 'bg-teal-50 text-teal-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {formatKindLabel(doc.kind)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {doc.uploaded_at && (
                        <p className="text-[10px] text-gray-400">
                          {new Date(doc.uploaded_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                      {(doc.uploader || doc.recorded_by) && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                          By {doc.uploader || doc.recorded_by}
                        </p>
                      )}
                    </div>

                    {doc.affected_stages?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {doc.affected_stages.map((stage) => (
                          <span key={stage} className="text-[9px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm border border-gray-100 font-medium">
                            {stage}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-500 italic">No documents uploaded for this case yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
