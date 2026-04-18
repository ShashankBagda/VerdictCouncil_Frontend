import React, { useEffect, useState } from 'react';
import { Scale, TriangleAlert, ShieldCheck, Database, AppWindow } from 'lucide-react';
import api from '../../lib/api';

export default function CaseContextSection({ caseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMinimal = async () => {
      if (!caseId || caseId === 'unknown') return;
      try {
        setLoading(true);
        // We fetch the case record to get minimal snapshot
        const res = await api.getCase(caseId);
        const dossier = res?.data || res || {};
        
        setData({
          fairnessScore: dossier.fairness_score || dossier.fairness?.score || null,
          evidenceGaps: dossier.evidence_gaps?.length || 0,
          disputedFacts: dossier.disputed_facts?.length || 0,
          status: dossier.status,
          type: dossier.case_type
        });
      } catch (err) {
        console.error('Failed to fetch case context', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMinimal();
  }, [caseId]);

  if (loading) {
    return (
      <div className="animate-pulse flex space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="rounded-full bg-gray-200 h-10 w-10"></div>
        <div className="flex-1 space-y-3 py-1">
          <div className="h-2 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-2 bg-gray-200 rounded col-span-2"></div>
            <div className="h-2 bg-gray-200 rounded col-span-1"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black text-navy-900 uppercase tracking-[0.2em] flex items-center gap-2">
          <AppWindow className="w-3.5 h-3.5 text-navy-400" />
          Case Snapshot
        </h3>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">ID: {caseId}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-violet-600">
            <Scale className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-wider">Fairness</span>
          </div>
          <div className="text-xl font-black text-violet-900">
            {data.fairnessScore !== null ? `${data.fairnessScore}%` : '--'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-amber-600">
            <TriangleAlert className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-wider">Gaps</span>
          </div>
          <div className="text-xl font-black text-amber-900">
            {data.evidenceGaps}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex flex-col gap-1 col-span-2 md:col-span-1">
          <div className="flex items-center gap-1.5 text-rose-600">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-wider">Disputes</span>
          </div>
          <div className="text-xl font-black text-rose-900">
            {data.disputedFacts}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="text-[10px] font-bold text-gray-500 uppercase">{data.status}</span>
        </div>
        <button 
           className="text-[10px] font-black text-teal-600 uppercase tracking-wider hover:text-teal-700 transition-colors"
           onClick={() => window.open(`/cases/${caseId}`, '_blank')}
        >
          Open Case Workspace →
        </button>
      </div>
    </div>
  );
}
