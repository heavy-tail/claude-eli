#!/usr/bin/env node
// Claude for Dummies — Claude Code SessionStart activation hook
//
// Runs once per session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.dummies-active (statusline reads this)
//   2. Emits dummies ruleset as hidden SessionStart context (Claude Code injects it as system context)
//   3. Detects missing statusline config and emits a setup nudge
//
// Based on the hook pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, recordSession } = require('./dummies-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.dummies-active');
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
//    Plugin installs: __dirname = <plugin_root>/hooks/, SKILL.md at <plugin_root>/skills/dummies/SKILL.md
//    Standalone installs: __dirname = $CLAUDE_CONFIG_DIR/hooks/, SKILL.md won't exist — falls back
//    to the hardcoded minimum ruleset below.

let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'dummies', 'SKILL.md'), 'utf8'
  );
} catch (e) { /* standalone install — use fallback below */ }

let output;

if (skillContent) {
  // Strip YAML frontmatter
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');
  output = 'DUMMIES MODE ACTIVE — current stage: ' + mode + '\n\n' + body;
} else {
  // Fallback when SKILL.md is not found (standalone hook install without skills dir).
  // Minimum viable ruleset — better than nothing.
  output =
    'DUMMIES MODE ACTIVE — current stage: ' + mode + '\n\n' +
    'Respond in plain language with analogies. Technical substance stays. Only jargon gets translated — code stays exact.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift. Off only on `/dummy off`, "stop dummies", or "normal mode".\n\n' +
    'Current stage: ' + mode + '. Switch: `/dummy level`, `/dummy easier|harder`, `/dummy 1|2|3`.\n\n' +
    '## The decision filter (CORE RULE)\n\n' +
    'Before including any sentence, table, number, or code: "Does this affect what the user does next?" If yes, include. If no, cut. Tables/numbers/code are tools to clarify, not goals.\n\n' +
    '## Preservation (LEVEL-1 RULE — NEVER VIOLATE)\n\n' +
    'Never rewrite, shorten, paraphrase, or "simplify" any of the following — copy verbatim: code blocks, inline code and commands, URLs, file paths, env var names, CLI flags, error messages, stack traces, warning sentences, version numbers, hashes, API keys, tokens.\n\n' +
    'Only explanatory prose gets filtered.\n\n' +
    '## Stages (decision-detail axis)\n\n' +
    '- 1 baby 👶 — TL;DR. Bottom line + 2-4 bullets max. No tables unless necessary.\n' +
    '- 2 kid 🧒 — DEFAULT. Summary. 5-10 bullets or 2-4 short paragraphs. Key facts + main causes + recommended next action.\n' +
    '- 3 adult 🎓 — Standard. Full structure with options/trade-offs/edge cases. Closer to baseline length but still filtered.\n' +
    'For uncut Claude, use `/dummy off`.\n\n' +
    '## Analogy use\n\n' +
    'Tool, not goal. Use for abstract concepts, cryptic errors, or multi-step flows. Skip for code-heavy answers, step-by-step setup, precise numbers. Culturally neutral (kitchens/cars/houses — not baseball/cricket). Append `ⓘ analogy ≈` after major analogies.\n\n' +
    '## Error Explanation\n\n' +
    'When an error appears: quote verbatim, one-line analogy, 2-3 likely causes, one concrete check.\n\n' +
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
    const scriptName = isWindows ? 'dummies-statusline.ps1' : 'dummies-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const statusLineSnippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    output += "\n\n" +
      "STATUSLINE SETUP NEEDED: The Claude for Dummies plugin includes a statusline badge that " +
      "shows the active stage (e.g. [1 👶 baby], [2 🧒 kid], [3 🎓 adult]). " +
      "It is not configured yet. To enable, add this to " + path.join(claudeDir, 'settings.json') + ": " +
      statusLineSnippet + " " +
      "Proactively offer to set this up for the user on first interaction.";
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

process.stdout.write(output);
