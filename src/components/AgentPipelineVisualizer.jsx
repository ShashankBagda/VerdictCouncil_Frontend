import React, { useEffect, useState } from 'react';
import {
  FileSearch,
  Microscope,
  BookOpen,
  Users,
  MessageSquare,
  Gavel,
  Shield,
  GitBranch,
  BarChart3,
} from 'lucide-react';

const AGENTS = [
  { id: 'case-intake', label: 'Case Intake', short: 'Intake', icon: FileSearch, color: '#06b6d4', glow: 'rgba(6,182,212,0.6)' },
  { id: 'evidence-analysis', label: 'Evidence Analysis', short: 'Evidence', icon: Microscope, color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)' },
  { id: 'fact-reconstruction', label: 'Fact Reconstruction', short: 'Facts', icon: BookOpen, color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  { id: 'witness-analysis', label: 'Witness Analysis', short: 'Witnesses', icon: Users, color: '#10b981', glow: 'rgba(16,185,129,0.6)' },
  { id: 'legal-knowledge', label: 'Legal Knowledge', short: 'Legal', icon: BookOpen, color: '#3b82f6', glow: 'rgba(59,130,246,0.6)' },
  { id: 'argument-construction', label: 'Argument Builder', short: 'Arguments', icon: MessageSquare, color: '#ec4899', glow: 'rgba(236,72,153,0.6)' },
  { id: 'hearing-analysis', label: 'Hearing Analysis', short: 'Hearing', icon: BarChart3, color: '#f97316', glow: 'rgba(249,115,22,0.6)' },
  { id: 'governance-verdict', label: 'Governance Verdict', short: 'Verdict', icon: Gavel, color: '#06b6d4', glow: 'rgba(6,182,212,0.6)' },
  { id: 'complexity-routing', label: 'Complexity Router', short: 'Router', icon: GitBranch, color: '#a78bfa', glow: 'rgba(167,139,250,0.6)' },
];

const STATUS_CONFIG = {
  completed: { ring: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Done', dot: '#10b981' },
  in_progress: { ring: '#06b6d4', bg: 'rgba(6,182,212,0.15)', label: 'Active', dot: '#06b6d4' },
  pending: { ring: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.04)', label: 'Pending', dot: '#4b5563' },
  failed: { ring: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Failed', dot: '#ef4444' },
};

function getAgentStatus(agentId, pipelineAgents) {
  if (!pipelineAgents) return 'pending';
  const found = pipelineAgents.find((a) => a.agent_id === agentId || a.name === agentId);
  if (!found) return 'pending';
  if (found.status === 'completed' || found.completed_at) return 'completed';
  if (found.status === 'failed') return 'failed';
  if (found.status === 'in_progress' || found.started_at) return 'in_progress';
  return 'pending';
}

/**
 * AgentPipelineVisualizer
 * Renders 9 agents in a responsive grid with glow/pulse animations.
 * Props:
 *   pipelineAgents – array of agent status objects from the API (optional)
 *   compact       – render smaller version for dashboard widget
 */
export default function AgentPipelineVisualizer({ pipelineAgents = null, compact = false }) {
  const [_tick, setTick] = useState(0);

  // Re-render every 2s to keep "active" glow pulsing
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const completedCount = AGENTS.filter(
    (a) => getAgentStatus(a.id, pipelineAgents) === 'completed'
  ).length;

  const activeCount = AGENTS.filter(
    (a) => getAgentStatus(a.id, pipelineAgents) === 'in_progress'
  ).length;

  return (
    <div className="w-full">
      {/* Header row */}
      {!compact && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-navy-900">9-Agent AI Pipeline</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Multi-agent judicial analysis system
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-gray-600">{completedCount} Done</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-gray-600">{activeCount} Active</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-gray-600">{AGENTS.length - completedCount - activeCount} Pending</span>
            </span>
          </div>
        </div>
      )}

      {/* Pipeline progress bar */}
      {!compact && pipelineAgents && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Pipeline Progress</span>
            <span className="font-semibold text-teal-600">
              {Math.round((completedCount / AGENTS.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(completedCount / AGENTS.length) * 100}%`,
                background: 'linear-gradient(90deg, #06b6d4 0%, #8b5cf6 100%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Agent grid */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9' : 'grid-cols-3 sm:grid-cols-5 xl:grid-cols-9'}`}>
        {AGENTS.map((agent, idx) => {
          const status = getAgentStatus(agent.id, pipelineAgents);
          const cfg = STATUS_CONFIG[status];
          const Icon = agent.icon;
          const isActive = status === 'in_progress';
          const isDone = status === 'completed';

          return (
            <div
              key={agent.id}
              title={agent.label}
              className="relative flex flex-col items-center gap-2 p-3 rounded-2xl cursor-default select-none transition-all duration-300"
              style={{
                background: isDone
                  ? `linear-gradient(135deg, ${agent.color}15 0%, ${agent.color}08 100%)`
                  : cfg.bg,
                border: `1.5px solid ${isDone ? agent.color + '50' : cfg.ring}`,
                boxShadow: isActive
                  ? `0 0 16px ${agent.glow}, 0 0 32px ${agent.glow.replace('0.6', '0.25')}`
                  : isDone
                    ? `0 2px 12px ${agent.color}20`
                    : 'none',
                animationDelay: `${idx * 0.08}s`,
              }}
            >
              {/* Pulse ring for active agents */}
              {isActive && (
                <div
                  className="absolute inset-0 rounded-2xl animate-ping-slow"
                  style={{
                    border: `2px solid ${agent.glow}`,
                    animationDuration: '2s',
                  }}
                />
              )}

              {/* Icon */}
              <div
                className="relative w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: isDone
                    ? `linear-gradient(135deg, ${agent.color}30 0%, ${agent.color}18 100%)`
                    : isActive
                      ? `linear-gradient(135deg, ${agent.color}40 0%, ${agent.color}25 100%)`
                      : 'rgba(255,255,255,0.04)',
                }}
              >
                <Icon
                  size={compact ? 14 : 16}
                  style={{
                    color: isDone || isActive ? agent.color : '#6b7280',
                    transition: 'color 0.3s',
                  }}
                />
              </div>

              {/* Label */}
              {!compact && (
                <span
                  className="text-[10px] font-semibold text-center leading-tight"
                  style={{ color: isDone || isActive ? '#e2e8f0' : '#9ca3af' }}
                >
                  {agent.short}
                </span>
              )}

              {/* Status dot */}
              <div
                className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
                style={{ background: cfg.dot }}
              />
            </div>
          );
        })}
      </div>

      {/* Connection lines (decorative) */}
      {!compact && (
        <div className="flex items-center justify-center mt-4 gap-0.5">
          {AGENTS.map((agent, idx) => {
            if (idx === AGENTS.length - 1) return null;
            const status = getAgentStatus(agent.id, pipelineAgents);
            const isDone = status === 'completed';
            return (
              <React.Fragment key={`conn-${idx}`}>
                <div
                  className="h-0.5 flex-1 rounded-full transition-all duration-700"
                  style={{
                    background: isDone
                      ? `linear-gradient(90deg, ${agent.color}80, ${AGENTS[idx + 1].color}80)`
                      : 'rgba(255,255,255,0.06)',
                  }}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
