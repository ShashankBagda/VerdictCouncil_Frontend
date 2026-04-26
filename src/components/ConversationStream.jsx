import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from './ai-elements/message';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import ToolCallChip from './ToolCallChip';

// Q1.10 — chat-style transcript for an agent in conversational streaming
// mode. Reads a single per-agent slice from useAgentStream's
// `agentStreams` (Q1.8): { raw, prose, toolCalls, artifact, failure }.
//
// Layout (top to bottom inside the message bubble):
//   1. prose paragraphs joined from `prose[message_id]` in arrival order
//   2. inline <ToolCallChip>s for every tool_call_delta tool_call_id
//   3. structured-artifact <Card> when present (last-wins per Q1.5)
//   4. <Alert variant="destructive"> when an agent_failed event arrived
//   5. typing indicator while waiting for the first prose token
//
// The component is read-only: input/sending lives in the case-detail
// flow, not here. Auto-scroll-with-user-pause is handled by ai-elements'
// <Conversation> via use-stick-to-bottom.

function joinedProse(prose, raw) {
  // Preserve the message_id arrival order observed on the raw frames so
  // multi-message streams render in the order the model produced them.
  if (!prose) return '';
  const seen = new Set();
  const order = [];
  for (const frame of raw || []) {
    if (frame?.event === 'llm_token' && frame.message_id && !seen.has(frame.message_id)) {
      seen.add(frame.message_id);
      order.push(frame.message_id);
    }
  }
  // Append any message_ids in the prose dict that weren't observed in
  // raw (defensive — should not happen, but handles synthetic test data).
  for (const id of Object.keys(prose)) {
    if (!seen.has(id)) {
      order.push(id);
    }
  }
  return order
    .map((id) => prose[id])
    .filter(Boolean)
    .join('\n\n');
}

function toolCallEntries(toolCalls, raw) {
  if (!toolCalls) return [];
  const seen = new Set();
  const order = [];
  for (const frame of raw || []) {
    if (
      frame?.event === 'tool_call_delta' &&
      frame.tool_call_id &&
      !seen.has(frame.tool_call_id)
    ) {
      seen.add(frame.tool_call_id);
      order.push(frame.tool_call_id);
    }
  }
  for (const id of Object.keys(toolCalls)) {
    if (!seen.has(id)) order.push(id);
  }
  return order.map((id) => ({ id, ...toolCalls[id] }));
}

function TypingIndicator() {
  return (
    <div
      data-testid="conversation-typing-indicator"
      aria-label="Agent is typing"
      className="flex items-center gap-1 py-2"
    >
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:120ms]" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:240ms]" />
    </div>
  );
}

export default function ConversationStream({ agentId, agentLabel, stream }) {
  const safeStream = stream || {};
  const prose = useMemo(
    () => joinedProse(safeStream.prose, safeStream.raw),
    [safeStream.prose, safeStream.raw],
  );
  const toolCalls = useMemo(
    () => toolCallEntries(safeStream.toolCalls, safeStream.raw),
    [safeStream.toolCalls, safeStream.raw],
  );
  const artifact = safeStream.artifact;
  const failure = safeStream.failure;
  const hasProse = prose.length > 0;

  return (
    <Conversation
      aria-label={agentLabel ? `${agentLabel} conversation` : 'Agent conversation'}
      className="h-full"
    >
      <ConversationContent>
        <Message from="assistant" role="article" data-agent={agentId}>
          <MessageContent>
            <header className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {agentLabel || agentId}
            </header>

            {hasProse ? (
              <MessageResponse aria-live="polite">{prose}</MessageResponse>
            ) : (
              !failure && <TypingIndicator />
            )}

            {toolCalls.length > 0 && (
              <div className="flex flex-col gap-1">
                {toolCalls.map((tc) => (
                  <ToolCallChip
                    key={tc.id}
                    name={tc.name}
                    argsDelta={tc.argsDelta}
                    status="streaming"
                  />
                ))}
              </div>
            )}

            {artifact && (
              <Card data-testid="conversation-artifact-card" className="mt-2">
                <CardHeader>
                  <CardTitle className="text-sm">Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap break-words text-xs font-mono text-foreground/90">
                    {JSON.stringify(artifact, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {failure && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="size-4" />
                <AlertTitle>{agentLabel || agentId} failed</AlertTitle>
                <AlertDescription>
                  {failure.errorClass} — see logs for details.
                </AlertDescription>
              </Alert>
            )}
          </MessageContent>
        </Message>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
