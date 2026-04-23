import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Outlet, NavLink } from 'react-router-dom';
import { FilePlus2, RefreshCw, UploadCloud } from 'lucide-react';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { normalizeCaseDetail } from '../../lib/caseWorkspace';
import { isGatePauseStatus, gateNameFromStatus } from '../../lib/pipelineStatus';
import CaseExceptionPanel from '../../components/cases/CaseExceptionPanel';
import DocumentUploadList from '../../components/cases/DocumentUploadList';
import GateReviewPanel from '../../components/cases/GateReviewPanel';

const RESTARTABLE_STATUSES = new Set(['failed', 'failed_retryable', 'escalated']);

const VALID_APPEND_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function StatusBadge({ status }) {
  const tone =
    status === 'closed'
      ? 'bg-gray-100 text-gray-700'
      : status === 'failed'
        ? 'bg-rose-100 text-rose-700'
        : status === 'completed' || status === 'ready_for_review'
          ? 'bg-emerald-100 text-emerald-700'
          : isGatePauseStatus(status)
            ? 'bg-teal-100 text-teal-700'
            : 'bg-blue-100 text-blue-700';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${tone}`}>
      {String(status || 'processing').replace(/_/g, ' ')}
    </span>
  );
}

export default function CaseDetail() {
  const { caseId } = useParams();
  const fileInputRef = useRef(null);
  const { showError, showNotification } = useAPI();
  const { caseDetail, updateCaseDetail, selectCase } = useCase();

  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchCase = async () => {
      try {
        setLoading(true);
        selectCase(caseId);
        const payload = await api.getCaseDetail(caseId);
        if (!isMounted) return;
        updateCaseDetail(normalizeCaseDetail(payload, caseId));
      } catch (error) {
        if (isMounted) {
          showError(getErrorMessage(error, 'Failed to load case workspace'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCase();

    return () => {
      isMounted = false;
    };
  }, [caseId, selectCase, showError, updateCaseDetail]);

  const workspaceCase = useMemo(() => {
    if (!caseDetail || caseDetail.case_id !== caseId) {
      return null;
    }

    return caseDetail;
  }, [caseDetail, caseId]);

  const handleRestartPipeline = useCallback(async () => {
    try {
      setRestarting(true);
      await api.restartPipeline(caseId);
      showNotification('Pipeline restart enqueued successfully.', 'success');
      const payload = await api.getCaseDetail(caseId);
      updateCaseDetail(normalizeCaseDetail(payload, caseId));
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to restart pipeline'));
    } finally {
      setRestarting(false);
    }
  }, [caseId, showError, showNotification, updateCaseDetail]);

  const handleFileSelection = (fileList) => {
    const files = Array.from(fileList || []);
    const validFiles = files.filter((file) => {
      if (!VALID_APPEND_TYPES.includes(file.type)) {
        showError(`${file.name}: Invalid file type for append upload.`);
        return false;
      }
      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleAppendDocuments = async () => {
    if (!selectedFiles.length || !workspaceCase) return;

    setUploading(true);
    setUploadErrors({});

    try {
      let anySuccess = false;
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        try {
          await api.uploadDocuments(caseId, [file], (progress) => {
            setUploadProgress((prev) => ({ ...prev, [index]: progress }));
          });
          anySuccess = true;
        } catch (error) {
          setUploadErrors((prev) => ({
            ...prev,
            [index]: getErrorMessage(error, `Failed to upload ${file.name}`),
          }));
        }
      }

      if (anySuccess) {
        // Refetch complete state to ensure all downstream analysis (KB, Dossier) reflects new data
        const payload = await api.getCaseDetail(caseId);
        updateCaseDetail(normalizeCaseDetail(payload, caseId));
        showNotification('Documents uploaded and workspace synchronized.', 'success');
      }

      setSelectedFiles([]);
      setUploadProgress({});
    } catch (error) {
      showError(getErrorMessage(error, 'Unexpected error during upload sync'));
    } finally {
      setUploading(false);
    }
  };

  if (loading && !workspaceCase) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading case workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-4xl font-bold text-navy-900">
                {workspaceCase?.title || `Case ${caseId}`}
              </h1>
              <StatusBadge status={workspaceCase?.raw_status || workspaceCase?.status} />
            </div>
            <p className="text-gray-600 max-w-3xl">
              {workspaceCase?.case_description || 'Case workspace for evidence, analysis, and judge actions.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {RESTARTABLE_STATUSES.has(workspaceCase?.raw_status) && (
              <button
                onClick={handleRestartPipeline}
                disabled={restarting}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
                {restarting ? 'Restarting…' : 'Restart Pipeline'}
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary flex items-center gap-2"
            >
              <FilePlus2 className="w-4 h-4" />
              Add Documents
            </button>
          </div>
        </div>
      </div>

      {isGatePauseStatus(workspaceCase?.raw_status) && (
        <GateReviewPanel
          caseId={caseId}
          gateName={gateNameFromStatus(workspaceCase.raw_status)}
          onAdvanced={async () => {
            const payload = await api.getCaseDetail(caseId);
            updateCaseDetail(normalizeCaseDetail(payload, caseId));
          }}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="min-w-0">
          <div className="flex gap-4 mb-6 border-b border-gray-200 pb-0 overflow-x-auto">
            <NavLink
              to={`/case/${caseId}/building`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Building
            </NavLink>
            <NavLink
              to={`/case/${caseId}/graph`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Graph Mesh
            </NavLink>
            <NavLink
              to={`/case/${caseId}/dossier`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Dossier
            </NavLink>
            <NavLink
              to={`/case/${caseId}/what-if`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              What-If
            </NavLink>
            <NavLink
              to={`/case/${caseId}/hearing-pack`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Hearing Pack
            </NavLink>
            <NavLink
              to={`/case/${caseId}/orchestrator`}
              className={({ isActive }) =>
                `px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-violet-600 text-violet-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              Orchestrator
            </NavLink>
          </div>

          <Outlet />
        </div>

        <aside className="space-y-4">
          <div className="card-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-navy-900">Add Documents</h2>
              <UploadCloud className="w-5 h-5 text-teal-600" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => handleFileSelection(event.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border border-dashed border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Select files to append to this case
            </button>

            <DocumentUploadList 
              selectedFiles={selectedFiles}
              onRemoveFile={removeSelectedFile}
              uploadProgress={uploadProgress}
              uploadErrors={uploadErrors}
              onUpload={handleAppendDocuments}
              uploading={uploading}
              documents={workspaceCase?.documents || []}
            />
          </div>

          <CaseExceptionPanel caseId={caseId} caseDetail={workspaceCase} />
        </aside>
      </div>
    </div>
  );
}
