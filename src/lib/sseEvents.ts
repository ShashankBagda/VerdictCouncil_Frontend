// Typed discriminated union for all VerdictCouncil SSE event frames.
// Mirrors docs/sse-schema.json (backend source of truth).
// schema_version: 1

export interface ProgressEvent {
  kind: "progress";
  schema_version: 1;
  case_id: string;
  agent: string;
  phase: "started" | "completed" | "failed" | "terminal" | "awaiting_review" | "cancelled";
  step?: number | null;
  total?: number;
  ts: string;
  error?: string | null;
  detail?: Record<string, unknown> | null;
  // Sprint 2 2.C1.6: W3C OTEL trace id propagated from the API request.
  trace_id?: string | null;
}

// Q1.7 — `kind: "agent"` is the umbrella for all fine-grained agent
// telemetry. The legacy classic events plus the four conversational-mode
// events (Q1.2 / Q1.3 / Q1.5) discriminate on the `event` literal so
// consumers narrow safely. Backend source of truth:
// VerdictCouncil_Backend/src/api/schemas/pipeline_events.py.

interface AgentEventBase {
  kind: "agent";
  schema_version: 1;
  case_id: string;
  agent: string;
  ts: string;
  trace_id?: string | null;
}

export type AgentClassicEventName =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "llm_response"
  | "agent_completed";

export interface AgentClassicEvent extends AgentEventBase {
  event: AgentClassicEventName;
  content?: string | null;
  tool_name?: string | null;
  args?: Record<string, unknown> | null;
  result?: string | null;
}

// Q1.2 — terminal failure of an agent's stream after at least one chunk
// was emitted. Consumers render a red error card. PII-safe — only the
// exception class name crosses the boundary.
export interface AgentFailedEvent extends AgentEventBase {
  event: "agent_failed";
  error_class: string;
}

// Q1.3 — coalesced prose delta during conversational streaming. Emitted
// only when the agent's phase is in
// `PIPELINE_CONVERSATIONAL_STREAMING_PHASES`. Concatenate by `message_id`.
export interface LlmTokenEvent extends AgentEventBase {
  event: "llm_token";
  phase: string;
  message_id: string;
  delta: string;
}

// Q1.3 — partial tool-call args streaming. Frontend renders these into
// the inline <ToolCallChip> (Q1.9). Concatenate `args_delta` across
// matching `tool_call_id`s to assemble the JSON args.
export interface ToolCallDeltaEvent extends AgentEventBase {
  event: "tool_call_delta";
  phase: string;
  tool_call_id: string;
  name: string;
  args_delta: string;
}

// Q1.5 — schema-bound artifact emitted at end of conversational
// streaming. Exactly one per phase.
export interface StructuredArtifactEvent extends AgentEventBase {
  event: "structured_artifact";
  phase: string;
  artifact: Record<string, unknown>;
}

export type AgentEvent =
  | AgentClassicEvent
  | AgentFailedEvent
  | LlmTokenEvent
  | ToolCallDeltaEvent
  | StructuredArtifactEvent;

export interface HeartbeatEvent {
  kind: "heartbeat";
  schema_version: 1;
  ts: string;
  trace_id?: string | null;
}

export interface AuthExpiringEvent {
  kind: "auth_expiring";
  schema_version: 1;
  expires_at: string;
}

// Sprint 4 4.A3.7 / 4.A3.8 — gate-pause interrupt frame.
//
// Emitted by the backend's `publish_interrupt(...)` whenever the LangGraph
// pipeline pauses at one of the four review gates. The frontend mounts the
// matching `<GateReviewPanel gate=N>` (4.C5b) on receipt and POSTs the
// judge's response to `/cases/{id}/respond` (4.A3.15).
//
// Mirrors the backend Pydantic schema at
// `VerdictCouncil_Backend/src/api/schemas/pipeline_events.py:InterruptEvent`.

export type GateName = "gate1" | "gate2" | "gate3" | "gate4";

export type ResumeAction = "advance" | "rerun" | "halt" | "send_back";

export interface InterruptEvent {
  kind: "interrupt";
  schema_version: 1;
  case_id: string;
  gate: GateName;
  // The set of actions valid at this gate. Gate 4 omits "advance" (the
  // judge records a decision instead) and the apply-node-handled set
  // (advance/rerun/halt) is always present; "send_back" is short-
  // circuited at the API layer for gate4 only.
  actions: ResumeAction[];
  // Per-gate phase output snapshot the panel renders without an extra
  // fetch — IntakeOutput / ResearchOutput / SynthesisOutput / AuditOutput
  // shape varies by gate, so this stays a generic dict at the SSE
  // boundary; the panel narrows the type before consumption.
  phase_output?: Record<string, unknown> | null;
  // Gate 4 only — surfaces auditor `recommend_send_back` so the panel
  // can render a "Send back to ▼ <phase>" dropdown without re-fetching
  // the full audit output.
  audit_summary?: Record<string, unknown> | null;
  trace_id?: string | null;
  ts: string;
}

export type SseEvent =
  | ProgressEvent
  | AgentEvent
  | HeartbeatEvent
  | AuthExpiringEvent
  | InterruptEvent;
