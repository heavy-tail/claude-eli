#!/usr/bin/env node
// Claude ELI — UserPromptSubmit hook to track active evolution stage
// Inspects user input for /eli commands and writes stage to flag file.
//
// Also records prompt count + stage transitions for /eli-stats, and emits
// a STAGE CHANGE line when an upgrade/downgrade happens so that Level-up!
// messages can be rendered by commands/eli.toml.
//
// Based on the hook pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getDefaultMode, safeWriteFlag, readFlag,
  recordPrompt, recordStageChange
} = require('./eli-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.eli-active');

const STAGES = ['baby', 'kid', 'adult'];
// VALID_STAGE_ARGS = explicit stage names accepted as `/eli <arg>`.
// 'auto' is a valid stage but NOT a progression point — easier/harder from
// auto falls back to fixed stages (see shiftStage).
const VALID_STAGE_ARGS = new Set([...STAGES, 'auto']);

function shiftStage(current, delta) {
  // From 'auto', treat as kid (middle) so /eli easier → baby and
  // /eli harder → adult. Exits auto into a fixed stage — intentional,
  // since easier/harder only make sense against a concrete stage.
  if (current === 'auto') current = 'kid';
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

    // Record every prompt for /eli-stats (cheap, best-effort).
    recordPrompt();

    // /eli raw — this response only, raw Claude (bypass ELI). SKILL.md + the
    // commands/eli-raw.toml prompt handle the actual behavior. Skip per-turn
    // reinforcement so the "ELI ACTIVE" line doesn't fight the "raw = normal"
    // rule. Flag file stays unchanged.
    if (/^\/eli\s+raw\b/.test(lower)) {
      return;
    }

    // Snapshot the pre-command stage so we can detect transitions.
    const before = readFlag(flagPath);

    // Natural-language deactivation first — takes priority over everything else.
    // Match "eli" as a whole word (not "el", "else", "elite", etc).
    if (/\b(stop|disable|deactivate|turn off)\b.*\beli\b/i.test(prompt) ||
        /\beli\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
        /\bnormal mode\b/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
      if (before) recordStageChange(before, 'off');
      return;
    }

    // Natural-language activation ("activate eli", "eli mode", "talk like eli").
    if (/\b(activate|enable|turn on|start)\b.*\beli\b/i.test(prompt) ||
        /\beli\b.*\b(mode|activate|enable|turn on|start)\b/i.test(prompt) ||
        /\btalk like eli\b/i.test(prompt)) {
      const mode = getDefaultMode();
      if (mode !== 'off') {
        safeWriteFlag(flagPath, mode);
      }
    }

    // Slash commands — /eli <arg>
    if (lower.startsWith('/eli')) {
      const parts = lower.split(/\s+/);
      const cmd = parts[0]; // /eli, /eli-explain, /eli-glossary, etc.
      const arg = parts[1] || '';

      let newStage = null;
      let unset = false;

      if (cmd === '/eli' || cmd === '/eli:eli') {
        if (arg === 'off') {
          unset = true;
        } else if (arg === 'on' || arg === '') {
          newStage = getDefaultMode();
        } else if (VALID_STAGE_ARGS.has(arg)) {
          newStage = arg;
        } else if (arg === 'easier') {
          newStage = shiftStage(readFlag(flagPath) || getDefaultMode(), -1);
        } else if (arg === 'harder') {
          newStage = shiftStage(readFlag(flagPath) || getDefaultMode(), +1);
        }
        // '/eli level' and other args fall through — commands/eli.toml renders
        // the menu, no flag change. Numeric args (/eli 1|2|3) were removed in
        // favor of stage-name args — only baby|kid|adult accepted.
      }
      // Sub-skills (/eli-glossary, /eli-stats, /eli-help) don't change stage.

      if (unset) {
        try { fs.unlinkSync(flagPath); } catch (e) {}
      } else if (newStage) {
        safeWriteFlag(flagPath, newStage);
      }
    }

    // Detect stage transition vs snapshot. baby < kid < adult is assumed
    // obvious from the names — no numeric prefix needed in the trace.
    // auto is orthogonal to the depth axis (it's "Claude picks per question"),
    // so transitions to/from auto are labeled "switch" rather than
    // upgrade/downgrade.
    const after = readFlag(flagPath);
    let transitionLine = '';
    if (after && after !== before) {
      if (before) {
        recordStageChange(before, after);
        let dir;
        if (before === 'auto' || after === 'auto') {
          dir = 'switch';
        } else {
          const oldI = STAGES.indexOf(before);
          const newI = STAGES.indexOf(after);
          dir = newI > oldI ? 'upgrade' : (newI < oldI ? 'downgrade' : 'same');
        }
        transitionLine = `STAGE CHANGE: ${before} → ${after} (${dir})`;
      } else {
        // off → on transition
        recordStageChange('off', after);
        transitionLine = `STAGE CHANGE: off → ${after} (activate)`;
      }
    }

    // Per-turn reinforcement: emit a compact reminder when eli is active.
    // SessionStart injects the full SKILL.md once; this keeps eli visible in
    // the model's attention on every user message. If a stage transition just
    // happened, prepend a STAGE CHANGE line so commands/eli.toml can render
    // the Level-up! message.
    //
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    if (after) {
      const context = (transitionLine ? transitionLine + '\n' : '') +
        "ELI MODE ACTIVE (stage: " + after + "). " +
        "Mission: help the user understand. Include the core and everything important for the decision (Completeness). Cover every axis needed — result, cause, action, trade-off, check (MECE). Use everyday words, question-form axis names, and a one-line summary at the end (long answers also open with one). " +
        "Preserve code, commands, URLs, paths, env vars, CLI flags, error messages, warnings, version numbers verbatim. " +
        "Use analogies as a tool (abstract concepts, cryptic errors, multi-step flows) — not for code-heavy or step-by-step answers. Culturally neutral, one per concept across the session. Append `ⓘ analogy ≈` after major analogies. " +
        "Use diagrams (tables, arrows, funnels, ASCII boxes) when they clarify structure better than prose.";

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: context
        }
      }));
    } else if (transitionLine) {
      // Stage went to off — still useful for Claude to know (e.g. confirm "ELI off").
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
