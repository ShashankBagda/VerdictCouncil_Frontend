import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  PencilLine,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from '@/components/ai-elements/prompt-input';

import { useAPI } from '@/hooks';
import { createIntakeTransport, transportErrorMessage } from '@/lib/ai/intakeTransport';
import api, { getErrorMessage } from '@/lib/api';

function confidenceTone(level) {
  switch (level) {
    case 'high':
      return 'secondary';
    case 'medium':
      return 'outline';
    case 'low':
    default:
      return 'destructive';
  }
}

export default function CaseIntakeChat() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { showError } = useAPI();

  const [extraction, setExtraction] = useState(null);
  const [streamError, setStreamError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const subscribedCaseRef = useRef(null);

  const handleEvent = useCallback((event) => {
    if (event.type === 'done') {
      setExtraction(event.extraction || null);
      setStreamError(null);
    } else if (event.type === 'error') {
      setStreamError(event.message || 'The extractor failed.');
    }
  }, []);

  const transport = useMemo(
    () =>
      createIntakeTransport({
        caseId,
        onEvent: handleEvent,
        onError: (error) => setStreamError(transportErrorMessage(error)),
      }),
    [caseId, handleEvent],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat({
    id: caseId ? `intake-${caseId}` : 'intake-draft',
    transport,
    onError: (err) => setStreamError(transportErrorMessage(err)),
  });

  useEffect(() => {
    if (!caseId || subscribedCaseRef.current === caseId) {
      return;
    }
    subscribedCaseRef.current = caseId;
    sendMessage();
  }, [caseId, sendMessage]);

  const retryExtraction = async () => {
    setMessages([]);
    setExtraction(null);
    setStreamError(null);
    try {
      await api.triggerIntakeExtraction(caseId);
      await sendMessage();
    } catch (err) {
      setStreamError(getErrorMessage(err) || 'Could not restart extraction.');
    }
  };

  const onSubmitCorrection = async (payload) => {
    const content = (payload?.text || composerValue || '').trim();
    if (!content) return;
    setComposerValue('');
    try {
      await sendMessage({ text: content });
    } catch (err) {
      setStreamError(getErrorMessage(err) || 'Could not send your correction.');
    }
  };

  const isGenerating = status === 'submitted' || status === 'streaming';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Confirm case details</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          I’ve read the documents you uploaded. Review the extracted fields,
          correct anything in plain language, or switch to the form if you’d
          rather fill them in yourself.
        </p>
      </header>

      {streamError && (
        <Alert variant="destructive">
          <AlertTitle>Extraction hit a snag</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{streamError}</span>
            <Button type="button" size="sm" variant="outline" onClick={retryExtraction}>
              <RotateCcw data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Conversation className="max-h-[420px] rounded-lg border bg-card">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles />}
              title="Reading your documents"
              description="The assistant will post updates here."
            />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts?.map((part, index) => {
                    if (part.type !== 'text') return null;
                    const key = `${m.id}-${index}`;
                    if (m.role === 'assistant') {
                      return (
                        <MessageResponse
                          key={key}
                          isAnimating={status === 'streaming' && part.state === 'streaming'}
                        >
                          {part.text}
                        </MessageResponse>
                      );
                    }
                    return <span key={key}>{part.text}</span>;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>

      {extraction && (
        <ProposedFieldsCard
          extraction={extraction}
          caseId={caseId}
          navigate={navigate}
          confirming={confirming}
          setConfirming={setConfirming}
          showError={showError}
          setFallbackOpen={setFallbackOpen}
        />
      )}

      <PromptInput onSubmit={onSubmitCorrection} className="bg-card">
        <PromptInputTextarea
          value={composerValue}
          onChange={(e) => setComposerValue(e.target.value)}
          placeholder={
            extraction
              ? 'Correct something in plain language — e.g. "accused is K. Lam not Lim".'
              : 'Waiting for extraction to finish…'
          }
          disabled={isGenerating}
        />
        <PromptInputFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFallbackOpen((v) => !v)}
          >
            <PencilLine data-icon="inline-start" />
            {fallbackOpen ? 'Hide manual form' : "I'll type it"}
          </Button>
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>

      {fallbackOpen && (
        <ManualFallbackForm
          caseId={caseId}
          initial={extraction?.fields || null}
          confirming={confirming}
          setConfirming={setConfirming}
          navigate={navigate}
          showError={showError}
        />
      )}
    </div>
  );
}

function ProposedFieldsCard({
  extraction,
  caseId,
  navigate,
  confirming,
  setConfirming,
  showError,
  setFallbackOpen,
}) {
  const fields = extraction.fields || {};
  const confidences = extraction.confidences || {};

  const onConfirm = async () => {
    if (!fields.title || (fields.parties || []).length < 2) {
      // Extraction didn't give us enough — push into manual fallback.
      setFallbackOpen(true);
      return;
    }
    setConfirming(true);
    try {
      await api.confirmCaseIntake(caseId, {
        title: fields.title,
        description: fields.description || undefined,
        filed_date: fields.filed_date || undefined,
        parties: fields.parties || [],
        claim_amount: fields.claim_amount ?? undefined,
        offence_code: fields.offence_code || undefined,
        consent_to_higher_claim_limit: false,
      });
      navigate(`/case/${caseId}/building`);
    } catch (err) {
      showError?.(getErrorMessage(err) || 'Could not confirm the case.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed case details</CardTitle>
        <CardDescription>
          Review each field. Confidence is the extractor’s own estimate — use
          it as a hint, not a gate.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <FieldRow label="Case title" value={fields.title} confidence={confidences.title} />
        <FieldRow
          label="Description"
          value={fields.description}
          confidence={confidences.description}
        />
        <FieldRow
          label="Filed date"
          value={fields.filed_date}
          confidence={confidences.filed_date}
        />
        <FieldRow
          label="Parties"
          value={(fields.parties || []).map((p) => `${p.name} (${p.role})`).join(', ')}
          confidence={confidences.parties}
        />
        <FieldRow
          label="Offence code"
          value={fields.offence_code}
          confidence={confidences.offence_code}
        />
        {fields.claim_amount != null && (
          <FieldRow
            label="Claim amount"
            value={`SGD ${fields.claim_amount.toLocaleString()}`}
            confidence={confidences.claim_amount}
          />
        )}
        {extraction.notes && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">{extraction.notes}</p>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setFallbackOpen(true)}>
          <PencilLine data-icon="inline-start" />
          Edit manually
        </Button>
        <Button type="button" onClick={onConfirm} disabled={confirming}>
          {confirming ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Confirming…
            </>
          ) : (
            <>
              <CheckCircle2 data-icon="inline-start" />
              Confirm and continue
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function FieldRow({ label, value, confidence }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate">{value || <span className="italic text-muted-foreground">not found</span>}</p>
      </div>
      {value && confidence && (
        <Badge variant={confidenceTone(confidence)}>{confidence}</Badge>
      )}
    </div>
  );
}

function ManualFallbackForm({
  caseId,
  initial,
  confirming,
  setConfirming,
  navigate,
  showError,
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [filedDate, setFiledDate] = useState(initial?.filed_date || '');
  const [prosecution, setProsecution] = useState(
    initial?.parties?.find((p) => p.role === 'prosecution')?.name || '',
  );
  const [accused, setAccused] = useState(
    initial?.parties?.find((p) => p.role === 'accused')?.name || '',
  );
  const [offenceCode, setOffenceCode] = useState(initial?.offence_code || '');
  const [err, setErr] = useState(null);

  const valid = title.trim() && prosecution.trim() && accused.trim() && offenceCode.trim();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid || confirming) return;
    setConfirming(true);
    setErr(null);
    try {
      await api.confirmCaseIntake(caseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        filed_date: filedDate || undefined,
        offence_code: offenceCode.trim(),
        parties: [
          { name: prosecution.trim(), role: 'prosecution' },
          { name: accused.trim(), role: 'accused' },
        ],
        consent_to_higher_claim_limit: false,
      });
      navigate(`/case/${caseId}/building`);
    } catch (e2) {
      const msg = getErrorMessage(e2) || 'Could not confirm the case.';
      setErr(msg);
      showError?.(msg);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fill in manually</CardTitle>
        <CardDescription>
          Use this if the extractor couldn’t find something, or the matter is
          oral/walk-in with no Notice uploaded.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="mf-title">Case title</FieldLabel>
              <Input
                id="mf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. PP v K. Lim (reckless driving)"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mf-desc">Short description</FieldLabel>
              <Textarea
                id="mf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Speeding at 120 km/h on PIE west-bound, exit 31…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mf-filed">Filed date</FieldLabel>
              <Input
                id="mf-filed"
                type="date"
                value={filedDate}
                onChange={(e) => setFiledDate(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mf-offence">Offence code</FieldLabel>
              <Input
                id="mf-offence"
                value={offenceCode}
                onChange={(e) => setOffenceCode(e.target.value.toUpperCase())}
                placeholder="e.g. S65AA, S67(1)(B)"
              />
              <FieldDescription>
                Free-form — type the section exactly as it appears on the charge.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="mf-pros">Prosecution</FieldLabel>
              <Input
                id="mf-pros"
                value={prosecution}
                onChange={(e) => setProsecution(e.target.value)}
                placeholder="Public Prosecutor"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mf-acc">Accused</FieldLabel>
              <Input
                id="mf-acc"
                value={accused}
                onChange={(e) => setAccused(e.target.value)}
                placeholder="Full name on the NRIC"
              />
            </Field>
          </FieldGroup>
          {err && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Could not confirm</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!valid || confirming}>
            {confirming ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <CheckCircle2 data-icon="inline-start" />
                Confirm with these values
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
