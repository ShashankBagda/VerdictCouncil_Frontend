import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Outlet, NavLink } from 'react-router-dom';
import { FilePlus2, RefreshCw, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { cn } from '@/lib/utils';
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
  const variant =
    status === 'closed'
      ? 'secondary'
      : status === 'failed'
        ? 'destructive'
        : status === 'completed' || status === 'ready_for_review'
          ? 'secondary'
          : isGatePauseStatus(status)
            ? 'outline'
            : 'outline';

  return (
    <Badge variant={variant} className="capitalize">
      {String(status || 'processing').replace(/_/g, ' ')}
    </Badge>
  );
}

const WORKSPACE_TABS = [
  ['building', 'Building'],
  ['graph', 'Graph Mesh'],
  ['dossier', 'Dossier'],
  ['what-if', 'What-If'],
  ['hearing-pack', 'Hearing Pack'],
  ['orchestrator', 'Orchestrator'],
];

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
      <Card>
        <CardContent className="flex h-96 flex-col justify-center gap-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-2xl">
                {workspaceCase?.title || `Case ${caseId}`}
              </CardTitle>
              <StatusBadge status={workspaceCase?.raw_status || workspaceCase?.status} />
            </div>
            <CardDescription className="mt-2 max-w-3xl">
              {workspaceCase?.case_description || 'Case workspace for evidence, analysis, and judge actions.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RESTARTABLE_STATUSES.has(workspaceCase?.raw_status) && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRestartPipeline}
                disabled={restarting}
              >
                <RefreshCw data-icon="inline-start" className={cn(restarting && 'animate-spin')} />
                {restarting ? 'Restarting…' : 'Restart Pipeline'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <FilePlus2 data-icon="inline-start" />
              Add Documents
            </Button>
          </div>
        </CardHeader>
      </Card>

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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
            {WORKSPACE_TABS.map(([slug, label]) => (
              <NavLink
                key={slug}
                to={`/case/${caseId}/${slug}`}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <Outlet />
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Add Documents</CardTitle>
                <CardDescription>Append evidence to this case.</CardDescription>
              </div>
              <UploadCloud className="text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => handleFileSelection(event.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-auto border-dashed py-4"
            >
              Select files to append to this case
            </Button>

            <DocumentUploadList 
              selectedFiles={selectedFiles}
              onRemoveFile={removeSelectedFile}
              uploadProgress={uploadProgress}
              uploadErrors={uploadErrors}
              onUpload={handleAppendDocuments}
              uploading={uploading}
              documents={workspaceCase?.documents || []}
            />
            </CardContent>
          </Card>

          <CaseExceptionPanel caseId={caseId} caseDetail={workspaceCase} />
        </aside>
      </div>
    </div>
  );
}
