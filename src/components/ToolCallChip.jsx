import React, { useState } from 'react';
import { Wrench, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Inline tool-call chip for the conversational-mode chat surface (Q1.9).
 *
 * Renders at the position the model called the tool. Args grow as
 * `tool_call_delta` frames arrive (the parent concatenates and passes
 * the running JSON-fragment string in `argsDelta`); the chip itself is
 * stateless about streaming and just reflects what the parent passes.
 *
 * Default collapsed. Click / Enter / Space toggles. Visual palette
 * matches AgentStreamPanel: yellow-400 trigger, gray-900 surround,
 * cyan-400 results, rose-400 errors — no new design tokens.
 */
export default function ToolCallChip({
  name,
  argsDelta = '',
  status = 'streaming',
  result = null,
}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded((e) => !e);
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  const statusIcon =
    status === 'streaming' ? (
      <Loader2
        aria-label="streaming"
        className="w-3.5 h-3.5 text-yellow-400 animate-spin"
      />
    ) : status === 'complete' ? (
      <CheckCircle aria-label="complete" className="w-3.5 h-3.5 text-emerald-400" />
    ) : (
      <AlertCircle aria-label="error" className="w-3.5 h-3.5 text-rose-400" />
    );

  const triggerColor =
    status === 'error'
      ? 'bg-rose-950/60 border-rose-800 text-rose-200'
      : status === 'complete'
        ? 'bg-gray-900 border-gray-700 text-yellow-100'
        : 'bg-gray-900 border-gray-700 text-yellow-200';

  return (
    <span className="inline-flex flex-col items-start gap-1 my-1">
      <button
        type="button"
        onClick={toggle}
        onKeyDown={onKey}
        aria-expanded={expanded}
        data-status={status}
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono ${triggerColor} hover:brightness-110 transition`}
      >
        <Wrench className="w-3.5 h-3.5" />
        <span>{name}</span>
        {statusIcon}
      </button>
      {expanded && (
        <div className="ml-2 pl-3 border-l-2 border-gray-700 text-xs font-mono text-gray-300 space-y-1">
          {argsDelta ? (
            <pre className="whitespace-pre-wrap break-words text-yellow-100/90">
              {argsDelta}
            </pre>
          ) : (
            <p className="italic text-gray-500">(no args yet)</p>
          )}
          {result != null && (
            <pre
              className={`whitespace-pre-wrap break-words ${
                status === 'error' ? 'text-rose-300' : 'text-cyan-300'
              }`}
            >
              {result}
            </pre>
          )}
        </div>
      )}
    </span>
  );
}
