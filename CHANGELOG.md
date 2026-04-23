# Changelog

All notable changes to Claude ELI.

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
