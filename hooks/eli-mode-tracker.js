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

    // Per-turn reinforcement.
    //
    // SessionStart injects the full SKILL.md once at session start; without
    // a per-turn signal, that ruleset persists in conversation context for
    // the entire session — even after the user types `/eli off`. So we have
    // TWO active reinforcements:
    //
    //  - flag present (active stage): emit the standard ELI MODE ACTIVE
    //    reinforcement so the model keeps the rules in attention.
    //  - flag absent (off, mid-session): emit an explicit ELI OFF override
    //    so the model treats the previously-injected SKILL.md as inactive
    //    and answers as raw Claude. Without this, /eli off would be a soft
    //    toggle — per-turn reinforcement stops, but the SKILL.md system
    //    prompt keeps Claude applying ELI rules from memory.
    //
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    if (after) {
      const header = (transitionLine ? transitionLine + '\n' : '') +
        "ELI MODE ACTIVE (stage: " + after + "). ";
      const mission =
        "Mission: help the user understand. Include the core and everything important for the decision (Completeness). Cover every axis needed — result, cause, action, trade-off, check (MECE). Use everyday words, question-form axis names, and a one-line summary at the end (long answers also open with one). ";
      const preservation =
        "Preserve code, commands, URLs, paths, env vars, CLI flags, error messages, warnings, version numbers verbatim. ";
      const analogy =
        "Use analogies as a tool (abstract concepts, cryptic errors, multi-step flows) — not for code-heavy or step-by-step answers. Culturally neutral, one per concept across the session. Append `ⓘ analogy ≈` after major analogies. ";
      const diagramsRule =
        "Use diagrams (tables, arrows, funnels, ASCII boxes) when they clarify structure better than prose. ";
      const babyVerification =
        "BABY VERIFICATION: for verification / confirmation questions (\"다 했어?\" / \"is this right?\" / \"진짜 끝났어?\"), answer = \"응/아니 + 1-2 lines why/caveat\". NO tables, NO §-number citations, NO multi-section structure for these verification questions specifically. Proof already lives in the prior response + code. Answer length follows the TOPIC, not preceding context length. ";
      const planRule =
        "If currently writing to a plan file (~/.claude/plans/*.md) or about to call ExitPlanMode, append `## 한 줄 요약 (ELI <stage>)` at the BOTTOM of the plan body. Applies to EVERY plan generation — first, second, N-th iteration alike. Replace any prior ELI summary (one summary per plan at a time). Do NOT compress the plan body; only the summary is stage-shaped.";

      let context;
      if (after === 'baby') {
        // Baby: exclude diagramsRule entirely (pushes toward tables under context pressure).
        // Include verification-scoped override — narrow scope preserves baby's base rule
        // (3-5 concrete steps) for non-verification questions.
        context = header + mission + preservation + analogy + babyVerification + planRule;
      } else {
        context = header + mission + preservation + analogy + diagramsRule + planRule;
      }

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: context
        }
      }));
    } else {
      // Flag is absent — ELI is off (either /eli off was used, or the user
      // started a session with ELI_DEFAULT_STAGE=off, or natural-language
      // deactivation fired earlier). Emit an explicit override so any ELI
      // ruleset previously injected (SessionStart SKILL.md) is treated as
      // inactive for this turn. Required for /eli off to be a true bypass,
      // not a soft toggle.
      const offContext = (transitionLine ? transitionLine + '\n' : '') +
        "ELI MODE OFF. Any ELI ruleset (SKILL.md, alalddakkalsen criteria, " +
        "stage spec, frame/TL;DR structure, analogy rules) injected earlier " +
        "in this session is INACTIVE for this response. Answer as raw Claude " +
        "would — no stage filter, no frame requirement, no TL;DR requirement, " +
        "no analogy footnote, no understanding-delta self-check. The user has " +
        "explicitly opted out of ELI for the session; respect that until they " +
        "type `/eli on`, `eli mode`, or `talk like eli`. The LEVEL-1 code " +
        "quality rule (production-quality code regardless of any setting) " +
        "still applies — that's not stage-dependent and is unaffected by ELI " +
        "being off.";

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: offContext
        }
      }));
    }
  } catch (e) {
    // Silent fail — never block the user's prompt
  }
});
