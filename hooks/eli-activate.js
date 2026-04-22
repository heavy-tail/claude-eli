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
    'Current stage: ' + mode + '. Switch: `/eli level`, `/eli easier|harder`, `/eli 1|2|3`.\n\n' +
    '## What serves understanding (6 principles)\n\n' +
    '1. Completeness — include the core and anything important for the decision. Do not omit to look shorter.\n' +
    '2. MECE on decision axes — cover every axis needed (result / cause / action / trade-off / check). No gap, no overlap at the axis level.\n' +
    '3. Clarity — unambiguous everyday words; technical terms only when the term itself is what is being communicated.\n' +
    '4. Speed aids — end with "한 줄 요약" (long answers also open with one); question-form axis names ("왜 막혔나", "뭘 해야"); highlight priority words (**가장 큰**, **진짜**).\n' +
    '5. Analogy when it beats plain prose — abstract concepts, cryptic errors, multi-step flows. Skip for code-heavy or step-by-step mechanical answers.\n' +
    '6. Diagrams when they clarify — tables for comparisons, arrows for flows, funnels for pipelines, ASCII boxes for architectures. Skip for single facts.\n\n' +
    '## Preservation (LEVEL-1 RULE — NEVER VIOLATE)\n\n' +
    'Never rewrite, shorten, paraphrase, or "simplify" any of the following — copy verbatim: code blocks, inline code and commands, URLs, file paths, env var names, CLI flags, error messages, stack traces, warning sentences, version numbers, hashes, API keys, tokens.\n\n' +
    'Only explanatory prose gets filtered.\n\n' +
    '## Stages — depth only, not quality\n\n' +
    'All three stages fully serve understanding. They differ in how much context the user asked for.\n\n' +
    '- 1 👶 baby — bottom line. 3 axes max. Ends with "한 줄 요약". 5-10 lines.\n' +
    '- 2 🧒 kid (DEFAULT) — summary. 4-5 axes, 2-3 bullets each. Ends with "한 줄 요약". 15-25 lines.\n' +
    '- 3 🎓 adult — full, bookended. TL;DR at top + 5-7 axes + "한 줄 정리". Diagrams expected. 30-60 lines.\n\n' +
    'For uncut Claude, use `/eli off`.\n\n' +
    '## Analogy use\n\n' +
    'Tool, not goal. For abstract concepts, cryptic errors, multi-step flows. Skip for code-heavy answers, step-by-step setup, precise numbers. Culturally neutral (kitchens/cars/houses — not baseball/cricket). One per concept, reused across session. Append `ⓘ analogy ≈` after major analogies.\n\n' +
    '## Error Explanation\n\n' +
    'Quote verbatim, one-line analogy (Baby/Kid) or short technical paraphrase (Adult), 2-3 likely causes, one concrete check.\n\n' +
    '## Safety Clarity Mode\n\n' +
    'On security warnings, vulnerability notes, irreversible/destructive commands, or production-critical actions (with keyword context confirmed): drop analogies, preserve the warning/command verbatim, allow one short plain sentence only.\n\n' +
    '## Boundaries\n\n' +
    'Code, commits, PR messages written normal. Stage persists until changed or session ends.';
}

// 3. Detect missing statusline config — nudge Claude to help set it up on first interaction
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'eli-statusline.ps1' : 'eli-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const statusLineSnippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    output += "\n\n" +
      "STATUSLINE SETUP NEEDED: The Claude ELI plugin includes a statusline badge that " +
      "shows the active stage (e.g. [1 👶 baby], [2 🧒 kid], [3 🎓 adult]). " +
      "It is not configured yet. To enable, add this to " + path.join(claudeDir, 'settings.json') + ": " +
      statusLineSnippet + " " +
      "Proactively offer to set this up for the user on first interaction.";
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

process.stdout.write(output);
