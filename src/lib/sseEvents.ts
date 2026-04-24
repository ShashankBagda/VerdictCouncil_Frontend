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
}

export interface HeartbeatEvent {
  kind: "heartbeat";
  schema_version: 1;
  ts: string;
}

export interface AuthExpiringEvent {
  kind: "auth_expiring";
  schema_version: 1;
  expires_at: string;
}

export type SseEvent = ProgressEvent | AgentEvent | HeartbeatEvent | AuthExpiringEvent;
