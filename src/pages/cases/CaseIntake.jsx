import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useAPI } from '../../hooks';
import api from '../../lib/api';

export default function CaseIntake() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showError, showNotification } = useAPI();

  // Form state
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [offenceCode, setOffenceCode] = useState('');
  
  // File upload state
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseCreated, setCaseCreated] = useState(null);
  const fileInputRef = useRef(null);
  const dragOverRef = useRef(false);

  // Validation
  const isStep1Valid = domain && caseDescription.trim().length > 0;
  const isStep2Valid = plaintiff.trim().length > 0 && defendant.trim().length > 0;
  const isStep3Valid = files.length > 0;

  const canProceedToStep2 = isStep1Valid;
  const canProceedToStep3 = isStep1Valid && isStep2Valid;
  const canSubmit = canProceedToStep3 && isStep3Valid;

  // File handling
  const handleFileSelect = (newFiles) => {
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter(f => {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      if (!validTypes.includes(f.type)) {
        showError(`${f.name}: Invalid file type. Allowed: PDF, images, Word docs`);
        return false;
      }
      if (f.size > maxSize) {
        showError(`${f.name}: File too large. Max 50MB.`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverRef.current = true;
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverRef.current = false;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverRef.current = false;
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      // Step 1: Create case — align with backend CaseCreateRequest schema
      const domainMap = { SCT: 'small_claims', Traffic: 'traffic_violation' };
      const caseData = {
        domain: domainMap[domain] || domain,
        description: caseDescription,
        parties: [plaintiff, defendant].filter(Boolean),
        ...(domain === 'SCT' && { claim_amount: parseFloat(claimAmount) || 0 }),
        ...(domain === 'Traffic' && { offence_code: offenceCode }),
      };

      const createCaseRes = await api.createCase(caseData);
      const newCaseId = createCaseRes.id;
      setCaseCreated(newCaseId);

      // Step 2: Upload documents
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          await api.uploadDocuments(newCaseId, [file], (progress) => {
            setUploadProgress(prev => ({ ...prev, [i]: progress }));
          });
        } catch (err) {
          showError(`Failed to upload ${file.name}`);
        }
      }

      showNotification('Case created successfully! Redirecting...', 'success');
      setTimeout(() => navigate(`/case/${newCaseId}`), 2000);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create case';
      showError(msg);
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

      {/* Stepper */}
      <div className="flex items-center justify-between mb-12">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                s <= step
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s <= step && s < step ? '✓' : s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-1 mx-4 transition-all ${
                  s < step ? 'bg-teal-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Domain & Description */}
      {step === 1 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 1: Case Type</h2>

          {/* Domain Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy-900 mb-3">
              Domain <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {['SCT', 'Traffic'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                    domain === d
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {d === 'SCT' ? 'Small Claims Tribunal (SCT)' : 'Traffic Court'}
                </button>
              ))}
            </div>
          </div>

          {/* Case Description */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Case Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
              placeholder="Briefly describe the case (issues, context, relevant facts)"
              className="input-field h-32"
            />
            <p className="text-xs text-gray-500 mt-1">Min 10 characters</p>
          </div>

          {/* Domain-Specific Field */}
          {domain === 'SCT' ? (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Claim Amount (SGD)
              </label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
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
                onChange={(e) => setOffenceCode(e.target.value)}
                placeholder="e.g., TA1"
                className="input-field"
              />
            </div>
          ) : null}

          {/* Navigation */}
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

      {/* Step 2: Party Details */}
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
                onChange={(e) => setPlaintiff(e.target.value)}
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
                onChange={(e) => setDefendant(e.target.value)}
                placeholder="Full name"
                className="input-field"
              />
            </div>
          </div>

          {/* Navigation */}
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

      {/* Step 3: Document Upload */}
      {step === 3 && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Step 3: Upload Documents</h2>

          {/* Drag-Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-4 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
              dragOverRef.current
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-semibold text-navy-900 mb-1">
              Drag and drop files here
            </p>
            <p className="text-sm text-gray-600 mb-4">
              or click to browse (PDF, images, Word docs)
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
              onChange={(e) => handleFileSelect(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-navy-900 mb-4">
                Selected Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy-900">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadProgress[idx] && (
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-teal-500 h-1 rounded-full transition-all"
                            style={{ width: `${uploadProgress[idx]}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {!uploadProgress[idx] && (
                      <button
                        onClick={() => removeFile(idx)}
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

          {/* Success Message */}
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

          {/* Navigation */}
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
