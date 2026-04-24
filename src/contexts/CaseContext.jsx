/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useMemo } from 'react';
import { isTerminalPipelineStatus } from '../lib/pipelineStatus';

export const CaseContext = createContext();

/** Initial shape for cached dossier analysis data. */
const EMPTY_DOSSIER = {
  caseDetail: null,
  evidence: null,
  evidenceGaps: null,
  timeline: null,
  witnesses: null,
  statutes: null,
  arguments_: null,
  hearingAnalysis: null,
  fairnessAudit: null,
  knowledgeBaseStatus: null,
  reopenRequests: [],
  /** caseId the cache belongs to — used to invalidate on case switch */
  cachedForCaseId: null,
  /** true while the initial parallel fetch is in flight */
  dossierLoading: false,
};

export function CaseProvider({ children }) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseList, setCaseList] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('evidence'); // For dossier tabs
  const [whatIfMode, setWhatIfMode] = useState(false);

  // ── Dossier analysis cache (survives tab navigation) ────────────────────
  const [dossierCache, setDossierCache] = useState(EMPTY_DOSSIER);

  const updateDossierCache = useCallback((patch) => {
    setDossierCache((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearDossierCache = useCallback(() => {
    setDossierCache(EMPTY_DOSSIER);
  }, []);

  const updateCaseDetail = useCallback((detail) => {
    setCaseDetail(detail);
  }, []);

  const updateCaseList = useCallback((list) => {
    setCaseList(list);
  }, []);

  const updatePipelineStatus = useCallback((status) => {
    setPipelineStatus(status);
  }, []);

  const selectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCaseId(null);
    setCaseDetail(null);
    setPipelineStatus(null);
    setActiveTab('evidence');
    setWhatIfMode(false);
    setDossierCache(EMPTY_DOSSIER);
  }, []);

  /** Derived: is the pipeline in a terminal state? */
  const isPipelineTerminal = useMemo(
    () => isTerminalPipelineStatus(pipelineStatus),
    [pipelineStatus],
  );

  const value = {
    selectedCaseId,
    selectCase,
    clearSelection,
    caseDetail,
    updateCaseDetail,
    caseList,
    updateCaseList,
    pipelineStatus,
    updatePipelineStatus,
    isPipelineTerminal,
    activeTab,
    setActiveTab,
    whatIfMode,
    setWhatIfMode,
    dossierCache,
    updateDossierCache,
    clearDossierCache,
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}
