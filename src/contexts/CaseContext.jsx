/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useMemo } from 'react';
import { isTerminalPipelineStatus } from '../lib/pipelineStatus';

export const CaseContext = createContext();

export function CaseProvider({ children }) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseList, setCaseList] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('evidence'); // For dossier tabs
  const [whatIfMode, setWhatIfMode] = useState(false);

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
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}
