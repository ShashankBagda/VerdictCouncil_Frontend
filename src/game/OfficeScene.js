/**
 * OfficeScene — Phaser 3 pixel-art office for VerdictCouncil agent visualization.
 *
 * Renders 9 agent "characters" at desks grouped into four department zones.
 * Agent state drives sprite animations and emote bubbles; narration text appears
 * above the active character's head.
 *
 * No external assets. All graphics are drawn procedurally via Phaser Graphics/Text.
 * Replace with sprite sheets for production-quality visuals.
 *
 * Department layout (top-down view):
 *   ┌────────────────────┬────────────────────┐
 *   │  INTAKE (violet)   │  EVIDENCE (teal)   │
 *   │  case-processing   │  evidence-analysis  │
 *   │  complexity-routing│  fact-reconstruct.  │
 *   │                    │  witness-analysis   │
 *   ├────────────────────┼────────────────────┤
 *   │  LEGAL (blue)      │  DECISION (amber)  │
 *   │  legal-knowledge   │  hearing-analysis  │
 *   │  argument-const.   │  hearing-governance│
 *   └────────────────────┴────────────────────┘
 */

import Phaser from 'phaser';

// ── Layout constants ────────────────────────────────────────────────────────
const W = 800;
const H = 560;
const HALF_W = W / 2;
const HALF_H = H / 2;

// Department zone bounds [x, y, w, h]
const ZONES = {
  Intake:   { x: 0,      y: 0,      w: HALF_W - 2, h: HALF_H - 2 },
  Evidence: { x: HALF_W + 2, y: 0,      w: HALF_W - 2, h: HALF_H - 2 },
  Legal:    { x: 0,      y: HALF_H + 2, w: HALF_W - 2, h: HALF_H - 2 },
  Decision: { x: HALF_W + 2, y: HALF_H + 2, w: HALF_W - 2, h: HALF_H - 2 },
};

// Zone fill colours (dark, subtle)
const ZONE_FILL = {
  Intake:   0x2d1b4e,
  Evidence: 0x0f3d3a,
  Legal:    0x0d2a4a,
  Decision: 0x3d2a00,
};
const ZONE_BORDER = {
  Intake:   0x7c3aed,
  Evidence: 0x0d9488,
  Legal:    0x2563eb,
  Decision: 0xd97706,
};
const ZONE_LABEL_COLOR = {
  Intake:   '#a78bfa',
  Evidence: '#2dd4bf',
  Legal:    '#60a5fa',
  Decision: '#fbbf24',
};

// Character body colours by layer
const CHAR_COLOR = {
  Intake:   0x8b5cf6,
  Evidence: 0x14b8a6,
  Legal:    0x3b82f6,
  Decision: 0xf59e0b,
};

// Agent → department
const AGENT_LAYER = {
  'case-processing':       'Intake',
  'complexity-routing':    'Intake',
  'evidence-analysis':     'Evidence',
  'fact-reconstruction':   'Evidence',
  'witness-analysis':      'Evidence',
  'legal-knowledge':       'Legal',
  'argument-construction': 'Legal',
  'hearing-analysis':      'Decision',
  'hearing-governance':    'Decision',
};

// Short display names for the character labels
const AGENT_LABEL = {
  'case-processing':       'Case\nProcess.',
  'complexity-routing':    'Complexity\nRoute.',
  'evidence-analysis':     'Evidence\nAnalysis',
  'fact-reconstruction':   'Fact\nReconstr.',
  'witness-analysis':      'Witness\nAnalysis',
  'legal-knowledge':       'Legal\nKnowledge',
  'argument-construction': 'Argument\nConstr.',
  'hearing-analysis':      'Hearing\nAnalysis',
  'hearing-governance':    'Hearing\nGovern.',
};

// Desk positions within each zone (relative to zone top-left, normalised 0-1)
const ZONE_DESK_POSITIONS = {
  Intake:   [[0.3, 0.38], [0.7, 0.38]],
  Evidence: [[0.2, 0.3],  [0.6, 0.3],  [0.4, 0.72]],
  Legal:    [[0.3, 0.38], [0.7, 0.38]],
  Decision: [[0.3, 0.38], [0.7, 0.38]],
};

// Agent order within each zone
const ZONE_AGENTS = {
  Intake:   ['case-processing', 'complexity-routing'],
  Evidence: ['evidence-analysis', 'fact-reconstruction', 'witness-analysis'],
  Legal:    ['legal-knowledge', 'argument-construction'],
  Decision: ['hearing-analysis', 'hearing-governance'],
};

// Tool name → emote label
const TOOL_EMOTE = {
  parse_document:        '📄',
  cross_reference:       '🔗',
  search_precedents:     '⚖️',
  search_domain_guidance:'📚',
  timeline_construct:    '🕒',
  generate_questions:    '❓',
  confidence_calc:       '📊',
};

// ── Phaser Scene ────────────────────────────────────────────────────────────
export class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OfficeScene' });
    this._agents = {};       // agentId → { sprite, desk, nameText, bubbleGroup, layer }
    this._bubbleTimers = {};  // agentId → Phaser.Time.TimerEvent
    this._focusedAgent = null;
    this._onFocus = null;    // external focus callback
  }

  /** Called by React wrapper to wire in the SSE event stream and focus cb. */
  init(data) {
    this._onFocus = data?.onFocus || null;
  }

  create() {
    this._drawFloor();
    this._drawZones();
    this._spawnAgents();
    this._startIdleAnimations();
  }

  // ── Floor ─────────────────────────────────────────────────────────────────

  _drawFloor() {
    const g = this.add.graphics();
    // Dark floor
    g.fillStyle(0x111827, 1);
    g.fillRect(0, 0, W, H);
    // Subtle pixel grid
    g.lineStyle(1, 0x1f2937, 0.6);
    for (let x = 0; x < W; x += 16) {
      g.lineBetween(x, 0, x, H);
    }
    for (let y = 0; y < H; y += 16) {
      g.lineBetween(0, y, W, y);
    }
    // Zone dividers
    g.lineStyle(2, 0x374151, 1);
    g.lineBetween(HALF_W, 0, HALF_W, H);
    g.lineBetween(0, HALF_H, W, HALF_H);
  }

  _drawZones() {
    Object.entries(ZONES).forEach(([name, z]) => {
      const g = this.add.graphics();
      g.fillStyle(ZONE_FILL[name], 0.45);
      g.fillRect(z.x + 4, z.y + 4, z.w - 8, z.h - 8);
      g.lineStyle(1, ZONE_BORDER[name], 0.5);
      g.strokeRect(z.x + 4, z.y + 4, z.w - 8, z.h - 8);

      // Zone label (top-left corner)
      this.add.text(z.x + 12, z.y + 8, name.toUpperCase(), {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: ZONE_LABEL_COLOR[name],
        alpha: 0.7,
      });
    });
  }

  // ── Agent sprites ──────────────────────────────────────────────────────────

  _spawnAgents() {
    Object.entries(ZONE_AGENTS).forEach(([layer, agents]) => {
      const zone = ZONES[layer];
      const positions = ZONE_DESK_POSITIONS[layer];
      agents.forEach((agentId, idx) => {
        const [rx, ry] = positions[idx];
        const ax = zone.x + zone.w * rx;
        const ay = zone.y + zone.h * ry;
        this._spawnAgent(agentId, layer, ax, ay);
      });
    });
  }

  _spawnAgent(agentId, layer, x, y) {
    // Desk rectangle
    const deskG = this.add.graphics();
    const deskColor = ZONE_BORDER[layer];
    deskG.fillStyle(deskColor, 0.25);
    deskG.fillRect(x - 22, y + 8, 44, 18);
    deskG.lineStyle(1, deskColor, 0.6);
    deskG.strokeRect(x - 22, y + 8, 44, 18);

    // Character body — pixel-art humanoid (head + body via graphics)
    const charG = this.add.graphics();
    const col = CHAR_COLOR[layer];
    charG.fillStyle(col, 1);
    // Body
    charG.fillRect(x - 6, y - 8, 12, 14);
    // Head
    charG.fillStyle(0xfde68a, 1);
    charG.fillCircle(x, y - 14, 7);
    // Eyes
    charG.fillStyle(0x1f2937, 1);
    charG.fillCircle(x - 2, y - 15, 1);
    charG.fillCircle(x + 2, y - 15, 1);

    charG.setInteractive(new Phaser.Geom.Rectangle(x - 12, y - 22, 24, 32), Phaser.Geom.Rectangle.Contains);
    charG.on('pointerover', () => charG.setAlpha(0.8));
    charG.on('pointerout', () => charG.setAlpha(1));
    charG.on('pointerdown', () => {
      this._focusedAgent = this._focusedAgent === agentId ? null : agentId;
      this._onFocus?.(this._focusedAgent);
    });

    // Name label below the desk
    const nameText = this.add.text(x, y + 30, AGENT_LABEL[agentId] || agentId, {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: ZONE_LABEL_COLOR[layer],
      align: 'center',
      lineSpacing: 1,
    }).setOrigin(0.5, 0);

    // Status dot (top of character)
    const dotG = this.add.graphics();
    dotG.fillStyle(0x4b5563, 1);
    dotG.fillCircle(x + 10, y - 22, 3);

    // Bubble group (emote + narration — hidden by default)
    const bubbleGroup = this.add.group();

    this._agents[agentId] = { charG, dotG, nameText, bubbleGroup, x, y, layer, status: 'pending' };
  }

  // ── Idle animations ────────────────────────────────────────────────────────

  _startIdleAnimations() {
    // Gentle bobbing tween for each character at a slightly different phase
    Object.entries(this._agents).forEach(([agentId, a], i) => {
      this.tweens.add({
        targets: a.charG,
        y: '+=2',
        duration: 1200 + i * 80,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    });
  }

  // ── External event API ─────────────────────────────────────────────────────

  /** Drive agent state from a stream event object. */
  handleStreamEvent(ev) {
    if (!ev?.agent) return;
    const agent = this._agents[ev.agent];
    if (!agent) return;

    const kind = ev.kind || 'agent';
    const phase = ev.phase || ev.event;

    if (kind === 'progress') {
      switch (phase) {
        case 'started':    this._setStatus(ev.agent, 'running'); break;
        case 'completed':  this._setStatus(ev.agent, 'completed'); break;
        case 'failed':     this._setStatus(ev.agent, 'failed'); break;
        default: break;
      }
    }

    if (kind === 'agent') {
      if (phase === 'tool_call') {
        const emote = TOOL_EMOTE[ev.tool_name] || '🔧';
        this._showBubble(ev.agent, emote, 1200);
        this._walkToProp(ev.agent);
      }
    }

    if (kind === 'narration' && ev.content) {
      this._showNarration(ev.agent, ev.content);
    }
  }

  _setStatus(agentId, status) {
    const a = this._agents[agentId];
    if (!a) return;
    a.status = status;

    // Update status dot colour
    a.dotG.clear();
    const dotColors = { running: 0x60a5fa, completed: 0x34d399, failed: 0xf87171, pending: 0x4b5563 };
    const col = dotColors[status] ?? 0x4b5563;
    a.dotG.fillStyle(col, 1);
    a.dotG.fillCircle(a.x + 10, a.y - 22, 3);

    // Running: typing animation + tween speed up
    if (status === 'running') {
      this._startTypingAnimation(agentId);
    }
    if (status === 'completed') {
      this._stopTypingAnimation(agentId);
      this._showBubble(agentId, '✓', 2000);
      this._celebrate(agentId);
    }
    if (status === 'failed') {
      this._stopTypingAnimation(agentId);
      this._showBubble(agentId, '✗', 2000);
    }
  }

  _startTypingAnimation(agentId) {
    const a = this._agents[agentId];
    if (!a) return;
    // Speed up the idle tween
    this.tweens.killTweensOf(a.charG);
    this.tweens.add({
      targets: a.charG,
      y: '-=1',
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    // Flashing typing indicator
    a._typingDot = this.add.text(a.x + 12, a.y - 20, '...', {
      fontSize: '8px',
      color: '#60a5fa',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);
    this.tweens.add({
      targets: a._typingDot,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  _stopTypingAnimation(agentId) {
    const a = this._agents[agentId];
    if (!a) return;
    if (a._typingDot) {
      this.tweens.killTweensOf(a._typingDot);
      a._typingDot.destroy();
      a._typingDot = null;
    }
    this.tweens.killTweensOf(a.charG);
    // Restore normal idle
    this.tweens.add({
      targets: a.charG,
      y: '+=2',
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  _walkToProp(agentId) {
    const a = this._agents[agentId];
    if (!a) return;
    const origX = a.x;
    this.tweens.killTweensOf(a.charG);
    this.tweens.chain({
      targets: a.charG,
      tweens: [
        { x: origX + 18, duration: 300, ease: 'Linear' },
        { x: origX, duration: 300, ease: 'Linear', delay: 500 },
      ],
    });
  }

  _celebrate(agentId) {
    const a = this._agents[agentId];
    if (!a) return;
    this.tweens.add({
      targets: a.charG,
      y: '-=8',
      duration: 200,
      ease: 'Bounce.easeOut',
      yoyo: true,
      repeat: 2,
    });
  }

  _showBubble(agentId, text, duration = 1500) {
    const a = this._agents[agentId];
    if (!a) return;
    if (this._bubbleTimers[agentId]) {
      this._bubbleTimers[agentId].remove();
    }
    a.bubbleGroup.clear(true, true);

    const bx = a.x;
    const by = a.y - 34;

    const bg = this.add.graphics();
    bg.fillStyle(0x1f2937, 0.9);
    bg.fillRoundedRect(bx - 12, by - 12, 24, 18, 4);
    bg.lineStyle(1, ZONE_BORDER[a.layer], 0.8);
    bg.strokeRoundedRect(bx - 12, by - 12, 24, 18, 4);

    const t = this.add.text(bx, by - 3, text, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#f3f4f6',
    }).setOrigin(0.5, 0.5);

    a.bubbleGroup.addMultiple([bg, t]);

    this._bubbleTimers[agentId] = this.time.delayedCall(duration, () => {
      a.bubbleGroup.clear(true, true);
    });
  }

  _showNarration(agentId, content) {
    const a = this._agents[agentId];
    if (!a) return;
    if (this._bubbleTimers[agentId]) {
      this._bubbleTimers[agentId].remove();
    }
    a.bubbleGroup.clear(true, true);

    const maxChars = 60;
    const display = content.length > maxChars ? content.slice(0, maxChars) + '…' : content;

    // Wrap into ~25 chars per line
    const words = display.split(' ');
    const lines = [];
    let current = '';
    words.forEach((w) => {
      if ((current + ' ' + w).trim().length > 26) {
        if (current) lines.push(current.trim());
        current = w;
      } else {
        current = (current + ' ' + w).trim();
      }
    });
    if (current) lines.push(current.trim());

    const lineH = 11;
    const bubbleH = lines.length * lineH + 8;
    const bubbleW = 120;
    const bx = a.x - bubbleW / 2;
    const by = a.y - 38 - bubbleH;

    const bg = this.add.graphics();
    bg.fillStyle(0x1f2937, 0.92);
    bg.fillRoundedRect(bx, by, bubbleW, bubbleH, 5);
    bg.lineStyle(1, ZONE_BORDER[a.layer], 0.7);
    bg.strokeRoundedRect(bx, by, bubbleW, bubbleH, 5);
    // Tail
    bg.fillStyle(0x1f2937, 0.92);
    bg.fillTriangle(a.x - 4, by + bubbleH, a.x + 4, by + bubbleH, a.x, by + bubbleH + 6);

    const textObjs = lines.map((line, i) =>
      this.add.text(a.x, by + 5 + i * lineH, line, {
        fontSize: '7px',
        fontFamily: 'monospace',
        color: ZONE_LABEL_COLOR[a.layer],
        wordWrap: { width: bubbleW - 8 },
      }).setOrigin(0.5, 0)
    );

    a.bubbleGroup.addMultiple([bg, ...textObjs]);

    this._bubbleTimers[agentId] = this.time.delayedCall(5000, () => {
      a.bubbleGroup.clear(true, true);
    });
  }
}
