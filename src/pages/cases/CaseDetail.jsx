import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Outlet, NavLink } from 'react-router-dom';
import { CheckCircle, FilePlus2, RefreshCw, UploadCloud } from 'lucide-react';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  normalizeCaseDetail,
  normalizeUploadedDocument,
} from '../../lib/caseWorkspace';
import CaseExceptionPanel from '../../components/cases/CaseExceptionPanel';

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
        : status === 'completed'
          ? 'bg-emerald-100 text-emerald-700'
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
      const appendedDocuments = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];

        try {
          const payload = await api.uploadDocuments(caseId, [file], (progress) => {
            setUploadProgress((prev) => ({ ...prev, [index]: progress }));
          });

          appendedDocuments.push(normalizeUploadedDocument(payload, file.name, index));
        } catch (error) {
          setUploadErrors((prev) => ({
            ...prev,
            [index]: getErrorMessage(error, `Failed to upload ${file.name}`),
          }));
        }
      }

      if (appendedDocuments.length) {
        const existing = workspaceCase.documents || [];
        updateCaseDetail({
          ...workspaceCase,
          documents: [...appendedDocuments, ...existing].sort((a, b) => {
            return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
          }),
        });
        showNotification('Documents uploaded and version history updated.', 'success');
      }

      setSelectedFiles([]);
      setUploadProgress({});
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
              <h1 className="text-4xl font-bold text-navy-900">Case {caseId}</h1>
              <StatusBadge status={workspaceCase?.status} />
            </div>
            <p className="text-gray-600 max-w-3xl">
              {workspaceCase?.case_description || 'Case workspace for evidence, analysis, and judge actions.'}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex items-center gap-2"
          >
            <FilePlus2 className="w-4 h-4" />
            Add Documents
          </button>
        </div>
      </div>

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
              className="w-full px-4 py-3 border border-dashed border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Select files to append to this case
            </button>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-3">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {!uploading && (
                        <button
                          onClick={() => removeSelectedFile(index)}
                          className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {uploadProgress[index] ? (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-teal-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${uploadProgress[index]}%` }}
                        />
                      </div>
                    ) : null}
                    {uploadErrors[index] ? (
                      <p className="text-xs text-rose-700 mt-2">{uploadErrors[index]}</p>
                    ) : null}
                  </div>
                ))}

                <button
                  onClick={handleAppendDocuments}
                  disabled={uploading}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    'Upload Documents'
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="card-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-navy-900">Version History</h2>
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>

            {workspaceCase?.documents?.length ? (
              <div className="space-y-3">
                {workspaceCase.documents.map((document) => (
                  <div key={document.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">
                          {document.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          Version {document.version}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-semibold">
                        {document.status}
                      </span>
                    </div>
                    {document.uploaded_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        Uploaded {new Date(document.uploaded_at).toLocaleString()}
                      </p>
                    )}
                    {document.affected_stages?.length ? (
                      <p className="text-xs text-teal-700 mt-2">
                        Re-runs: {document.affected_stages.join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        No affected stages reported
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No uploaded documents recorded yet.</p>
            )}
          </div>

          <CaseExceptionPanel caseId={caseId} caseDetail={workspaceCase} />
        </aside>
      </div>
    </div>
  );
}
