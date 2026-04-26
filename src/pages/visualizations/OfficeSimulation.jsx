import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { Activity, AlertCircle, Play, RefreshCw, WifiOff } from 'lucide-react';
import { useAPI, useCase, usePipelineStatus } from '../../hooks';
import { useAgentStream } from '../../hooks/useAgentStream';
import GateReviewPanel from '../../components/cases/GateReviewPanel';
import api from '../../lib/api';
import { PIPELINE_AGENT_LABELS } from '../../lib/pipelineStatus';
import { formatToolCallArgs } from '../../lib/eventFormatters';
import { OfficeScene } from '../../game/OfficeScene';

const STARTABLE_STATUSES = new Set(['pending', 'ready_for_review', 'failed_retryable']);
const RESTARTABLE_STATUSES = new Set(['failed', 'failed_retryable', 'escalated']);

function currentGateFromStatus(overallStatus) {
  const m = String(overallStatus || '').match(/^awaiting_review_(gate\d)$/);
  return m ? m[1] : null;
}

// ── Transcript entry ─────────────────────────────────────────────────────────

function TranscriptEntry({ ev }) {
  const agent = PIPELINE_AGENT_LABELS[ev.agent] || ev.agent || '';
  const ts = ev.ts
    ? new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  if (ev.kind === 'narration') {
    return (
      <div className="py-1.5 px-3 border-l-2 border-amber-500/50 bg-amber-950/10">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-[10px] text-gray-600">{ts}</span>
          <span className="text-[10px] font-semibold text-amber-400">{agent}</span>
        </div>
        <p className="text-xs text-amber-200 italic leading-relaxed">{ev.content}</p>
      </div>
    );
  }

  if (ev.event === 'tool_call') {
    const summary = formatToolCallArgs(ev.tool_name, ev.args);
    return (
      <div className="py-1 px-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-gray-600">{ts}</span>
        <span className="text-[10px] text-gray-500">{agent}</span>
        <span className="inline-flex items-center gap-1 bg-gray-800/60 border border-gray-700/50 rounded px-1.5 py-0.5 text-[10px] text-gray-300">
          🔧 {ev.tool_name}
          {summary && <span className="text-gray-500 ml-1 truncate max-w-[120px]">{summary}</span>}
        </span>
      </div>
    );
  }

  if (ev.event === 'agent_completed') {
    return (
      <div className="py-1 px-3 flex items-center gap-1.5">
        <span className="text-[10px] text-gray-600">{ts}</span>
        <span className="text-[10px] text-emerald-400">✓ {agent} completed</span>
      </div>
    );
  }

  return null;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OfficeSimulation() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();
  const { updatePipelineStatus } = useCase();

  const gameContainerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const processedRef = useRef({});
  const [gameReady, setGameReady] = useState(false);

  const { events, status: sseStatus } = useAgentStream(caseId);

  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [pipelinePending, setPipelinePending] = useState(false);

  const {
    loading,
    pipelineStatus,
    error,
    isStale,
    isGivenUp,
    retry,
  } = usePipelineStatus(caseId, {
    onStatus: updatePipelineStatus,
    onError: showError,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') retry();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [retry]);

  // ── Mount Phaser ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameContainerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 560,
      backgroundColor: '#111827',
      parent: gameContainerRef.current,
      scene: [OfficeScene],
      scale: { mode: Phaser.Scale.NONE },
    });
    gameRef.current = game;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('OfficeScene');
      if (scene) {
        scene._onFocus = (agentId) => setFocusedAgentId((prev) => (prev === agentId ? null : agentId));
        sceneRef.current = scene;
        setGameReady(true);
      }
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      processedRef.current = {};
      setGameReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pause Phaser when tab is hidden ────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (!gameRef.current) return;
      if (document.visibilityState === 'hidden') {
        gameRef.current.pause();
      } else {
        gameRef.current.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Forward new SSE events to the Phaser scene ─────────────────────────────
  useEffect(() => {
    if (!gameReady || !sceneRef.current) return;
    Object.entries(events).forEach(([agentId, evList]) => {
      const seen = processedRef.current[agentId] || 0;
      evList.slice(seen).forEach((ev) => sceneRef.current.handleStreamEvent(ev));
      processedRef.current[agentId] = evList.length;
    });
  }, [events, gameReady]);

  // ── Transcript: narration + tool_call + agent_completed, sorted by ts ──────
  const transcript = React.useMemo(() => {
    const items = [];
    Object.values(events).forEach((evList) => {
      evList.forEach((ev) => {
        if (ev.kind === 'narration' || ev.event === 'tool_call' || ev.event === 'agent_completed') {
          items.push(ev);
        }
      });
    });
    items.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    return items;
  }, [events]);

  const transcriptEndRef = useRef(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length]);

  // ── Pipeline actions ────────────────────────────────────────────────────────
  const overallStatus = pipelineStatus?.overall_status || '';
  const currentGate = currentGateFromStatus(overallStatus);
  const isStartable = STARTABLE_STATUSES.has(overallStatus);
  const isRestartable = RESTARTABLE_STATUSES.has(overallStatus);

  const handleRunPipeline = useCallback(async () => {
    if (pipelinePending) return;
    try {
      setPipelinePending(true);
      await api.runCase(caseId);
      showNotification('Pipeline started', 'success');
    } catch (err) {
      console.error('Run Pipeline failed', { status: err?.status, detail: err?.detail, payload: err?.payload });
      showError(err?.detail || err?.message || 'Failed to start pipeline');
    } finally {
      setPipelinePending(false);
    }
  }, [caseId, pipelinePending, showError, showNotification]);

  const handleRestartPipeline = useCallback(async () => {
    if (pipelinePending) return;
    try {
      setPipelinePending(true);
      await api.restartPipeline(caseId);
      showNotification('Pipeline restart enqueued', 'success');
    } catch (err) {
      showError(err?.detail || err?.message || 'Failed to restart pipeline');
    } finally {
      setPipelinePending(false);
    }
  }, [caseId, pipelinePending, showError, showNotification]);

  if (loading && !pipelineStatus) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Connecting to pipeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ── Top bar ── */}
      <div className="flex items-center flex-wrap gap-3 bg-gray-900/80 rounded-xl border border-gray-700/50 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <h2 className="text-base font-bold text-white">Agent Office</h2>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs ${sseStatus === 'connected' ? 'text-emerald-400' : 'text-gray-500'}`}>
                {sseStatus === 'connected' ? 'Live' : sseStatus === 'polling' ? 'Polling' : 'Connecting'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">9-agent pipeline · case {caseId.slice(0, 8)}…</p>
        </div>

        {isStartable && (
          <button
            onClick={handleRunPipeline}
            disabled={pipelinePending}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 border border-emerald-700/50 hover:border-emerald-500/60 bg-emerald-900/20 hover:bg-emerald-800/30 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pipelinePending
              ? <span className="w-3 h-3 rounded-full border border-emerald-400 border-t-transparent animate-spin" />
              : <Play className="w-3.5 h-3.5" fill="currentColor" />}
            Run Pipeline
          </button>
        )}
        {isRestartable && (
          <button
            onClick={handleRestartPipeline}
            disabled={pipelinePending}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 border border-rose-700/50 hover:border-rose-500/60 bg-rose-900/20 hover:bg-rose-800/30 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pipelinePending
              ? <span className="w-3 h-3 rounded-full border border-rose-400 border-t-transparent animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Restart Pipeline
          </button>
        )}
        <Link
          to={`/case/${caseId}/building/grid`}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700/40 hover:border-gray-600/60 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
        >
          Grid view
        </Link>
      </div>

      {/* ── Error / stale banners ── */}
      {isGivenUp && (
        <div className="flex items-center justify-between bg-rose-950/60 border border-rose-700/40 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Pipeline polling stopped.
            {error && <span className="text-rose-400 text-xs ml-1">({error})</span>}
          </div>
          <button onClick={retry} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}
      {isStale && !isGivenUp && (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-700/30 rounded-xl px-4 py-2 text-sm text-amber-400">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          Pipeline data may be stale — waiting for next server update.
        </div>
      )}

      {/* ── Gate review panel ── */}
      {currentGate && (
        <GateReviewPanel caseId={caseId} gateName={currentGate} onAdvanced={retry} />
      )}

      {/* ── Office canvas + transcript ── */}
      <div className="flex gap-4 items-start">
        {/* Phaser canvas — decorative, screen-reader-hidden */}
        <div
          ref={gameContainerRef}
          className="flex-shrink-0 rounded-xl overflow-hidden border border-gray-700/50"
          style={{ width: 800, height: 560 }}
          aria-hidden="true"
        />

        {/* Right-side transcript — accessible source of truth */}
        <div
          className="flex-1 min-w-[220px] flex flex-col bg-gray-900/80 rounded-xl border border-gray-700/50 overflow-hidden"
          style={{ height: 560 }}
        >
          <div className="px-4 py-2.5 border-b border-gray-700/50 flex-shrink-0">
            <h3 className="text-sm font-semibold text-white">Agent Transcript</h3>
            <p className="text-[10px] text-gray-500">Narration · tool calls · completions</p>
          </div>

          <div
            className="flex-1 overflow-y-auto divide-y divide-gray-800/40"
            aria-live="polite"
            aria-label="Agent activity transcript"
          >
            {transcript.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-600">
                Waiting for pipeline activity…
              </div>
            ) : (
              transcript.map((ev, i) => <TranscriptEntry key={i} ev={ev} />)
            )}
            <div ref={transcriptEndRef} />
          </div>

          {focusedAgentId && (
            <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-800/40 flex-shrink-0 flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Focus:</span>
              <span className="text-[10px] font-semibold text-teal-400">
                {PIPELINE_AGENT_LABELS[focusedAgentId] || focusedAgentId}
              </span>
              <button
                onClick={() => setFocusedAgentId(null)}
                className="ml-auto text-[10px] text-gray-600 hover:text-gray-400"
              >
                clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
