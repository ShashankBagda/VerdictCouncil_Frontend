import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';

import { useAPI } from '@/hooks';
import api, { getErrorMessage } from '@/lib/api';
import DocumentSlotGrid, { SLOT_SCHEMA, REQUIRED_GROUP_HINTS } from '@/components/DocumentSlotGrid';

const DEFAULT_DOMAIN_CODE = 'traffic_violation';

function normalizeCaseId(response) {
  return (
    response?.id ||
    response?.case_id ||
    response?.data?.id ||
    response?.data?.case_id ||
    null
  );
}

export default function CaseIntake() {
  const navigate = useNavigate();
  const { showError } = useAPI();

  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [selectedDomainCode, setSelectedDomainCode] = useState(DEFAULT_DOMAIN_CODE);

  // Keyed by DocumentKind value (e.g. "notice_of_traffic_offence" → [File, ...])
  const [filesByKind, setFilesByKind] = useState({});
  const [progressByKind, setProgressByKind] = useState({});
  const [errorByKind, setErrorByKind] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    api
      .listDomains()
      .then((list) => {
        const arr = Array.isArray(list) ? list : list?.items || [];
        setDomains(arr);
      })
      .catch(() => setDomains([]))
      .finally(() => setDomainsLoading(false));
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.code === selectedDomainCode) || null,
    [domains, selectedDomainCode],
  );

  // Does the judge have enough to advance? Two kinds of requirements:
  //   1. `required: true` — the slot must have a file.
  //   2. `requiredGroup: <name>` — at least one slot in the group must
  //      have a file (any one satisfies the group).
  // Domains without a schema (e.g. small_claims for now) fall back to
  // the legacy form.
  const slots = SLOT_SCHEMA[selectedDomainCode] || [];
  const hasSchema = slots.length > 0;
  const slotHasFile = (s) => (filesByKind[s.kind] || []).length > 0;
  const requiredSlotsFilled = slots.filter((s) => s.required).every(slotHasFile);
  const requiredGroups = [...new Set(slots.map((s) => s.requiredGroup).filter(Boolean))];
  const unsatisfiedGroups = requiredGroups.filter(
    (group) => !slots.filter((s) => s.requiredGroup === group).some(slotHasFile),
  );
  const canContinue =
    hasSchema && requiredSlotsFilled && unsatisfiedGroups.length === 0 && !submitting;

  const handleSlotFiles = (kind, newFiles) => {
    setFilesByKind((prev) => {
      const existing = prev[kind] || [];
      const slot = slots.find((s) => s.kind === kind);
      const combined = slot?.multi ? [...existing, ...newFiles] : [newFiles[0]];
      return { ...prev, [kind]: combined };
    });
    setErrorByKind((prev) => ({ ...prev, [kind]: null }));
  };

  const handleSlotRemove = (kind, idx) => {
    setFilesByKind((prev) => {
      const existing = prev[kind] || [];
      const next = existing.filter((_, i) => i !== idx);
      if (next.length === 0) {
        const { [kind]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [kind]: next };
    });
  };

  const handleContinue = async () => {
    if (!selectedDomain) {
      setSubmitError('Select a case type first.');
      return;
    }
    if (!hasSchema) {
      // Small-claims: keep using the legacy form. We could inline it here
      // or route to an old component — for now, surface the limitation.
      setSubmitError(
        'Small-claims intake still uses the classic form. Support for docs-first intake is coming.',
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const draft = await api.createCaseDraft({ domain_id: selectedDomain.id });
      const caseId = normalizeCaseId(draft);
      if (!caseId) throw new Error('Draft created but no case id returned.');

      // Flatten all slot files into one upload call, keeping kind order aligned.
      const allFiles = [];
      const allKinds = [];
      for (const slot of slots) {
        const filesForSlot = filesByKind[slot.kind] || [];
        for (const f of filesForSlot) {
          allFiles.push(f);
          allKinds.push(slot.kind);
        }
      }

      await api.uploadDocuments(
        caseId,
        allFiles,
        (pct) => {
          // We don't get per-file progress from the backend; distribute equally.
          const updated = {};
          for (const kind of new Set(allKinds)) updated[kind] = pct;
          setProgressByKind(updated);
        },
        allKinds,
      );

      // Upload of any authoritative kind (notice/charge sheet) auto-enqueues
      // extraction on the backend. The confirm page subscribes to the SSE.
      navigate(`/cases/intake/${caseId}/confirm`);
    } catch (err) {
      const msg = getErrorMessage(err) || 'Could not start intake.';
      setSubmitError(msg);
      showError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New case intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the case type, upload the filed documents, and the assistant will
          read them and propose the case details for you to confirm.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Case type</h2>
        {domainsLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : (
          <ToggleGroup
            type="single"
            value={selectedDomainCode}
            onValueChange={(v) => v && setSelectedDomainCode(v)}
            className="justify-start"
          >
            {domains.map((d) => (
              <ToggleGroupItem key={d.id} value={d.code} className="capitalize">
                {d.name || d.code.replaceAll('_', ' ')}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Documents</h2>
          <p className="text-xs text-muted-foreground">
            Drop in the filed documents; required slots are marked.
          </p>
        </div>
        <DocumentSlotGrid
          domain={selectedDomainCode}
          filesByKind={filesByKind}
          progressByKind={progressByKind}
          errorByKind={errorByKind}
          onFiles={handleSlotFiles}
          onRemove={handleSlotRemove}
          disabled={submitting}
        />
        {unsatisfiedGroups.length > 0 && (
          <ul className="text-xs text-muted-foreground">
            {unsatisfiedGroups.map((group) => (
              <li key={group}>{REQUIRED_GROUP_HINTS[group] || `Required: ${group}`}</li>
            ))}
          </ul>
        )}
      </section>

      {!hasSchema && !domainsLoading && (
        <Alert>
          <Info data-icon="inline-start" />
          <AlertTitle>Classic intake</AlertTitle>
          <AlertDescription>
            Typed-slot intake is only wired up for Road Traffic Act matters
            right now. Small-claims uses the legacy form until we ingest the
            Small Claims Tribunals Act into its own knowledge base.
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>Could not start intake</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate('/cases')}>
          Cancel
        </Button>
        <Button type="button" onClick={handleContinue} disabled={!canContinue}>
          {submitting ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              Continue to confirm
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
