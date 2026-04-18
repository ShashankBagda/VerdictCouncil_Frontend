import React, { useRef, useState } from 'react';
import { Upload, X, CheckCircle, Beaker } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { DEMO_CASES } from '../../data/demoCases';
import { buildDemoPipelineStatus } from '../../lib/pipelineStatus';

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

function normalizeCaseId(response) {
  return response?.id || response?.case_id || response?.data?.id || response?.data?.case_id || null;
}

export default function CaseIntake() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showError, showNotification } = useAPI();
  const { selectCase, updatePipelineStatus } = useCase();

  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [offenceCode, setOffenceCode] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseCreated, setCaseCreated] = useState(null);
  const [selectedDemoCase, setSelectedDemoCase] = useState(null);
  const fileInputRef = useRef(null);
  const dragOverRef = useRef(false);

  const isStep1Valid = domain && caseDescription.trim().length > 0;
  const isStep2Valid = plaintiff.trim().length > 0 && defendant.trim().length > 0;
  const isStep3Valid = files.length > 0;

  const canProceedToStep2 = isStep1Valid;
  const canProceedToStep3 = isStep1Valid && isStep2Valid;
  const canSubmit = canProceedToStep3 && isStep3Valid;

  const loadDemoCase = (demo) => {
    if (!DEMO_MODE) {
      showError('Demo mode is disabled for this environment.');
      return;
    }

    setDomain(demo.formState.domain === 'small_claims' ? 'SCT' : 'Traffic');
    setCaseDescription(demo.description);
    setPlaintiff(demo.formState.appellant);
    setDefendant(demo.formState.respondent);
    setClaimAmount(demo.formState.claimAmount || '');
    setOffenceCode(demo.formState.offenceCode || '');
    setFiles(demo.files || []);
    setSelectedDemoCase(demo);
    setUploadErrors({});
    setUploadProgress({});
    setUploadedFiles({});
    setStep(3);
    showNotification(`Loaded demo: ${demo.label}`, 'success');
  };

  const handleFileSelect = (newFiles) => {
    const fileArray = Array.from(newFiles || []);
    setSelectedDemoCase(null);

    const validFiles = fileArray.filter((file) => {
      const maxSize = 50 * 1024 * 1024;

      if (!VALID_FILE_TYPES.includes(file.type)) {
        showError(`${file.name}: Invalid file type. Allowed: PDF, images, text, Word docs.`);
        return false;
      }

      if (file.size > maxSize) {
        showError(`${file.name}: File too large. Max 50MB.`);
        return false;
      }

      return true;
    });

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setUploadErrors({});
    setUploadedFiles({});

    try {
      if (DEMO_MODE && selectedDemoCase) {
        const demoCaseId = `demo-${selectedDemoCase.id}`;
        setCaseCreated(demoCaseId);
        selectCase(demoCaseId);
        updatePipelineStatus(buildDemoPipelineStatus(demoCaseId));
        showNotification('Demo case loaded. Redirecting to pipeline view...', 'success');
        setTimeout(() => navigate(`/case/${demoCaseId}/building`), 800);
        return;
      }

      const domainMap = { SCT: 'small_claims', Traffic: 'traffic_violation' };
      const caseData = {
        domain: domainMap[domain] || domain,
        description: caseDescription,
        parties: [plaintiff, defendant].filter(Boolean),
        ...(domain === 'SCT' && { claim_amount: parseFloat(claimAmount) || 0 }),
        ...(domain === 'Traffic' && { offence_code: offenceCode }),
      };

      const createCaseResponse = await api.createCase(caseData);
      const newCaseId = normalizeCaseId(createCaseResponse);

      if (!newCaseId) {
        throw new Error('Case creation succeeded but no case ID was returned.');
      }

      setCaseCreated(newCaseId);
      selectCase(newCaseId);

      let hasUploadFailure = false;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        try {
          await api.uploadDocuments(newCaseId, [file], (progress) => {
            setUploadProgress((prev) => ({ ...prev, [index]: progress }));
          });
          setUploadedFiles((prev) => ({ ...prev, [index]: true }));
        } catch (error) {
          hasUploadFailure = true;
          setUploadErrors((prev) => ({
            ...prev,
            [index]: getErrorMessage(error, `Failed to upload ${file.name}`),
          }));
        }
      }

      if (hasUploadFailure) {
        showError('Case created, but one or more files failed to upload.');
      } else {
        showNotification('Case created successfully! Redirecting to pipeline...', 'success');
      }

      setTimeout(() => navigate(`/case/${newCaseId}/building`), 1200);
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to create case'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="text-center text-gray-600">Please log in first.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-navy-900 mb-2">New Case Intake</h1>
      <p className="text-gray-600 mb-8">Follow the steps below to register a new case</p>

      <div className="flex items-center justify-between mb-12">
        {[1, 2, 3].map((stepNumber) => (
          <React.Fragment key={stepNumber}>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                stepNumber <= step ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {stepNumber <= step && stepNumber < step ? '✓' : stepNumber}
            </div>
            {stepNumber < 3 && (
              <div
                className={`flex-1 h-1 mx-4 transition-all ${
                  stepNumber < step ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && DEMO_MODE && DEMO_CASES.length > 0 && (
        <div className="card-lg bg-amber-50 border border-amber-200">
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

      {step === 1 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 1: Case Type</h2>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-3">
              Domain <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {['SCT', 'Traffic'].map((option) => (
                <button
                  key={option}
                  onClick={() => setDomain(option)}
                  className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                    domain === option
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {option === 'SCT' ? 'Small Claims Tribunal (SCT)' : 'Traffic Court'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Case Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={caseDescription}
              onChange={(event) => setCaseDescription(event.target.value)}
              placeholder="Briefly describe the case (issues, context, relevant facts)"
              className="input-field h-32"
            />
            <p className="text-xs text-gray-500 mt-1">Min 10 characters</p>
          </div>

          {domain === 'SCT' ? (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Claim Amount (SGD)
              </label>
              <input
                type="number"
                value={claimAmount}
                onChange={(event) => setClaimAmount(event.target.value)}
                placeholder="e.g., 5000"
                className="input-field"
              />
            </div>
          ) : domain === 'Traffic' ? (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Offence Code
              </label>
              <input
                type="text"
                value={offenceCode}
                onChange={(event) => setOffenceCode(event.target.value)}
                placeholder="e.g., TA1"
                className="input-field"
              />
            </div>
          ) : null}

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

      {step === 2 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 2: Party Information</h2>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Plaintiff / Claimant <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={plaintiff}
                onChange={(event) => setPlaintiff(event.target.value)}
                placeholder="Full name"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Defendant / Respondent <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={defendant}
                onChange={(event) => setDefendant(event.target.value)}
                placeholder="Full name"
                className="input-field"
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

      {step === 3 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 3: Upload Documents</h2>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dragOverRef.current = true;
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dragOverRef.current = false;
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dragOverRef.current = false;
              handleFileSelect(event.dataTransfer.files);
            }}
            className={`border-4 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
              dragOverRef.current
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-semibold text-navy-900 mb-1">Drag and drop files here</p>
            <p className="text-sm text-gray-600 mb-4">
              or click to browse (PDF, images, text, Word docs)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-sm"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => handleFileSelect(event.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-navy-900 mb-4">Selected Files ({files.length})</h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name || file.originalName}-${index}`}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy-900">
                        {file.name || file.originalName}
                      </p>
                      {selectedDemoCase && (
                        <p className="text-xs text-amber-700">Demo asset</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {((file.size || 0) / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadProgress[index] ? (
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-teal-500 h-1 rounded-full transition-all"
                            style={{ width: `${uploadProgress[index]}%` }}
                          />
                        </div>
                      ) : null}
                      {uploadedFiles[index] && (
                        <p className="text-xs text-emerald-700 mt-1">Uploaded</p>
                      )}
                      {uploadErrors[index] && (
                        <p className="text-xs text-rose-700 mt-1">{uploadErrors[index]}</p>
                      )}
                    </div>
                    {!uploadProgress[index] && (
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-4 p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="w-5 h-5 text-gray-600" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {caseCreated && (
            <div className="mt-8 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Case Created Successfully!</p>
                <p className="text-sm text-emerald-700">
                  Case ID: <code className="bg-white px-2 py-1 rounded font-mono">{caseCreated}</code>
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between gap-4">
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Creating...
                </>
              ) : (
                'Create Case'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
