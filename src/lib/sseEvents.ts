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
  mlflow_run_id?: string | null;
  mlflow_experiment_id?: string | null;
  // Sprint 2 2.C1.6: W3C OTEL trace id propagated from the API request.
  trace_id?: string | null;
}

export interface AgentEvent {
  kind: "agent";
  schema_version: 1;
  case_id: string;
  agent: string;
  event: "thinking" | "tool_call" | "tool_result" | "llm_response" | "agent_completed";
  content?: string | null;
  tool_name?: string | null;
  args?: Record<string, unknown> | null;
  result?: string | null;
  ts: string;
  trace_id?: string | null;
}

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
