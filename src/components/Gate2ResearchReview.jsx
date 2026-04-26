// Sprint 4 4.C5b.2 — gate2 research review body.
//
// Tabbed view over the four research subagent outputs (evidence /
// facts / witnesses / law). The per-subagent rerun toggles let the
// judge target a specific scope on Re-run; <GateReviewPanel> reads
// `selectedSubagent` via the optional callback and folds it into the
// resume payload as `{action: "rerun", phase: "research", subagent: <X>}`.

import { useState } from 'react';

const TABS = [
  { key: 'evidence', label: 'Evidence', subagent: 'evidence' },
  { key: 'facts', label: 'Facts', subagent: 'facts' },
  { key: 'witnesses', label: 'Witnesses', subagent: 'witnesses' },
  { key: 'law', label: 'Law', subagent: 'law' },
];

export default function Gate2ResearchReview({ phaseOutput, onSelectSubagent }) {
  const research = phaseOutput ?? {};
  const [active, setActive] = useState('evidence');
  const [selectedSubagent, setSelectedSubagent] = useState(null);

  function toggleSubagent(subagent) {
    const next = selectedSubagent === subagent ? null : subagent;
    setSelectedSubagent(next);
    onSelectSubagent?.(next);
  }

  return (
    <div className="space-y-3" data-testid="gate2-research-body">
      <div role="tablist" aria-label="Research subagent outputs" className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => setActive(key)}
            className={
              active === key
                ? 'px-3 py-1.5 text-sm font-medium border-b-2 border-indigo-600 text-indigo-700'
                : 'px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900'
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="text-sm text-slate-700">
        {renderTab(active, research)}
      </div>
      <fieldset className="border-t border-slate-100 pt-3">
        <legend className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          Re-run target
        </legend>
        <div className="flex flex-wrap gap-3">
          {TABS.map(({ subagent, label }) => (
            <label key={subagent} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedSubagent === subagent}
                onChange={() => toggleSubagent(subagent)}
                aria-label={`Rerun ${label}`}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pick at most one. Leave all unchecked to re-run the whole research phase.
        </p>
      </fieldset>
    </div>
  );
}

function renderTab(key, research) {
  if (key === 'evidence') {
    const items = research.evidence?.evidence_items ?? [];
    return (
      <ListSummary
        label="evidence items"
        count={items.length}
        items={items.map((it) => describeItem(it, ['id', 'description']))}
      />
    );
  }
  if (key === 'facts') {
    const facts = research.facts?.facts ?? [];
    return (
      <ListSummary
        label="facts"
        count={facts.length}
        items={facts.map((f) => describeItem(f, ['id', 'text', 'status']))}
      />
    );
  }
  if (key === 'witnesses') {
    const witnesses = research.witnesses?.witnesses ?? [];
    return (
      <ListSummary
        label="witnesses"
        count={witnesses.length}
        items={witnesses.map((w) => describeItem(w, ['name', 'credibility_score']))}
      />
    );
  }
  const rules = research.law?.legal_rules ?? [];
  return (
    <ListSummary
      label="legal rules"
      count={rules.length}
      items={rules.map((r) => describeItem(r, ['statute', 'relevance']))}
    />
  );
}

function ListSummary({ label, count, items }) {
  if (count === 0) {
    return <p className="text-slate-500">No {label} returned.</p>;
  }
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-1">
        {count} {label}
      </div>
      <ul className="list-disc list-inside space-y-0.5">
        {items.slice(0, 8).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
        {items.length > 8 && (
          <li className="text-slate-500">… {items.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}

function describeItem(item, keys) {
  if (typeof item !== 'object' || item === null) return String(item);
  return keys
    .map((k) => item[k])
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v))
    .join(' · ');
}
