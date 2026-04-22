#!/usr/bin/env node
// Claude ELI — Claude Code SessionStart activation hook
//
// Runs once per session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.eli-active (statusline reads this)
//   2. Emits eli ruleset as hidden SessionStart context (Claude Code injects it as system context)
//   3. Detects missing statusline config and emits a setup nudge
//
// Based on the hook pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, recordSession } = require('./eli-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.eli-active');
const settingsPath = path.join(claudeDir, 'settings.json');

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  try { fs.unlinkSync(flagPath); } catch (e) {}
  process.stdout.write('OK');
  process.exit(0);
}

// 1. Write flag file (symlink-safe)
safeWriteFlag(flagPath, mode);

// Record session start (increments sessionCount, sets installedAt on first run)
recordSession();

// 2. Emit SKILL.md as system context.
//    Reads SKILL.md at runtime so edits to the source of truth propagate automatically — no
//    hardcoded duplication to go stale.
//
//    Plugin installs: __dirname = <plugin_root>/hooks/, SKILL.md at <plugin_root>/skills/eli/SKILL.md
//    Standalone installs: __dirname = $CLAUDE_CONFIG_DIR/hooks/, SKILL.md won't exist — falls back
//    to the hardcoded minimum ruleset below.

let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'eli', 'SKILL.md'), 'utf8'
  );
} catch (e) { /* standalone install — use fallback below */ }

let output;

if (skillContent) {
  // Strip YAML frontmatter
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');
  output = 'ELI MODE ACTIVE — current stage: ' + mode + '\n\n' + body;
} else {
  // Fallback when SKILL.md is not found (standalone hook install without skills dir).
  // Minimum viable ruleset — better than nothing.
  output =
    'ELI MODE ACTIVE — current stage: ' + mode + '\n\n' +
    'Mission: **help the user understand.** Every rule below serves that end.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift. Off only on `/eli off`, "stop eli", or "normal mode".\n\n' +
    'Current stage: ' + mode + '. Switch: `/eli level`, `/eli easier|harder`, `/eli baby|kid|adult|auto`. One-time raw Claude: `/eli raw`.\n\n' +
    '## "알잘딱깔센" — how to judge each answer\n\n' +
    'No fixed length, no fixed format. Every answer is judged by 4 criteria:\n\n' +
    '1. Understanding delta > 0 — must be clearly easier than raw Claude on the same question. Add value via structure, analogy, emphasis, or prerequisite translation. If indistinguishable from raw, the answer failed.\n' +
    '2. Include only what affects understanding — for each section / line / concept, ask "if I cut this, does the user miss the core or make a wrong decision?" Yes → keep. No → cut.\n' +
    '3. Shape follows content — code-heavy / abstract concept / multi-step / yes-no / error each summons its own shape. No fixed templates.\n' +
    '4. Honor the stage\'s spirit — see Stages section.\n\n' +
    'Anti-patterns: padding (filler to hit imagined length), over-compression (flattening trade-offs into misleading one-liners), stage blur (adult = raw, or baby = kid), hedging sprawl ("it depends / in some cases" stacking).\n\n' +
    'Tiebreaker when uncertain: understanding > brevity. Err long; the user can shorten with `/eli easier`.\n\n' +
    'Length is an outcome, not a goal.\n\n' +
    '## Preservation (LEVEL-1 RULE — NEVER VIOLATE)\n\n' +
    'Never rewrite, shorten, paraphrase, or "simplify" any of the following — copy verbatim: code blocks, inline code and commands, URLs, file paths, env var names, CLI flags, error messages, stack traces, warning sentences, version numbers, hashes, API keys, tokens, plan files (`~/.claude/plans/*.md`). Only explanatory prose gets filtered.\n\n' +
    '## Stages — translation depth, not length\n\n' +
    '- 👶 **baby** — deepest translation. Hard concepts made very simple with analogies and everyday words. Length whatever the topic requires — a complex topic can produce a long baby answer if that length is what makes it graspable.\n' +
    '- 🧒 **kid** (DEFAULT) — light translation, pretty concise. Keep technical terms, but cut to the decision-relevant core.\n' +
    '- 🎓 **adult** — near-raw, BUT must still be clearly easier than raw Claude (through clearer structure, emphasis, or light analogy). If indistinguishable from raw, the stage is pointless.\n' +
    '- ✨ **auto** — Claude picks per question among baby/kid/adult. Signals: beginner cues ("explain like I\'m 5", jargon questions) → baby; "production-grade", "architecture", "trade-offs" → adult; Yes/No or simple how-to → kid; complex trade-offs → adult; when uncertain → kid.\n\n' +
    'For one-time raw Claude (no ELI filter this response), use `/eli raw`. To disable ELI entirely for the session, `/eli off`.\n\n' +
    '## Summary position\n\n' +
    'All summaries at the BOTTOM of the answer — no bookending. In CLI, the last line of an answer is first-visible on scroll-up; the TL;DR / 한 줄 요약 belongs there.\n\n' +
    '## Analogy use\n\n' +
    'Tool, not goal. For abstract concepts, cryptic errors, multi-step flows. Skip for code-heavy answers, step-by-step setup, precise numbers. Culturally neutral (kitchens/cars/houses — not baseball/cricket). One per concept, reused across session. Append `ⓘ analogy ≈` after major analogies.\n\n' +
    '## Error Explanation\n\n' +
    'Quote verbatim, one-line analogy (baby/kid) or short technical paraphrase (adult), 2-3 likely causes, one concrete check.\n\n' +
    '## Safety Clarity Mode\n\n' +
    'On security warnings, vulnerability notes, irreversible/destructive commands, or production-critical actions (with keyword context confirmed): drop analogies, preserve the warning/command verbatim, allow one short plain sentence only.\n\n' +
    '## Plan mode integration\n\n' +
    'When writing a Claude Code plan file (`~/.claude/plans/*.md`) or preparing `ExitPlanMode`: write the plan in full detail (no ELI compression). Existing plan sections are verbatim — never edit, reorder, or paraphrase. Append `## 한 줄 요약 (ELI <stage>)` section at the BOTTOM of the plan (baby: very easy translation of what/why/scope; kid: summary across 뭐함/왜/핵심파일/리스크/검증/완료기준 axes; adult: TL;DR + axes + 한 줄 정리; auto: Claude picks one of the three). Bottom not top — force user to skim full plan first, summary is reinforcement.\n\n' +
    '## Boundaries\n\n' +
    'Code, commits, PR messages written normal. Stage persists until changed or session ends.';
}

// 3. Auto-wire statusLine into settings.json if missing.
//
// Plugin marketplace install wires hooks (via plugin.json) but NOT statusLine
// — the plugin manifest schema doesn't support a top-level statusLine field.
// So we programmatically wire it from the SessionStart hook. This is the
// canonical Claude Code pattern for plugin-shipped statuslines.
//
// Idempotent: we only write when the user has no statusLine OR their existing
// statusLine points to a stale plugin cache path (commit SHA changes across
// plugin updates). Never overwrite a user's custom statusLine.
try {
  const isWindows = process.platform === 'win32';
  const scriptName = isWindows ? 'eli-statusline.ps1' : 'eli-statusline.sh';
  const scriptPath = path.join(__dirname, scriptName);
  const command = isWindows
    ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
    : `bash "${scriptPath}"`;

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }

  const existing = settings.statusLine;
  const existingCmd = existing
    ? (typeof existing === 'string' ? existing : (existing.command || ''))
    : '';

  // Write if: (a) no statusLine at all, OR (b) existing statusLine is an
  // eli-statusline.sh from a stale plugin cache path (different scriptPath).
  // Never touch a user's custom non-eli statusline.
  const isEliStatusline = /eli-statusline\.(sh|ps1)/.test(existingCmd);
  const isStalePath = isEliStatusline && !existingCmd.includes(scriptPath);
  const shouldWrite = !existing || isStalePath;

  if (shouldWrite) {
    settings.statusLine = { type: 'command', command: command };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    output += '\n\nSTATUSLINE AUTO-WIRED: ELI statusline badge configured in ' +
      settingsPath + '. Restart Claude Code to see it.';
  }
} catch (e) {
  // Silent fail — don't block session start over statusline setup.
}

process.stdout.write(output);
