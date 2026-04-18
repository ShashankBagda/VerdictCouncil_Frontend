import React from 'react';
import { Database, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function KnowledgeBaseStatusChip({ status }) {
  if (!status) return null;

  const isReady = status.initialized;
  
  if (!isReady) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-sm">
        <AlertCircle className="w-3.5 h-3.5" />
        Knowledge Base Not Initialized
      </div>
    );
  }

  return (
    <div className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-sm">
      <CheckCircle className="w-3.5 h-3.5" />
      <span>
        KB Ready {status.documents ? ` • ${status.documents} documents` : ''}
      </span>
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-navy-900 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        <div className="space-y-2">
          <div className="flex justify-between border-b border-white/10 pb-1">
            <span className="text-gray-400">Total Documents</span>
            <span className="font-bold">{status.documents || 0}</span>
          </div>
          {status.chunks && (
            <div className="flex justify-between border-b border-white/10 pb-1">
              <span className="text-gray-400">Vector Chunks</span>
              <span className="font-bold">{status.chunks}</span>
            </div>
          )}
          {status.lastUpdated && (
            <div className="flex items-center gap-1.5 pt-1 text-gray-300">
              <Clock className="w-3 h-3" />
              <span>Updated {new Date(status.lastUpdated).toLocaleString()}</span>
            </div>
          )}
          <div className="pt-1 text-[10px] text-emerald-400 font-medium">
            Status: {status.status || 'Ready'}
          </div>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-navy-900" />
      </div>
    </div>
  );
}
