# Changelog

All notable changes to Claude ELI.

## v1.0.0 — fundamental redesign (single-axis spec) (2026-04-28)

72h dogfood across v0.9.0 → v0.9.1 → v0.9.2 surfaced a fundamental product issue: **kid and adult often felt "wordier without easier"**. Translation-depth axis was too vague; per-stage calibration patches (v0.9.1 BABY VERIFICATION, v0.9.2 BABY TRANSLATION DEPTH / KID PATH-FLAG / ADULT LOSSLESS / AUTO PICK) addressed symptoms but not the root spec issue.

v1.0 reframes the four stages on a **single axis: simplification strength × passes**. Each stage is defined by the prompt that would produce its answer from raw Claude:

- **🎓 adult** = "이해하기 쉽게 설명해줘" × 1, **lossless** (every fact in raw preserved, structure + visuals added)
- **🧒 kid** = "아주 쉽게 설명해줘" × 1 (default — strong simplification, drop nuance OK)
- **👶 baby** = "아주 쉽게 설명해줘" × 2 (internal 2-pass — kid output → "더 쉽게" → output only the second pass)
- **✨ auto** = picking per question

Plus new system-wide rule: **visual aids (analogies + diagrams) are default ON at every stage**. The model's instinct to skip them was the largest single failure mode in v0.9.x dogfood. Skip only for yes/no, single-line, pure code dump, or precise-number answers.

LEVEL-1 invariants (Preservation + Code quality stage-independence) carry forward unchanged.

### Why a major version

Not a calibration patch — this is a redesign of the core stage definitions. Per-stage anti-drift fragments from v0.9.1 / v0.9.2 are obsolete (BABY VERIFICATION, BABY TRANSLATION DEPTH, KID PATH-FLAG, ADULT LOSSLESS / BUDGET, AUTO PICK). The v0.7+ "translation depth" axis is gone. The v0.7 "알잘딱깔센" 4-criteria framework is gone. The "Frame at top + TL;DR at bottom" structural rule is gone as a spec mandate (still allowed and recommended for adult, but not enforced).

### Removed (obsolete in single-axis spec)

- `BABY VERIFICATION` fragment (verification-question handling now part of baby's general "× 2 pass" compression)
- `BABY TRANSLATION DEPTH` fragment (translation depth now intrinsic to "아주 쉽게 × 2")
- `KID PATH-FLAG + KID GLOSS` fragment (path-flag and gloss now part of kid's "아주 쉽게 × 1" rule and its FAILURE MODE clause)
- `ADULT LOSSLESS + ADULT BUDGET` fragment (lossless now part of adult's spec definition; length budget removed — adult has no hard cap, just "≥ raw")
- `AUTO PICK` fragment (picking signals now part of auto's spec definition)
- "translation depth, not length" framing
- "알잘딱깔센" 4-criteria judgment framework
- Per-stage Calibration before/after examples (v0.7 CORS / Vercel deployment, v0.9.1 verification, v0.9.2 translation-depth-fade)
- "Frame at top + TL;DR at bottom" as a spec mandate (kept as adult's recommended structure, not enforced)
- "Style patterns" section

### Added

- Single-axis 4-stage spec defined operationally (each stage = prompt-equivalent)
- **Visual aids default ON** as a system-wide rule with explicit skip conditions (4 cases)
- **Failure mode clause** per stage — explicit description of what each stage looks like when it goes wrong
- v1.0.0 in `.claude-plugin/plugin.json` + `package.json` + `package-lock.json` synced

### Changed (4-layer rewrite)

- `skills/eli/SKILL.md` — full rewrite. ~565 lines → ~145 lines (75% compression). Single-axis spec, no obsolete framings.
- `hooks/eli-mode-tracker.js` ACTIVE context — replaced 7 obsolete fragments + 4-way branch with 5 common fragments (header / northStar / preservation / codeQuality / visualDefault / planRule) + 1 stage-specific rule (adultRule / kidRule / babyRule / autoRule).
- `hooks/eli-activate.js` fallback ruleset — full rewrite, mirrors SKILL.md.
- `rules/eli-activate.md` (v2 agents) — full rewrite, mirrors SKILL.md.

### Tests migrated

- `test/eli-mode-tracker.test.js`: 4 obsolete v0.9.1+v0.9.2 stage-fragment tests → 2 v1.0 tests (common rules at every stage; cross-stage exclusivity for the stage-specific rule).
- `test/skill-md-structure.test.js`: 11 obsolete anchor tests (알잘딱깔센, Verification questions, Translation > analogy, Path-flag, Lossless, default-kid, etc.) → 8 v1.0 tests (North Star, 4 stage definitions, visual-aids-default-on, LEVEL-1 invariants, plan iteration, rules/eli-activate.md mirror).
- `test/eli-activate.test.js`: existing standalone-fallback test assertions migrated from v0.9.x anchors to v1.0 anchors (no test count change).

### Migration

Existing `~/.claude/.eli-active` flag values (`baby` / `kid` / `adult` / `auto` / absent-for-off) carry forward unchanged — no user action needed. Plugin `/plugin marketplace update` + restart picks up v1.0.

### Token cost

Per-turn ACTIVE context size is roughly equivalent to v0.9.2 (slightly larger northStar + visualDefault, slightly smaller stage-specific rule due to consolidation). No notable cache impact.

## v0.9.2 — calibration patch (2026-04-27)

24h-dogfood-driven follow-up to v0.9.1. Per-stage hook reinforcement — extends v0.9.1's baby-only branching to all 4 stages so each stage's anti-patterns survive context decay in long sessions. No source refactor, additive only. Test count: **80 → 84** (4 new tests + assertions added to existing `standalone fallback ruleset` test).

### Fixed (per-stage drift in long sessions)

- **Baby translation depth fade** — analogy + structure correct but jargon (cold start / middleware / hydration / Vercel function / serverless) untranslated; sentence-level register matches raw Claude. v0.9.1's `BABY VERIFICATION` covered verification questions only; this is a separate axis (translation depth) that fades on normal questions too. Directly observed in 2026-04-25 dogfood.
- **Kid path-equality drift** — multiple methods presented equally (path-equality anti-pattern resurfaces under context pressure), bare jargon dropped without inline gloss.
- **Adult tutorial creep** — extra "흔한 실수" / "피해야 할 패턴" / "확인 절차" sections raw didn't include, length 1.5x+ raw (over 1.0-1.3x budget).
- **Auto default-kid habit** — beginner / production cues ignored, every question defaults to kid even when signal clearly points elsewhere.

### Patched (4-layer, additive only)

- `hooks/eli-mode-tracker.js` ACTIVE context: 2-way (baby vs else) → 4-way (baby/kid/adult/auto) branch. New fragments — `BABY TRANSLATION DEPTH`, `KID PATH-FLAG + KID GLOSS`, `ADULT LOSSLESS + ADULT BUDGET`, `AUTO PICK` — each scoped to its single stage. v0.9.1 invariants preserved (baby excludes `diagramsRule`, `BABY VERIFICATION` baby-only, `planRule` on every active stage).
- `skills/eli/SKILL.md`: Calibration 4th example added (translation depth fade, 24h dogfood case). Kid/adult covered by existing v0.7 examples (path equality / completeness disease).
- `hooks/eli-activate.js` fallback ruleset (lines 95-98): one reinforcement sentence appended per stage definition.
- `rules/eli-activate.md` (lines 17-20): same spec propagated for v2 agents.

### Added

- `version: "0.9.2"` in `.claude-plugin/plugin.json` + `package.json`. `package-lock.json` root metadata synced via `npm install --package-lock-only`.
- 4 new tests:
  * `test/eli-mode-tracker.test.js` (+2): per-stage reinforcement literal present for each of baby/kid/adult/auto; cross-stage exclusivity (each fragment scoped to one stage, no scope leak).
  * `test/skill-md-structure.test.js` (+2): SKILL.md v0.9.2 calibration anchor; rules/eli-activate.md v0.9.2 per-stage reinforcement anchors (4 stages).
- Existing `standalone fallback ruleset emits when skills/ is absent` test now also asserts the v0.9.2 4-stage reinforcements present in fallback stdout.

### Token cost (per turn, additive)

- baby: +~110 tokens (`babyTranslation` on top of v0.9.1's `babyVerification`)
- kid: +~120 tokens (`kidPathFlag`)
- adult: +~120 tokens (`adultLossless`)
- auto: +~120 tokens (`autoPick`)

One additional fragment per turn; replaces nothing.

## v0.9.1 — calibration patch (2026-04-24)

Dogfood-driven fixes from the first real install (Lana_AI_Trading_OS build) + two Codex reviews of the v0.9.1 plan. No source refactor — 4-layer consistent patch across SKILL.md / eli-mode-tracker / eli-activate fallback / rules/eli-activate.md. Test count: **72 → 80** (8 new tests + assertions added to existing `standalone fallback ruleset` test).

### Fixed

- **Baby stage drift on verification questions** (e.g. "다 했어?" / "is this right?") when a long spec/plan preceded the question. Root cause had four layers; all four patched:
  * `skills/eli/SKILL.md`: new baby verification rule ("응/아니 + 1-2 lines, no tables/checklists/§citations"), new anti-context-scaling rule ("length shaped by TOPIC, not preceding context"), new Calibration before/after example.
  * `hooks/eli-mode-tracker.js`: ACTIVE context is now stage-branched. Baby drops the "Use diagrams (tables, arrows, funnels)" reinforcement (drift vector) and adds a verification-scoped `BABY VERIFICATION` override. Kid / adult / auto keep the diagrams rule. The override is scoped to verification questions specifically — baby's base 3-5 concrete-step rule is unchanged for non-verification questions.
  * `hooks/eli-activate.js` fallback ruleset (standalone install) + `rules/eli-activate.md` (v2 non-Claude-Code agents): same verification rule propagated for consistency.
- **Statusline missing on local-scope plugin install** (`/plugin install eli@eli` → "Install for you, in this repo only"). `eli-activate.js` used to hardcode `<claudeDir>/settings.json`, which Claude Code's local-scope precedence then overrode. New `resolveSettingsPath()` walks candidates in precedence order: `<projectDir>/.claude/settings.local.json` → `<projectDir>/.claude/settings.json` → `<claudeDir>/settings.json`. statusLine is written into the winning file so the auto-wire actually sticks. Idempotent / stale-path rewrite logic unchanged — both now operate on the resolved path.
- **Plan mode `한 줄 요약 (ELI <stage>)` regression on iteration 2+**. The first plan got the summary; subsequent regenerations did not. Root cause: the plan-mode rule lived only in the SessionStart-injected SKILL.md, so it faded under context decay while the UserPromptSubmit hook said nothing about plan mode. Fix: `eli-mode-tracker.js` ACTIVE context now includes a self-gating plan-mode reinforcement on every turn, all stages. SKILL.md plan-mode section + `eli-activate.js` fallback + `rules/eli-activate.md` all strengthened with "Applies on EVERY plan generation — iterations included".

### Added

- `version: "0.9.1"` field in `.claude-plugin/plugin.json` and `package.json` (first formal version field — v0.9.0 shipped without one). `package-lock.json` root metadata synced via `npm install --package-lock-only`.
- Helper extensions in `test/helpers/isolated-env.js`: `makeIsolatedEnv({ withProjectDir: true })`, `runActivate(env, { projectDir })`, `writeProjectSettings`, `readProjectSettings`, `projectSettingsExists`. `CLAUDE_PROJECT_DIR` is now explicitly scrubbed from the base env so host-env leakage can't mask a missing test injection.
- 8 new tests:
  * `test/eli-mode-tracker.test.js` (+2): plan-mode reinforcement present for every stage (`baby|kid|adult|auto`); baby context contains `BABY VERIFICATION` and excludes `Use diagrams (tables`, other stages contain diagrams and exclude `BABY VERIFICATION`.
  * `test/eli-activate.test.js` (+4): local > user precedence; project > user middle case (plan review #5 gap); user fallback when no project files; local-scope stale plugin-cache path rewrite (symmetric to the existing user-scope stale-path test).
  * `test/skill-md-structure.test.js` (+2): SKILL.md calibration anchors (verification + context-scaling + plan iteration); rules/eli-activate.md calibration anchors.
- Existing `standalone fallback ruleset emits when skills/ is absent` test now also asserts the v0.9.1 verification + iteration anchors are present in the fallback stdout.
- `{ skip: isWindows }` guard on three `test/eli-config.test.js` symlink tests (safeWriteFlag symlink-target refusal, parent-symlink refusal, readFlag symlink rejection). `fs.symlinkSync` on Windows requires Developer Mode / admin; the `safeWriteFlag` invariant these pin is `O_NOFOLLOW` + `lstat`, which is POSIX-only by design. The guard matches the existing `test/e2e/install-uninstall.ps1.test.js` platform-skip pattern and was flagged by Codex review of this patch.

## v0.9.0 — test suite (unit + integration + e2e + fuzz)

First test infrastructure for the project. Behavior pinned end-to-end; no source changes. Runner is Node's built-in `node --test` — zero runtime deps, one dev-dep (`fast-check` for PBT).

**Per-layer coverage** (72 tests, 71 pass, 1 platform-guarded skip):

- **Layer 1 — Unit (66 tests)**
  - `test/eli-config.test.js` (19) — `VALID_MODES` snapshot; `safeWriteFlag` symlink refusal at target + parent, atomic temp+rename, 0600 permission bit; `readFlag` symlink/size-cap/whitelist refusal; `getDefaultMode` env → config → `'kid'` priority; `readMetadata`/`writeMetadata` round-trip; `recordStageChange` caps at `MAX_STAGE_HISTORY = 100`
  - `test/eli-activate.test.js` (9) — default-stage flag write, YAML frontmatter strip, `sessionCount` increment, `ELI_DEFAULT_STAGE=off` short-circuit, filesystem-error silent exit, standalone-install fallback ruleset, `statusLine` auto-wire write / non-eli-preservation / stale-path rewrite
  - `test/eli-mode-tracker.test.js` (30) — `/eli baby|kid|adult|auto|off|on|easier|harder|raw` + `/eli-glossary`; natural-language activation/deactivation; `STAGE CHANGE: X → Y (upgrade|downgrade|switch|activate)` additionalContext; **v0.8.4 `/eli off` per-turn override invariant** (flag absent → every UserPromptSubmit emits `ELI MODE OFF` override); malformed/undefined stdin silent-fail
  - `test/skill-md-structure.test.js` (8) — regression guards for `skills/eli/SKILL.md` anchors (Code quality LEVEL-1 INVARIANT, Plan mode integration, 알잘딱깔센, ✨ auto, Preservation LEVEL-1, Frame/TL;DR structure) + `rules/eli-activate.md` body

- **Layer 2 — Integration (1 test)**
  - `test/integration/hook-chain.test.js` — 6-step end-to-end chain: activate → `/eli adult` → statusline `[eli adult 🎓]` → `/eli off` → statusline empty → plain prompt emits OFF override

- **Layer 3 — E2E (2 tests, 1 skipped on non-Windows)**
  - `test/e2e/install-uninstall.test.js` — `install.sh` copies 5 hooks, merges `settings.json` while preserving user keys, creates `.bak`; `uninstall.sh` removes hooks + `.bak` + flag + ELI entries while preserving user keys
  - `test/e2e/install-uninstall.ps1.test.js` — scaffold; skipped on non-Windows

- **Layer 4 — PBT / Fuzz (2 tests)**
  - `test/fuzz/sequence.test.js` (500 runs) — for any sequence of 1-20 whitelist commands, final flag is either absent or in `VALID_MODES`
  - `test/fuzz/input.test.js` (300 runs) — `eli-mode-tracker.js` exits cleanly (code 0, no error) for any stdin content (strings, unicode, integers, arrays)

**Infrastructure**
- New `test/helpers/isolated-env.js` isolates `CLAUDE_CONFIG_DIR` + `XDG_CONFIG_HOME` per test via `fs.mkdtempSync`; metadata and flag writes cannot pollute the user's real `~/.config/eli/` or `~/.claude/`
- Root `package.json` pins `"type":"commonjs"` (matches `hooks/package.json`), adds `npm test` script and `fast-check@^3.23.0` dev-dep

**Hard constraints honored** — no source refactor, no security-invariant relaxation, no stage-CLI changes, no SKILL.md edits, no CI workflow (deferred to v0.9.1), no auto git tag / merge / push.
