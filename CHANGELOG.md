# Changelog

All notable changes to Claude ELI.

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
