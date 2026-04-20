#!/usr/bin/env node
// Claude for Dummies — UserPromptSubmit hook to track active evolution stage
// Inspects user input for /dummy commands and writes stage to flag file.
//
// Also records prompt count + stage transitions for /dummy-stats, and emits
// a STAGE CHANGE line when an upgrade/downgrade happens so that Level-up!
// messages can be rendered by commands/dummy.toml.
//
// Based on the hook pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getDefaultMode, safeWriteFlag, readFlag,
  recordPrompt, recordStageChange
} = require('./dummies-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.dummies-active');

const STAGES = ['egg', 'chick', 'eagle', 'phoenix'];
const STAGES_BY_NUMBER = { '1': 'egg', '2': 'chick', '3': 'eagle', '4': 'phoenix' };
const STAGE_NUMBER = { egg: 1, chick: 2, eagle: 3, phoenix: 4 };

function shiftStage(current, delta) {
  const i = STAGES.indexOf(current);
  if (i < 0) return getDefaultMode();
  const next = Math.max(0, Math.min(STAGES.length - 1, i + delta));
  return STAGES[next];
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim();
    const lower = prompt.toLowerCase();

    // Record every prompt for /dummy-stats (cheap, best-effort).
    recordPrompt();

    // /expert — this response only, normal Claude. SKILL.md handles the behavior.
    // Skip per-turn reinforcement so the "DUMMIES ACTIVE" line doesn't fight
    // the "/expert = normal" rule.
    if (/^\/expert\b/.test(lower)) {
      return;
    }

    // Snapshot the pre-command stage so we can detect transitions.
    const before = readFlag(flagPath);

    // Natural-language deactivation first — takes priority over everything else.
    if (/\b(stop|disable|deactivate|turn off)\b.*\bdummies?\b/i.test(prompt) ||
        /\bdummies?\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
        /\bnormal mode\b/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
      if (before) recordStageChange(before, 'off');
      return;
    }

    // Natural-language activation ("activate dummies", "dummies mode", "talk like dummies").
    if (/\b(activate|enable|turn on|start)\b.*\bdummies?\b/i.test(prompt) ||
        /\bdummies?\b.*\b(mode|activate|enable|turn on|start)\b/i.test(prompt) ||
        /\btalk like dummies?\b/i.test(prompt)) {
      const mode = getDefaultMode();
      if (mode !== 'off') {
        safeWriteFlag(flagPath, mode);
      }
    }

    // Slash commands — /dummy <arg>
    if (lower.startsWith('/dummy')) {
      const parts = lower.split(/\s+/);
      const cmd = parts[0]; // /dummy, /dummy-explain, /dummy-glossary, etc.
      const arg = parts[1] || '';

      let newStage = null;
      let unset = false;

      if (cmd === '/dummy' || cmd === '/dummy:dummies') {
        if (arg === 'off') {
          unset = true;
        } else if (arg === 'on' || arg === '') {
          newStage = getDefaultMode();
        } else if (STAGES_BY_NUMBER[arg]) {
          newStage = STAGES_BY_NUMBER[arg];
        } else if (arg === 'easier') {
          newStage = shiftStage(readFlag(flagPath) || getDefaultMode(), -1);
        } else if (arg === 'harder') {
          newStage = shiftStage(readFlag(flagPath) || getDefaultMode(), +1);
        }
        // '/dummy level' and other args fall through — commands/dummy.toml renders
        // the menu, no flag change. Stage names not accepted as args.
      }
      // Sub-skills (/dummy-glossary, /dummy-stats, /dummy-help) don't change stage.

      if (unset) {
        try { fs.unlinkSync(flagPath); } catch (e) {}
      } else if (newStage) {
        safeWriteFlag(flagPath, newStage);
      }
    }

    // Detect stage transition vs snapshot.
    const after = readFlag(flagPath);
    let transitionLine = '';
    if (after && after !== before) {
      if (before) {
        recordStageChange(before, after);
        const oldN = STAGE_NUMBER[before] || 0;
        const newN = STAGE_NUMBER[after] || 0;
        const dir = newN > oldN ? 'upgrade' : (newN < oldN ? 'downgrade' : 'same');
        transitionLine = `STAGE CHANGE: ${oldN} ${before} → ${newN} ${after} (${dir})`;
      } else {
        // off → on transition
        recordStageChange('off', after);
        transitionLine = `STAGE CHANGE: off → ${STAGE_NUMBER[after]} ${after} (activate)`;
      }
    }

    // Per-turn reinforcement: emit a compact reminder when dummies is active.
    // SessionStart injects the full SKILL.md once; this keeps dummies visible in
    // the model's attention on every user message. If a stage transition just
    // happened, prepend a STAGE CHANGE line so commands/dummy.toml can render
    // the Level-up! message.
    //
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    if (after) {
      const context = (transitionLine ? transitionLine + '\n' : '') +
        "DUMMIES MODE ACTIVE (stage: " + after + "). " +
        "Respond in plain language with analogies. Preserve code, commands, URLs, paths, env vars, CLI flags, error messages, warnings, version numbers verbatim. " +
        "Culturally neutral analogies, consistent across the session. Append `ⓘ analogy ≈` after major analogies.";

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: context
        }
      }));
    } else if (transitionLine) {
      // Stage went to off — still useful for Claude to know (e.g. confirm "Dummies off").
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: transitionLine
        }
      }));
    }
  } catch (e) {
    // Silent fail — never block the user's prompt
  }
});
