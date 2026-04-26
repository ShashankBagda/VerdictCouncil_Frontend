// Sprint 4 4.C5b.1 — typed gate-resume contract.
//
// Mirrors the backend Pydantic schema at
// `VerdictCouncil_Backend/src/api/schemas/resume.py:ResumePayload`.
// The unified `POST /cases/{id}/respond` endpoint (4.A3.15) consumes this
// shape with `extra="forbid"` — every field combination here must satisfy
// the backend `_check_action_fields` validator.
//
// The split into discriminated members (one per action) lets the React
// panel construct payloads without runtime branching: each gate's
// button click produces exactly one variant, and TypeScript narrows the
// optional fields appropriately.

export type Phase = "intake" | "research" | "synthesis" | "audit";
export type Subagent = "evidence" | "facts" | "witnesses" | "law";
// `audit` excluded: the backend rewinds to a *past* phase, and the audit
// gate is the latest. Sending back to audit is a rerun-audit, not a
// rewind — express that as `{action: "rerun", phase: "audit"}`.
export type SendBackPhase = Exclude<Phase, "audit">;

export interface AdvancePayload {
  action: "advance";
  notes?: string;
}

export interface RerunPayload {
  action: "rerun";
  /** Required for rerun. */
  phase: Phase;
  /** Only valid when `phase === "research"`. */
  subagent?: Subagent;
  /** GraphState slot updates applied atomically with the rerun. */
  field_corrections?: Record<string, unknown>;
  notes?: string;
}

export interface HaltPayload {
  action: "halt";
  notes?: string;
}

export interface SendBackPayload {
  action: "send_back";
  /** Required for send_back. `audit` is excluded — see Phase note above. */
  to_phase: SendBackPhase;
  notes?: string;
}

export type ResumePayload =
  | AdvancePayload
  | RerunPayload
  | HaltPayload
  | SendBackPayload;
