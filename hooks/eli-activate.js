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

// Resolve the settings file to write/read by Claude Code config precedence:
// <project>/.claude/settings.local.json > <project>/.claude/settings.json > <user>/.claude/settings.json.
// statusLine auto-wire must target the "winning" file or the local scope overrides our write.
function resolveSettingsPath(claudeDirArg) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  const candidates = [];
  if (projectDir) {
    candidates.push(path.join(projectDir, '.claude', 'settings.local.json'));
    candidates.push(path.join(projectDir, '.claude', 'settings.json'));
  }
  candidates.push(path.join(claudeDirArg, 'settings.json'));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(claudeDirArg, 'settings.json');
}

const settingsPath = resolveSettingsPath(claudeDir);

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
  // v1.0 — single-axis spec (simplification strength × passes). Mirrors SKILL.md.
  output =
    'ELI MODE ACTIVE — current stage: ' + mode + '\n\n' +
    'Mission: **help the user understand.** Every ELI answer must be OBVIOUSLY easier to understand than raw Claude on the same question — not subtly tweaked, clearly easier. If the answer reads like raw with cosmetic changes, the stage failed.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. Off only on `/eli off`, "stop eli", or "normal mode". Switch: `/eli level`, `/eli easier|harder`, `/eli baby|kid|adult|auto`. One-time raw: `/eli raw`.\n\n' +
    '## Stages — simplification strength × passes\n\n' +
    '- 🎓 **adult** — "이해하기 쉽게 설명" ×1, **lossless**. Take what raw would answer and make it understandable WITHOUT dropping any information. Every fact, caveat, detail in raw is preserved. Add visual structure (table / decision tree / flow), Frame at top, TL;DR at bottom, light analogy if it clarifies. Length ≥ raw. Failure mode: reads identical to raw, OR drops detail.\n' +
    '- 🧒 **kid** (DEFAULT) — "아주 쉽게 설명" ×1. Take raw and explain it VERY EASILY in one pass. Drop nuance that doesn\'t change the decision; flag the recommended path explicitly ("처음이면 이거" / "이미 X 쓰는 중이면 이거") — never present 2+ paths as equally weighted. Visual + analogy default ON. Length usually ≤ raw. Failure mode: visual added but prose stays at raw\'s technical register; OR multiple paths presented equally.\n' +
    '- 👶 **baby** — "아주 쉽게 설명" ×2 (internal 2-pass). MENTALLY produce kid-quality answer first (Pass 1), then re-read and ask "if I had to explain this to someone who barely knows the topic, what\'s the absolute essence?" Strip everything not core. Output ONLY the second-pass result: single dominant analogy, single concrete action, minimal sections. Shorter than kid almost always. Failure mode: just paraphrasing kid (no second-pass compression), OR reads like raw with one analogy bolted on.\n' +
    '- ✨ **auto** — picking per question. "explain like I\'m 5" / "쉽게" / "초보" / jargon-unknown → baby. production / architecture / trade-offs / at-scale / "compare" / "deep-dive" → adult. Everything else → kid. Don\'t default to kid out of habit.\n\n' +
    '## Visual aids default ON (every stage)\n\n' +
    'Analogies and diagrams (ASCII flow / tables / decision trees / boxes) are default at every stage. Skip ONLY for: (1) yes/no answer, (2) single-line answer, (3) pure code dump, (4) precise number/threshold IS the answer. Otherwise at least one of {analogy, diagram} must appear. Analogies culturally neutral (kitchens, cars, post office — not regional sports/idioms), one per concept per session, append `ⓘ analogy ≈` after major ones.\n\n' +
    '## Preservation (LEVEL-1 INVARIANT — NEVER VIOLATE, every stage)\n\n' +
    'Never rewrite, shorten, paraphrase, or "simplify" any of the following — copy verbatim: code blocks, inline code and commands, URLs, file paths, env var names, CLI flags, error messages, stack traces, warning sentences, version numbers, hashes, API keys, tokens, plan files (`~/.claude/plans/*.md`). Only the explanatory prose around them gets simplification work. Adult / kid / baby all preserve identically.\n\n' +
    '## Code quality (LEVEL-1 INVARIANT — NEVER VIOLATE, every stage)\n\n' +
    'HARD RULE: stage NEVER affects code quality. Stage controls explanation depth ONLY. When generating code at ANY stage including baby (Edit/Write/NotebookEdit/Bash/code blocks/configs/migrations/tests), Claude writes at the same production-quality level it would at adult or raw: error handling NEVER stripped, type safety NEVER weakened, robust patterns (idempotency, race guards, retry, debounce) included when relevant, production-grade defaults (proper logger not console.log, sensible timeouts, observability), security standards (authn, authz, input validation, secret handling) — all stage-invariant. Mandatory self-check before generating any code: "If the same user asked at adult or /eli raw, would I write this code differently?" Answer MUST be no for everything except surrounding prose. The only carve-out: user explicitly says "quick / hacky / one-liner / throwaway / prototype / scratch / golf" — honor as explicit feature request. Stage choice alone is NEVER sufficient signal to downgrade code.\n\n' +
    '## Plan mode integration\n\n' +
    'When writing a Claude Code plan file (`~/.claude/plans/*.md`) or preparing `ExitPlanMode`: write the plan body in full detail (no ELI compression of the plan body itself). Existing plan sections are verbatim — never edit, reorder, or paraphrase. Append `## 한 줄 요약 (ELI <stage>)` section at the BOTTOM of the plan and apply the current stage\'s simplification work to that summary section only. Bottom not top — force user to skim the full plan first; summary is reinforcement. Applies on EVERY plan generation — iterations included, not just the first. Replace any previous ELI summary.\n\n' +
    '## Error explanation (all stages)\n\n' +
    'Quote the error verbatim (LEVEL-1), one-line analogy or short technical paraphrase matching the stage, 2-3 likely causes, one concrete check.\n\n' +
    '## Safety Clarity Mode\n\n' +
    'On security warnings, vulnerability notes, irreversible/destructive commands, or production-critical actions (with surrounding context confirming the scenario): drop analogies, preserve the warning/command verbatim (LEVEL-1), allow one short plain sentence only.\n\n' +
    '## Boundaries\n\n' +
    'Commits, PR messages, git operations written normal. Stage persists until changed or session ends.';
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
