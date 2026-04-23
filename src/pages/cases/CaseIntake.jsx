import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, CheckCircle, Beaker, AlertTriangle, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAPI, useCase } from '../../hooks';
import api, { APIError, getErrorMessage } from '../../lib/api';
import { DEMO_CASES } from '../../data/demoCases';
import { buildDemoPipelineStatus } from '../../lib/pipelineStatus';
import AuthContentGate from '../../components/auth/AuthContentGate';

const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === '1';

const VALID_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 20;

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCaseId(response) {
  return (
    response?.id ||
    response?.case_id ||
    response?.data?.id ||
    response?.data?.case_id ||
    null
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Validate a single file. Returns an error string or null. */
function validateFile(file, existingCount) {
  if (existingCount >= MAX_FILES) {
    return `Maximum ${MAX_FILES} files allowed.`;
  }
  if (!VALID_FILE_TYPES.includes(file.type)) {
    return `${file.name}: Invalid file type. Allowed: PDF, images, text, Word docs.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: File too large (${formatFileSize(file.size)}). Max 50 MB.`;
  }
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CaseIntake() {
  const navigate = useNavigate();
  const { showError, showNotification } = useAPI();
  const { selectCase, updatePipelineStatus } = useCase();

  // Domain list
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  // Form state
  const [step, setStep] = useState(1);
  const [caseTitle, setCaseTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [caseDescription, setCaseDescription] = useState('');
  const [filedDate, setFiledDate] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [consentToHigherClaimLimit, setConsentToHigherClaimLimit] = useState(false);
  const [offenceCode, setOffenceCode] = useState('');

  // File state
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseCreated, setCaseCreated] = useState(null);
  const [selectedDemoCase, setSelectedDemoCase] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Drag state (useState so the drop zone re-renders)
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.listDomains()
      .then(setDomains)
      .catch(() => setDomains([]))
      .finally(() => setDomainsLoading(false));
  }, []);

  // Dirty-form guard: warn before navigating away with unsaved data
  const isDirty =
    !caseCreated &&
    (domain !== '' ||
      caseTitle.trim() !== '' ||
      caseDescription.trim() !== '' ||
      filedDate !== '' ||
      plaintiff.trim() !== '' ||
      defendant.trim() !== '' ||
      files.length > 0);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Validation ──────────────────────────────────────────────────────────

  const descriptionMinLength = 10;
  const isStep1Valid =
    domain !== '' &&
    caseTitle.trim().length > 0 &&
    filedDate !== '' &&
    caseDescription.trim().length >= descriptionMinLength &&
    (domain === 'small_claims'
      ? claimAmount !== '' && Number.parseFloat(claimAmount) > 0
      : domain === 'traffic_violation'
        ? offenceCode.trim().length > 0
        : true);
  const isStep2Valid =
    plaintiff.trim().length > 0 && defendant.trim().length > 0;
  const isStep3Valid = files.length > 0;

  const canProceedToStep2 = isStep1Valid;
  const canProceedToStep3 = isStep1Valid && isStep2Valid;
  const canSubmit = canProceedToStep3 && isStep3Valid;

  // ── Demo loader ─────────────────────────────────────────────────────────

  const loadDemoCase = useCallback(
    (demo) => {
      if (!DEMO_MODE) {
        showError('Demo mode is disabled for this environment.');
        return;
      }
      setDomain(demo.formState.domain || '');
      setSelectedDomainId(null);
      setCaseTitle(demo.formState.caseTitle || '');
      setCaseDescription(demo.description);
      setFiledDate(demo.formState.filedDate || '');
      setPlaintiff(demo.formState.appellant);
      setDefendant(demo.formState.respondent);
      setClaimAmount(demo.formState.claimAmount || '');
      setConsentToHigherClaimLimit(Boolean(demo.formState.consentToHigherClaimLimit));
      setOffenceCode(demo.formState.offenceCode || '');
      setFiles(demo.files || []);
      setSelectedDemoCase(demo);
      setUploadErrors({});
      setUploadProgress({});
      setUploadedFiles({});
      setFieldErrors({});
      setStep(3);
      showNotification(`Loaded demo: ${demo.label}`, 'success');
    },
    [showError, showNotification],
  );

  // ── File handling ───────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (newFiles) => {
      const fileArray = Array.from(newFiles || []);
      setSelectedDemoCase(null);

      let currentCount = files.length;
      const validFiles = [];

      for (const file of fileArray) {
        const err = validateFile(file, currentCount);
        if (err) {
          showError(err);
        } else {
          validFiles.push(file);
          currentCount += 1;
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [files.length, showError],
  );

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setUploadedFiles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  // ── Retry a single failed upload ────────────────────────────────────────

  const retryUpload = useCallback(
    async (index, createdCaseId) => {
      const file = files[index];
      if (!file || !createdCaseId) return;

      setUploadErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setUploadProgress((prev) => ({ ...prev, [index]: 0 }));

      try {
        await api.uploadDocuments(createdCaseId, [file], (progress) => {
          setUploadProgress((prev) => ({ ...prev, [index]: progress }));
        });
        setUploadedFiles((prev) => ({ ...prev, [index]: true }));
        setUploadProgress((prev) => ({ ...prev, [index]: 100 }));
      } catch (err) {
        setUploadErrors((prev) => ({
          ...prev,
          [index]: getErrorMessage(err, `Failed to upload ${file.name || file.originalName}`),
        }));
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    },
    [files],
  );

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setUploadErrors({});
    setUploadedFiles({});
    setUploadProgress({});
    setFieldErrors({});

    try {
      // ── Demo path ───────────────────────────────────────────────────
      if (DEMO_MODE && selectedDemoCase) {
        const demoCaseId = `demo-${selectedDemoCase.id}`;
        setCaseCreated(demoCaseId);
        selectCase(demoCaseId);
        updatePipelineStatus(buildDemoPipelineStatus(demoCaseId));
        showNotification('Demo case loaded. Redirecting to pipeline view...', 'success');
        setTimeout(() => navigate(`/case/${demoCaseId}/building`), 800);
        return;
      }

      // ── Real path ──────────────────────────────────────────────────
      const parties =
        domain === 'traffic_violation'
          ? [
              { name: plaintiff.trim(), role: 'prosecution' },
              { name: defendant.trim(), role: 'accused' },
            ]
          : [
              { name: plaintiff.trim(), role: 'claimant' },
              { name: defendant.trim(), role: 'respondent' },
            ];
      const caseData = {
        domain,
        domain_id: selectedDomainId || undefined,
        title: caseTitle.trim(),
        description: caseDescription.trim(),
        filed_date: filedDate,
        parties,
        claim_amount: domain === 'small_claims' ? Number.parseFloat(claimAmount) : undefined,
        consent_to_higher_claim_limit:
          domain === 'small_claims' ? consentToHigherClaimLimit : undefined,
        offence_code:
          domain === 'traffic_violation' ? offenceCode.trim().toUpperCase() : undefined,
      };

      const createResponse = await api.createCase(caseData);
      const newCaseId = normalizeCaseId(createResponse);

      if (!newCaseId) {
        throw new Error('Case creation succeeded but no case ID was returned.');
      }

      setCaseCreated(newCaseId);
      selectCase(newCaseId);

      // ── Upload files sequentially with per-file progress ──────────
      let hasUploadFailure = false;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        try {
          await api.uploadDocuments(newCaseId, [file], (progress) => {
            setUploadProgress((prev) => ({ ...prev, [i]: progress }));
          });
          setUploadedFiles((prev) => ({ ...prev, [i]: true }));
          setUploadProgress((prev) => ({ ...prev, [i]: 100 }));
        } catch (err) {
          hasUploadFailure = true;
          setUploadErrors((prev) => ({
            ...prev,
            [i]: getErrorMessage(err, `Failed to upload ${file.name || file.originalName}`),
          }));
        }
      }

      if (hasUploadFailure) {
        showError('Case created, but one or more files failed to upload. You can retry below.');
      } else {
        try {
          await api.runCase(newCaseId);
        } catch (err) {
          showError(getErrorMessage(err, 'Uploads succeeded but the pipeline failed to start.'));
          return;
        }
        showNotification('Case created successfully! Redirecting to pipeline...', 'success');
        setTimeout(() => navigate(`/case/${newCaseId}/building`), 1200);
      }
    } catch (err) {
      // Surface field-level validation errors from the backend
      if (err instanceof APIError && err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      showError(getErrorMessage(err, 'Failed to create case'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Auth guard ──────────────────────────────────────────────────────────


  // ── Render ──────────────────────────────────────────────────────────────

  const failedUploads = Object.keys(uploadErrors).length;

  return (
    <AuthContentGate>
      <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-navy-900 mb-2">New Case Intake</h1>
      <p className="text-gray-600 mb-8">Follow the steps below to register a new case</p>

      {/* ── Step indicator ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-12" role="navigation" aria-label="Intake steps">
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <button
              onClick={() => {
                if (n < step) setStep(n);
              }}
              disabled={n > step}
              aria-current={n === step ? 'step' : undefined}
              aria-label={`Step ${n}${n < step ? ' (completed)' : ''}`}
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                n < step
                  ? 'bg-teal-500 text-white cursor-pointer hover:bg-teal-600'
                  : n === step
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-200 text-gray-600 cursor-not-allowed'
              }`}
            >
              {n < step ? '✓' : n}
            </button>
            {n < 3 && (
              <div
                className={`flex-1 h-1 mx-4 transition-all ${
                  n < step ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Demo loader (step 1 only) ──────────────────────────────────── */}
      {step === 1 && DEMO_MODE && DEMO_CASES.length > 0 && (
        <div className="card-lg bg-amber-50 border border-amber-200 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Beaker className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Load Demo Case</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_CASES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => loadDemoCase(demo)}
                className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {demo.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: Case Type ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 1: Case Type</h2>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Case Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="e.g., Late delivery refund dispute"
              className="input-field"
              maxLength={200}
            />
            {fieldErrors.title && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.title}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Filing Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={filedDate}
              onChange={(e) => setFiledDate(e.target.value)}
              className="input-field"
            />
            {fieldErrors.filed_date && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.filed_date}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-3">
              Domain <span className="text-rose-500">*</span>
            </label>
            {domainsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500" />
                Loading domains…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {domains.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setDomain(d.code); setSelectedDomainId(d.id); }}
                    className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                      domain === d.code
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
                {domains.length === 0 && (
                  <p className="text-sm text-gray-400 col-span-2">
                    No active domains configured. Contact an administrator.
                  </p>
                )}
              </div>
            )}
            {fieldErrors.domain && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.domain}</p>
            )}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Case Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
              placeholder="Briefly describe the case (issues, context, relevant facts)"
              className="input-field h-32"
              maxLength={5000}
            />
            <div className="flex justify-between mt-1">
              <p className={`text-xs ${
                caseDescription.trim().length > 0 && caseDescription.trim().length < descriptionMinLength
                  ? 'text-rose-500'
                  : 'text-gray-500'
              }`}>
                Min {descriptionMinLength} characters
              </p>
              <p className="text-xs text-gray-400">{caseDescription.length} / 5000</p>
            </div>
            {fieldErrors.description && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.description}</p>
            )}
          </div>

          {domain === 'small_claims' && (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Claim Amount (SGD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="e.g., 5000"
                className="input-field"
                min="0"
                step="0.01"
              />
              <label className="mt-3 flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={consentToHigherClaimLimit}
                  onChange={(e) => setConsentToHigherClaimLimit(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Both parties have filed consent for the higher Small Claims Tribunal limit
                  (up to SGD 30,000).
                </span>
              </label>
              {fieldErrors.claim_amount && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.claim_amount}</p>
              )}
            </div>
          )}

          {domain === 'traffic_violation' && (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Offence Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={offenceCode}
                onChange={(e) => setOffenceCode(e.target.value.toUpperCase())}
                placeholder="e.g., RTA-S64"
                className="input-field"
                maxLength={20}
              />
              {fieldErrors.offence_code && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.offence_code}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Party Information ──────────────────────────────────── */}
      {step === 2 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 2: Party Information</h2>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                {domain === 'traffic_violation' ? 'Prosecution' : 'Claimant'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={plaintiff}
                onChange={(e) => setPlaintiff(e.target.value)}
                placeholder="Full name"
                className="input-field"
                maxLength={200}
              />
              {fieldErrors.parties && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.parties}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                {domain === 'traffic_violation' ? 'Accused' : 'Respondent'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={defendant}
                onChange={(e) => setDefendant(e.target.value)}
                placeholder="Full name"
                className="input-field"
                maxLength={200}
              />
            </div>
          </div>

          <div className="flex justify-between gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Upload Documents ───────────────────────────────────── */}
      {step === 3 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 3: Upload Documents</h2>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              handleFileSelect(e.dataTransfer.files);
            }}
            className={`border-4 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-teal-500 bg-teal-50 scale-[1.01]'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for file upload"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-semibold text-navy-900 mb-1">
              Drag and drop files here
            </p>
            <p className="text-sm text-gray-600 mb-4">
              PDF, images, text, Word docs — max 50 MB each, up to {MAX_FILES} files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-sm"
              type="button"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-navy-900 mb-4">
                Selected Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file, index) => {
                  const isUploaded = uploadedFiles[index];
                  const progress = uploadProgress[index];
                  const error = uploadErrors[index];
                  const isUploading = progress != null && progress < 100 && !error;

                  return (
                    <div
                      key={`${file.name || file.originalName}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        error
                          ? 'bg-rose-50 border border-rose-200'
                          : isUploaded
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">
                          {file.name || file.originalName}
                        </p>
                        {selectedDemoCase && (
                          <p className="text-xs text-amber-700">Demo asset</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size || 0)}
                        </p>

                        {/* Progress bar */}
                        {isUploading && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}

                        {isUploaded && (
                          <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Uploaded
                          </p>
                        )}

                        {error && (
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-xs text-rose-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {error}
                            </p>
                            {caseCreated && (
                              <button
                                onClick={() => retryUpload(index, caseCreated)}
                                className="text-xs text-teal-700 hover:text-teal-900 flex items-center gap-0.5 underline"
                                type="button"
                              >
                                <RotateCcw className="w-3 h-3" /> Retry
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Remove button (only before upload starts) */}
                      {!isUploading && !isUploaded && (
                        <button
                          onClick={() => removeFile(index)}
                          className="ml-4 p-1 hover:bg-gray-200 rounded-sm shrink-0"
                          aria-label={`Remove ${file.name || file.originalName}`}
                          type="button"
                        >
                          <X className="w-5 h-5 text-gray-600" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Success banner */}
          {caseCreated && (
            <div className="mt-8 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-sm flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Case Created Successfully!</p>
                <p className="text-sm text-emerald-700">
                  Case ID:{' '}
                  <code className="bg-white px-2 py-1 rounded-sm font-mono">{caseCreated}</code>
                </p>
                {failedUploads > 0 && (
                  <p className="text-sm text-amber-700 mt-1">
                    {failedUploads} file{failedUploads > 1 ? 's' : ''} failed to upload.
                    Use the retry buttons above, or continue to the pipeline view.
                  </p>
                )}
                {failedUploads > 0 && (
                  <button
                    onClick={() => navigate(`/case/${caseCreated}/building`)}
                    className="mt-2 text-sm text-teal-700 hover:text-teal-900 underline"
                    type="button"
                  >
                    Continue to pipeline →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex justify-between gap-4">
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
              type="button"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || (caseCreated && failedUploads === 0)}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              type="button"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Creating...
                </>
              ) : caseCreated ? (
                'Case Created ✓'
              ) : (
                'Create Case'
              )}
            </button>
          </div>
        </div>
      )}
      </div>
    </AuthContentGate>
  );
}
