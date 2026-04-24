// Humanise agent stream events for the Building Simulation renderer.
//
// Events from the backend runner carry raw tool args (dict), tool results
// (JSON-encoded string, clipped to 400 chars server-side), and final LLM
// output (often a structured JSON object the agent emits as its deliverable).
// Dumping those as JSON.stringify produces unreadable blobs in the UI.
// These helpers translate each known shape into a short, glanceable summary.

function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Backend clips tool_result JSON to 400 chars, so the string usually ends
// mid-structure and JSON.parse fails. Recover the top-level string and
// numeric fields that appear before the cut so the UI still shows something
// useful instead of a dumped blob.
function salvageTopLevelKeys(str) {
  if (typeof str !== 'string' || !str.startsWith('{')) return null;
  const out = {};
  const re = /"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*("((?:\\.|[^"\\])*)"|(-?\d+(?:\.\d+)?)|(true|false|null)|(\[)|(\{))/g;
  let m;
  let found = 0;
  while ((m = re.exec(str)) !== null && found < 8) {
    const key = m[1];
    if (m[3] !== undefined) out[key] = m[3];
    else if (m[4] !== undefined) out[key] = Number(m[4]);
    else if (m[5] !== undefined) out[key] = m[5] === 'true' ? true : m[5] === 'false' ? false : null;
    else if (m[6] === '[') out[key] = []; // array present but length unknown — placeholder
    else if (m[7] === '{') out[key] = {};
    found += 1;
  }
  return found > 0 ? out : null;
}

function shortFileId(id) {
  if (!id || typeof id !== 'string') return '';
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}

function clip(str, max = 140) {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ── Tool call formatters (args → human summary) ────────────────────────────
const TOOL_CALL_FORMATTERS = {
  parse_document: (a) => {
    const flags = [];
    if (a?.ocr_enabled) flags.push('ocr');
    if (a?.extract_tables) flags.push('tables');
    const tail = flags.length ? ` · ${flags.join('+')}` : '';
    return `📄 ${shortFileId(a?.file_id) || 'document'}${tail}`;
  },
  cross_reference: (a) => {
    const n = Array.isArray(a?.segments) ? a.segments.length : 0;
    const docs = new Set((a?.segments || []).map((s) => s?.doc_id).filter(Boolean));
    const kind = a?.check_type || 'all';
    return `🔗 ${n} segment${n === 1 ? '' : 's'} from ${docs.size} doc${docs.size === 1 ? '' : 's'} · ${kind}`;
  },
  timeline_construct: (a) => {
    const n = Array.isArray(a?.events) ? a.events.length : 0;
    return `🕒 ${n} event${n === 1 ? '' : 's'}`;
  },
  generate_questions: (a) => {
    const weak = Array.isArray(a?.weaknesses) ? a.weaknesses.length : 0;
    const max = a?.max_questions ?? 5;
    return `❓ ${weak} weakness${weak === 1 ? '' : 'es'} → up to ${max} question${max === 1 ? '' : 's'}`;
  },
  search_precedents: (a) => `⚖️ "${clip(a?.query, 60)}" · ${a?.domain || 'any'}`,
  search_domain_guidance: (a) => `📚 "${clip(a?.query, 60)}"`,
  confidence_calc: (a) => {
    const strengths = Array.isArray(a?.evidence_strengths) ? a.evidence_strengths : [];
    return `📊 ${strengths.length} evidence item${strengths.length === 1 ? '' : 's'}`;
  },
  pipeline_status: () => 'ℹ️ pipeline status',
  delegate_to_agent: (a) => `→ ${a?.target_agent || a?.agent || 'agent'}`,
  retry_failed_agent: (a) => `↻ ${a?.agent || 'agent'}`,
  escalate_case: (a) => `⚠️ escalate: ${clip(a?.reason, 80) || 'no reason given'}`,
  parallel_dispatch: (a) => {
    const n = Array.isArray(a?.agents) ? a.agents.length : 0;
    return `⇉ dispatch ${n} agent${n === 1 ? '' : 's'}`;
  },
  advance_gate: (a) => `✓ advance ${a?.gate || 'gate'}`,
};

export function formatToolCallArgs(toolName, args) {
  const fn = TOOL_CALL_FORMATTERS[toolName];
  if (fn) {
    try {
      const out = fn(args || {});
      if (out) return out;
    } catch {
      // fall through to generic summary
    }
  }
  return genericArgSummary(args);
}

function genericArgSummary(args) {
  if (!args || typeof args !== 'object') return '';
  const keys = Object.keys(args);
  if (keys.length === 0) return '';
  // Pick the most informative 2 keys (prefer strings/numbers over nested objects)
  const scored = keys
    .map((k) => {
      const v = args[k];
      const score =
        typeof v === 'string' ? 3 :
        typeof v === 'number' ? 2 :
        Array.isArray(v) ? 1 :
        v && typeof v === 'object' ? 0 : 1;
      return { k, v, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  return scored
    .map(({ k, v }) => {
      if (Array.isArray(v)) return `${k}=[${v.length}]`;
      if (v && typeof v === 'object') return `${k}={…}`;
      return `${k}=${clip(v, 40)}`;
    })
    .join(' · ');
}

// ── Tool result formatters (JSON-encoded string → human summary) ───────────
const TOOL_RESULT_FORMATTERS = {
  parse_document: (r) => {
    const pages = Array.isArray(r?.pages) ? r.pages.length : 0;
    const tables = Array.isArray(r?.tables) ? r.tables.length : 0;
    const name = r?.filename || shortFileId(r?.file_id) || 'document';
    const bits = [`${pages} page${pages === 1 ? '' : 's'}`];
    if (tables) bits.push(`${tables} table${tables === 1 ? '' : 's'}`);
    return `${name} · ${bits.join(' · ')}`;
  },
  cross_reference: (r) => {
    const c = Array.isArray(r?.contradictions) ? r.contradictions.length : 0;
    const co = Array.isArray(r?.corroborations) ? r.corroborations.length : 0;
    return `${c} contradiction${c === 1 ? '' : 's'} · ${co} corroboration${co === 1 ? '' : 's'}`;
  },
  timeline_construct: (r) => {
    const n = Array.isArray(r?.timeline) ? r.timeline.length : (Array.isArray(r?.events) ? r.events.length : 0);
    return `${n} event${n === 1 ? '' : 's'} ordered`;
  },
  generate_questions: (r) => {
    const qs = Array.isArray(r?.questions) ? r.questions : [];
    return `${qs.length} question${qs.length === 1 ? '' : 's'}`;
  },
  search_precedents: (r) => {
    const hits = Array.isArray(r?.results) ? r.results : Array.isArray(r?.precedents) ? r.precedents : [];
    return `${hits.length} precedent${hits.length === 1 ? '' : 's'}`;
  },
  search_domain_guidance: (r) => {
    const hits = Array.isArray(r?.results) ? r.results : [];
    return `${hits.length} guidance hit${hits.length === 1 ? '' : 's'}`;
  },
  confidence_calc: (r) => {
    const score = r?.confidence_score ?? r?.score;
    return score != null ? `score ${Number(score).toFixed(2)}` : 'calculated';
  },
};

export function formatToolResult(toolName, rawResult) {
  // Result may be an object, a full JSON string, or — most commonly — a JSON
  // string clipped mid-structure at 400 chars by the backend.
  const full = safeParseJson(rawResult);
  if (full && typeof full === 'object') {
    const fn = TOOL_RESULT_FORMATTERS[toolName];
    if (fn) {
      try {
        const out = fn(full);
        if (out) return out;
      } catch {
        // fall through
      }
    }
    return genericArgSummary(full);
  }
  // Parse failed — almost always the 400-char clip landing mid-structure.
  // Surface the string/numeric fields that made it through so the user still
  // sees something meaningful (e.g. the filename) instead of a raw blob.
  const salvaged = salvageTopLevelKeys(rawResult);
  if (salvaged) {
    const pairs = Object.entries(salvaged)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${clip(String(v), 40)}`);
    if (pairs.length > 0) return `${pairs.join(' · ')} (partial)`;
  }
  return clip(typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? ''), 140);
}

// ── Narration formatter ────────────────────────────────────────────────────
// Narration events carry plain natural-language prose. Pass through directly.
export function formatNarration(content) {
  if (!content) return '';
  return String(content);
}

// ── LLM final response formatter ───────────────────────────────────────────
// Each agent emits a final JSON deliverable keyed by its output field.
// We surface the top-level keys and any obvious counts so users see
// "3 evidence items · 2 contradictions" instead of `{"evidence_analysis":{...`.
export function formatLlmResponse(content) {
  if (!content) return '';
  const parsed = safeParseJson(content);
  if (!parsed || typeof parsed !== 'object') {
    // Plain text — just surface it
    return clip(String(content), 240);
  }
  const summary = summariseAgentOutput(parsed);
  if (summary) return summary;
  // Fallback: top-level keys + first scalar values
  const keys = Object.keys(parsed);
  if (keys.length === 0) return '{}';
  return keys.slice(0, 4).map((k) => `${k}: ${shortValue(parsed[k])}`).join(' · ');
}

function shortValue(v) {
  if (v == null) return '—';
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return '{…}';
  return clip(String(v), 40);
}

function summariseAgentOutput(obj) {
  // Evidence analysis
  const ea = obj.evidence_analysis;
  if (ea && typeof ea === 'object') {
    const items = Array.isArray(ea.evidence_items) ? ea.evidence_items.length : 0;
    const contra = Array.isArray(ea.contradictions) ? ea.contradictions.length : 0;
    const corr = Array.isArray(ea.corroborations) ? ea.corroborations.length : 0;
    const bits = [`${items} evidence item${items === 1 ? '' : 's'}`];
    if (contra) bits.push(`${contra} contradiction${contra === 1 ? '' : 's'}`);
    if (corr) bits.push(`${corr} corroboration${corr === 1 ? '' : 's'}`);
    return bits.join(' · ');
  }
  // Fact reconstruction
  const fr = obj.fact_reconstruction;
  if (fr && typeof fr === 'object') {
    const n = Array.isArray(fr.timeline) ? fr.timeline.length : 0;
    return `${n} timeline event${n === 1 ? '' : 's'}`;
  }
  // Witness analysis
  const wa = obj.witness_analysis;
  if (wa && typeof wa === 'object') {
    const n = Array.isArray(wa.witnesses) ? wa.witnesses.length : 0;
    return `${n} witness${n === 1 ? '' : 'es'} assessed`;
  }
  // Legal knowledge
  const lk = obj.legal_knowledge;
  if (lk && typeof lk === 'object') {
    const p = Array.isArray(lk.precedents) ? lk.precedents.length : 0;
    const s = Array.isArray(lk.statutes) ? lk.statutes.length : 0;
    return `${p} precedent${p === 1 ? '' : 's'} · ${s} statute${s === 1 ? '' : 's'}`;
  }
  // Argument construction
  const ac = obj.argument_construction;
  if (ac && typeof ac === 'object') {
    const n = Array.isArray(ac.arguments) ? ac.arguments.length : 0;
    return `${n} argument${n === 1 ? '' : 's'} constructed`;
  }
  // Hearing analysis
  const ha = obj.hearing_analysis;
  if (ha && typeof ha === 'object') {
    const q = Array.isArray(ha.suggested_questions) ? ha.suggested_questions.length : 0;
    return `${q} suggested question${q === 1 ? '' : 's'}`;
  }
  // Complexity routing
  if (obj.complexity_score != null || obj.route != null) {
    const bits = [];
    if (obj.route) bits.push(`route: ${obj.route}`);
    if (obj.complexity_score != null) bits.push(`complexity ${Number(obj.complexity_score).toFixed(2)}`);
    return bits.join(' · ');
  }
  return null;
}
