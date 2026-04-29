# CLAUDE.md — Claude ELI (internal dev guide)

For Claude/contributors working on this repo. End-user docs live in `README.md`.

## What this project does

Default-on Claude Code plugin that cuts the "explain it again, but easier" loop. **Mission: help the user understand** — every answer must be **obviously** easier to understand than raw Claude on the same question. Code, commands, URLs, paths, env vars, CLI flags, errors, warnings, plan files — preserved verbatim at every stage.

Four stages on a single axis: **simplification strength × passes**. Each stage is defined by the prompt that would produce its answer from raw Claude:
- `🎓 adult` — "이해하기 쉽게 설명해줘" × 1, **lossless** (every fact in raw preserved + visual structure)
- `🧒 kid` (default) — "아주 쉽게 설명해줘" × 1 (drop nuance OK, recommended path flagged)
- `👶 baby` — "아주 쉽게 설명해줘" × 2 (internal 2-pass — kid output → "더 쉽게" → output only second pass)
- `✨ auto` — Claude picks adult/kid/baby per question

For one-time raw Claude, `/eli raw`. To disable for the session, `/eli off`. Stage-name-only command interface; emoji + name on the statusline.

**Visual aids (analogies + diagrams) are default ON at every stage.** Skip only for: (1) yes/no answer, (2) single-line answer, (3) pure code dump, (4) precise number/threshold IS the answer. The model's instinct to skip visuals was the largest single failure mode in v0.9.x dogfood — v1.0 makes "default ON" a hard system rule.

LEVEL-1 invariants (Preservation + Code quality stage-independence) hold at every stage. Stage controls explanation depth ONLY — never code quality.

Independent product. Architecture inspired by caveman (MIT) — different axis: caveman compresses all prose, we organize prose for understanding. See `ATTRIBUTION.md`.

## Single source of truth files — edit only these

| File | Controls |
|------|----------|
| `skills/eli/SKILL.md` | Core eli behavior — North Star mission, single-axis 4-stage spec (simplification strength × passes), visual aids default ON, LEVEL-1 invariants (preservation + code quality stage-independence), error pattern, Safety Clarity Mode, plan-mode integration, language handling. The hook reads it at runtime. |
| `rules/eli-activate.md` | Always-on rule body for non-Claude-Code agents in v2 (Cursor / Windsurf / Cline / Copilot via per-IDE rules dirs). Currently shipped but not auto-synced — v2 work. |
| `skills/eli-glossary/SKILL.md` | `/eli-glossary` behavior. |
| `skills/eli-stats/SKILL.md` | `/eli-stats` behavior. |
| `skills/eli-help/SKILL.md` | `/eli-help` reference card. |

## File structure

```
.
├── .claude-plugin/
│   ├── plugin.json          # Claude Code plugin metadata + hook registrations
│   └── marketplace.json     # marketplace listing
├── .codex/
│   ├── hooks.json           # Codex SessionStart trigger (placeholder for v2 expansion)
│   └── config.toml
├── .gitignore
├── ATTRIBUTION.md           # caveman credits + reuse map
├── CLAUDE.md                # this file
├── LICENSE                  # MIT
├── README.md                # user-facing
├── benchmarks/              # caveman's harness, structure preserved (v2 work)
├── commands/
│   ├── eli.toml           # /eli <arg>
│   ├── eli-glossary.toml
│   ├── eli-help.toml
│   ├── eli-stats.toml
│   └── eli-raw.toml
├── evals/
│   ├── prompts/en.txt       # 15 vibecoder pain prompts
│   ├── llm_run.py           # Claude API runner (3-arm: baseline / terse / each skill)
│   ├── measure.py           # preservation rate measurement (8 artifact kinds)
│   ├── plot.py              # caveman's plotter, kept for parity
│   └── snapshots/           # results.json — committed when regenerated
├── hooks/
│   ├── eli-activate.js
│   ├── eli-mode-tracker.js
│   ├── eli-config.js    # shared module
│   ├── eli-statusline.sh / .ps1
│   ├── install.sh / .ps1    # standalone installer
│   ├── uninstall.sh / .ps1
│   ├── package.json         # CJS pin
│   └── README.md            # hooks-specific docs
├── rules/
│   └── eli-activate.md  # v2 always-on rule (not yet wired into per-IDE dirs)
└── skills/
    ├── eli/             # main skill
    ├── eli-glossary/    # sub-skill
    ├── eli-stats/       # sub-skill
    └── eli-help/        # sub-skill
```

## Hook system (Claude Code)

Two hooks plus one shared module and a CJS pin. Communicate via flag file at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.eli-active`.

```
SessionStart hook ──writes stage──▶ .eli-active ◀──updates stage── UserPromptSubmit hook
                                          │
                                       reads
                                          ▼
                                  eli-statusline.sh
                                  [eli baby 👶] / [eli kid 🧒] / [eli adult 🎓] / [eli auto ✨]
```

### `eli-activate.js` (SessionStart)

1. Reads `getDefaultMode()` (env > config.json > 'kid'). If `'off'`, removes the flag and exits.
2. Writes the stage to the flag file via `safeWriteFlag` (symlink-safe, atomic, 0600).
3. Calls `recordSession()` — sets `installedAt` on first run, increments `sessionCount`.
4. Reads `skills/eli/SKILL.md` and emits the body (frontmatter stripped) as stdout. Claude Code injects this as system context.
5. If no SKILL.md is found (standalone install without `skills/`), falls back to a hardcoded minimum ruleset embedded in the file.
6. Detects missing `statusLine` config and appends a setup nudge.

Silent-fails on filesystem errors. Never blocks session start.

### `eli-mode-tracker.js` (UserPromptSubmit)

Per turn:

1. `recordPrompt()` (cheap; writes `~/.config/eli/metadata.json`).
2. If prompt starts with `/eli raw`: skip reinforcement, return (commands/eli-raw.toml handles the bypass behavior; flag stays unchanged).
3. Snapshot stage before parsing.
4. Natural-language deactivation (`stop eli`, `normal mode`): unlink flag.
5. Natural-language activation: write `getDefaultMode()` to flag.
6. Slash-command parsing: `/eli off|on|easier|harder|baby|kid|adult` → mutate flag. Numeric aliases (`/eli 1|2|3`) were removed in v0.5 in favor of stage-name-only args; with three consistently-named stages the numbers added no value.
7. Sub-skill commands (`/eli-glossary`, `/eli-stats`, `/eli-help`) don't change stage.
8. Detect transition vs snapshot. If changed, `recordStageChange(before, after)` and prepend a `STAGE CHANGE: N old → N new (upgrade|downgrade|activate)` line to `additionalContext`.
9. Per-turn reinforcement: emit `ELI MODE ACTIVE (stage: X)` plus the preservation reminder + neutrality reminder via `hookSpecificOutput.additionalContext`.

### `eli-config.js`

Shared module exporting:

- `getDefaultMode`, `getConfigDir`, `getConfigPath`, `VALID_MODES`
- `safeWriteFlag(flagPath, content)` — see security notes
- `readFlag(flagPath)` — symlink-safe, 64-byte cap, whitelist-validated. Returns `null` on any anomaly. **Never inject untrusted bytes into model context.**
- `getMetadataPath`, `readMetadata`, `writeMetadata`
- `recordSession`, `recordPrompt`, `recordStageChange` — best-effort metadata.

Security: the flag file at `~/.claude/.eli-active` is a predictable path. Without symlink guards, a local attacker with write access could replace it with a symlink to `~/.ssh/id_rsa` (or any user-readable secret) and have every reader (statusline, mode-tracker reinforcement) slurp those bytes into the terminal or model context. `safeWriteFlag` and `readFlag` enforce the gauntlet — symlink refusal at target and immediate parent, `O_NOFOLLOW`, atomic temp+rename, size cap, value whitelist. Don't bypass these for any new flag-style file.

### `eli-statusline.sh` / `.ps1`

Reads the flag, applies the same symlink + size + whitelist guards, and prints `[eli baby 👶]` (cyan) / `[eli kid 🧒]` (green) / `[eli adult 🎓]` (yellow/gold) / `[eli auto ✨]` (magenta) style badges. Color varies per stage for quicker at-a-glance recognition. Reading order is "ELI → explain like I'm → [stage]", with the emoji as a visual suffix reinforcing the stage name.

## Skill system

Skills are Markdown files with YAML frontmatter consumed by Claude Code's skill/plugin system. The `name` and `description` fields drive discovery; the body is the instruction the model loads when the skill is active.

Stages are **not** independent skills — they're intensity levels of one skill. `eli-glossary`, `eli-stats`, `eli-help` are independent skills (one-shot; don't change the stage).

## Slash commands (TOML)

Each `/command` is a `commands/<name>.toml` file with `description`, optional `argument-hint`, and `prompt`. Claude Code surfaces them in autocomplete; when invoked, the `prompt` (with `{{args}}` substitution) becomes the model's instruction for that turn. Hooks fire in parallel for the same prompt.

## Build-time defaults (configurable in code, not user-facing)

| Field | Value | Where |
|-------|-------|-------|
| Default stage | `kid` | `eli-config.js` `getDefaultMode()` final return |
| Stage history cap | 100 | `eli-config.js` `MAX_STAGE_HISTORY` |
| Flag size cap | 64 bytes | `eli-config.js` `MAX_FLAG_BYTES` |
| Hook timeout | 5 s | `.claude-plugin/plugin.json` |

## Evals

`evals/llm_run.py` runs `claude -p` for each prompt × each arm (baseline, terse control, each skill) and writes `evals/snapshots/results.json`. Real Claude API; needs `claude` CLI authenticated.

`evals/measure.py` reads the snapshot and reports:

1. **Output length delta vs baseline** per arm (ELI should be longer; terse shorter).
2. **Preservation rate** per arm per artifact kind: `code_block`, `inline_code`, `url`, `path`, `env_var`, `flag`, `version`, `error`. The artifact set is extracted from the baseline answer (the natural full-technical answer); preservation = fraction that appears verbatim as substrings in the arm's answer.

ELI should hit ~100% on every preservation kind. terse should drop substantially. The synthetic-snapshot smoke test in commit `1c1fac8` confirms the math.

## Honesty rules

- **Preservation must stay near 100%.** If you change SKILL.md and the eval drops below ~95% on any kind, that's a regression — fix the rule before merging.
- **Analogy humility footnote (`ⓘ analogy ≈`) stays.** It signals that analogies are approximations and is part of the product's trust posture.
- **Safety Clarity Mode keywords need context confirmation.** Single keywords like `password`, `production`, `token` show up in normal questions all the time. The rule is "drop analogies + preserve verbatim **only when the surrounding context confirms a destructive or security-sensitive scenario**."
- **No telemetry.** Metadata stays local at `~/.config/eli/`. Don't add any phone-home.

## Release process

1. Bump version (none yet — v0.1.0 is the first release).
2. Run `python evals/llm_run.py` (real Claude run) and `python evals/measure.py` to refresh snapshot + table.
3. Update README's preservation table with the latest numbers if material.
4. Run install→commands→uninstall smoke test in a clean `CLAUDE_CONFIG_DIR`.
5. Commit, tag, push.
6. `claude plugin marketplace add <user>/claude-eli` works against the `main` branch.

## Things to leave alone (without thought)

- The `safeWriteFlag` / `readFlag` invariants (security).
- The `package.json` `{"type": "commonjs"}` pin (interop).
- The stage-name-only command interface (`/eli baby|kid|adult|auto`) — v0.5 dropped numeric aliases (`/eli 1|2|3`), v0.7 added `auto` as a fourth stage. Don't re-add numbers as args.
- **No rigid length / axis-count rules.** v0.7 replaced fixed line-count rules with judgment criteria; v1.0 took it further to a single axis (simplification strength × passes). Don't reintroduce per-stage length ceilings — adult is `≥ raw` (lossless), kid is `usually ≤ raw`, baby is `shorter than kid almost always` because of the second-pass compression. Length is the outcome, not the input.
- The summary-at-bottom rule — all summaries at the bottom of every answer (not top, not both). v0.7 dropped bookending. Reason: in CLI the last line is first-visible on scroll-up, which makes the bottom the right place for the reinforcement read. Also applies to plan-mode summaries (v0.6). Don't "helpfully" move them to the top.
- `/eli raw` replacing `/expert` (v0.7) — `/expert` collided with `/export` autocomplete and "expert mode" as a name was ambiguous. `/eli raw` ("raw Claude, no filter") is semantically clearer and keeps every slash under the `/eli*` prefix. Don't add `/expert` back as an alias.
- The independent-product stance — we're not a caveman funnel; no "graduate to caveman" copy anywhere.

## Inspiration

Hook + skill plumbing pattern adapted from [caveman](https://github.com/JuliusBrussee/caveman) (MIT). What we reused vs what's new is in `ATTRIBUTION.md`.
