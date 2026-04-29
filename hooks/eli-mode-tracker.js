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
          // /eli on must always activate. If getDefaultMode() returns 'off' (env
          // ELI_DEFAULT_STAGE=off, or config defaultStage='off'), fall back to
          // 'kid' — writing 'off' to the flag would leave the user in an
          // "ACTIVE (stage: off)" state that emits the off branch's behavior
          // contradicting "/eli on activates".
          const candidate = getDefaultMode();
          newStage = candidate === 'off' ? 'kid' : candidate;
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
      // v1.0 — single-axis spec: each stage = simplification strength × passes.
      // adult = "이해하기 쉽게" ×1 lossless / kid = "아주 쉽게" ×1 / baby = "아주 쉽게" ×2 (internal 2-pass) / auto = picking.
      // Visual aids (analogy + diagram) are default ON every stage (skip only for yes/no, single-line, pure code, exact-number answers).
      // LEVEL-1 invariants (preservation + code quality) are stage-independent.
      const header = (transitionLine ? transitionLine + '\n' : '') +
        "ELI MODE ACTIVE (stage: " + after + "). ";
      const northStar =
        "North Star: the answer must be OBVIOUSLY easier to understand than raw Claude on the same question — not subtly tweaked, clearly easier. If your answer reads like raw with cosmetic changes, the stage failed. ";
      const preservation =
        "PRESERVATION (LEVEL-1, every stage): code blocks, inline code, inline commands, URLs, file paths, env var names, CLI flags, error messages, stack traces, warnings, version numbers, hashes, API keys, tokens, plan files (~/.claude/plans/*.md) copied verbatim — never paraphrased, shortened, or 'simplified'. Only the explanatory prose around them gets simplification work. ";
      const codeQuality =
        "CODE QUALITY (LEVEL-1, every stage): stage controls explanation depth ONLY. Generated code stays at production quality at every stage including baby — error handling, type safety, robust patterns, security all stage-invariant. Self-check before any code: 'Would I write this differently at adult or /eli raw?' Answer must be no. ";
      const visualDefault =
        "VISUAL AIDS DEFAULT ON: analogies and diagrams (ASCII flow / tables / decision trees / boxes) are default at every stage. Skip ONLY for: (1) yes/no answer, (2) single-line answer, (3) pure code dump, (4) precise number/threshold IS the answer. Otherwise at least one of {analogy, diagram} must appear. Analogies culturally neutral (kitchens, cars, post office — not regional sports/idioms), one per concept per session, append `ⓘ analogy ≈` after major ones. ";
      const planRule =
        "If currently writing to a plan file (~/.claude/plans/*.md) or about to call ExitPlanMode, append `## 한 줄 요약 (ELI <stage>)` at the BOTTOM of the plan body — apply current stage's simplification work to the summary section only, NOT to the plan body (plan body stays full-detail verbatim). Applies to EVERY plan generation — first, second, N-th iteration alike. Replace any prior ELI summary. ";
      // Stage-specific simplification instruction.
      const adultRule =
        "ADULT — '이해하기 쉽게 설명' ×1, LOSSLESS: take what raw would answer and make it understandable WITHOUT dropping any information. Every fact, caveat, detail in raw is preserved. Add visual structure (table / decision tree / flow), Frame at top, TL;DR at bottom, light analogy if it clarifies. Length ≥ raw (detail + structure added). FAILURE MODE: reads identical to raw with no structure-add, OR drops detail to fit a shorter answer.";
      const kidRule =
        "KID — '아주 쉽게 설명' ×1: take what raw would answer and explain it VERY EASILY in one pass. Drop nuance that doesn't change the decision; flag the recommended path explicitly (\"처음이면 이거\" / \"이미 X 쓰는 중이면 이거\") — never present 2+ paths as equally weighted. Visual + analogy default ON. Length usually ≤ raw, but follows what's needed. FAILURE MODE: visual / structure added but prose stays at raw's technical register; OR multiple paths presented equally.";
      const babyRule =
        "BABY — '아주 쉽게 설명' ×2 (internal 2-pass): MENTALLY produce kid-quality answer first (Pass 1), then re-read and ask 'if I had to explain this to someone who barely knows the topic, what's the absolute essence?' Strip everything not core. Compress N causes into 1 root metaphor. Output ONLY the second-pass result: single dominant analogy, single concrete action, minimal sections. SHORTER than kid almost always. FAILURE MODE: just paraphrasing kid (no second-pass compression), OR reads like raw with one analogy bolted on.";
      const autoRule =
        "AUTO — picking per question: read the question's signals and pick adult/kid/baby. \"explain like I'm 5\" / \"쉽게\" / \"초보\" / jargon-unknown question → baby. production / architecture / trade-offs / at-scale / \"compare\" / \"deep-dive\" → adult. Everything else → kid. Don't default to kid out of habit — actually pick based on signal.";

      const stageRule =
        after === 'adult' ? adultRule :
        after === 'kid'   ? kidRule :
        after === 'baby'  ? babyRule :
                            autoRule;

      const context = header + northStar + preservation + codeQuality + visualDefault + planRule + stageRule;

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
        "ELI MODE OFF. Any ELI ruleset (SKILL.md stage spec, visual-aids-default-on, " +
        "simplification rules) injected earlier in this session is INACTIVE for " +
        "this response. Answer as raw Claude would — no stage filter, no obligatory " +
        "analogies / diagrams, no \"obviously easier than raw\" self-check. The user " +
        "has explicitly opted out of ELI for the session; respect that until they " +
        "type `/eli on`, `eli mode`, or `talk like eli`. The LEVEL-1 invariants " +
        "(code/URL/path/error preservation + production-quality code regardless of " +
        "any setting) still apply — those are not stage-dependent and are unaffected " +
        "by ELI being off.";

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
