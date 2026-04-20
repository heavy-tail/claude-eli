#!/usr/bin/env node
// Claude for Dummies — UserPromptSubmit hook to track active evolution stage
// Inspects user input for /dummy commands and writes stage to flag file.
//
// Based on the hook pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, readFlag } = require('./dummies-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.dummies-active');

const STAGES = ['egg', 'chick', 'eagle', 'phoenix'];

// User-facing command interface is numeric (/dummy 1|2|3|4). Internal storage
// still uses stage names so hooks/statusline/SKILL.md share one vocabulary.
const STAGES_BY_NUMBER = { '1': 'egg', '2': 'chick', '3': 'eagle', '4': 'phoenix' };

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

    // /expert — this response only, normal Claude. SKILL.md handles the behavior;
    // hook just skips per-turn reinforcement so the "DUMMIES ACTIVE" line doesn't
    // fight the "/expert = normal" rule.
    if (/^\/expert\b/.test(lower)) {
      return;
    }

    // Natural-language deactivation first — takes priority over everything else.
    if (/\b(stop|disable|deactivate|turn off)\b.*\bdummies?\b/i.test(prompt) ||
        /\bdummies?\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
        /\bnormal mode\b/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
      return; // no reinforcement this turn
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
        // '/dummy level' and other args fall through — Claude + SKILL.md render menu,
        // no flag change. Stage names (egg/chick/eagle/phoenix) not accepted as args —
        // numeric interface only for predictability.
      }
      // Sub-skills (/dummy-explain, /dummy-glossary, /dummy-analogy, /dummy-stats, /dummy-help)
      // don't change the active stage; Claude reads the prompt + sub-skill file and responds.

      if (unset) {
        try { fs.unlinkSync(flagPath); } catch (e) {}
      } else if (newStage) {
        safeWriteFlag(flagPath, newStage);
      }
    }

    // Per-turn reinforcement: emit a compact reminder when dummies is active.
    // SessionStart injects the full SKILL.md once; this keeps dummies visible in
    // the model's attention on every user message (other plugins may inject
    // competing style hints mid-conversation).
    //
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    // If the flag is missing, corrupted, oversized, or a symlink pointing at
    // something like ~/.ssh/id_rsa, readFlag returns null and we emit nothing.
    const activeStage = readFlag(flagPath);
    if (activeStage) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "DUMMIES MODE ACTIVE (stage: " + activeStage + "). " +
            "Respond in plain language with analogies. Preserve code, commands, URLs, paths, env vars, CLI flags, error messages, warnings, version numbers verbatim. " +
            "Culturally neutral analogies, consistent across the session. Append `ⓘ analogy ≈` after major analogies."
        }
      }));
    }
  } catch (e) {
    // Silent fail — never block the user's prompt
  }
});
