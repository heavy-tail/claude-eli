# CLAUDE.md — Claude for Dummies (internal dev guide)

For Claude/contributors working on this repo. End-user docs live in `README.md`.

## What this project does

Default-on Claude Code plugin that translates Claude's technical explanations into plain language with analogies, while preserving every code block, command, URL, file path, env var, CLI flag, error message, version number, and warning sentence verbatim.

Four evolution stages, picked by the user — `1 🥚 egg`, `2 🐣 chick` (default), `3 🦅 eagle`, `4 🐦‍🔥 phoenix`. Numeric command interface; emoji + name only on the statusline and inside SKILL.md.

Independent product. Architecture inspired by caveman (MIT) — see `ATTRIBUTION.md`.

## Single source of truth files — edit only these

| File | Controls |
|------|----------|
| `skills/dummies/SKILL.md` | Core dummies behavior — preservation rule, analogy principles, 4 stages, error explanation pattern, Safety Clarity Mode, language handling. The hook reads it at runtime. |
| `rules/dummies-activate.md` | Always-on rule body for non-Claude-Code agents in v2 (Cursor / Windsurf / Cline / Copilot via per-IDE rules dirs). Currently shipped but not auto-synced — v2 work. |
| `skills/dummies-glossary/SKILL.md` | `/dummy-glossary` behavior. |
| `skills/dummies-stats/SKILL.md` | `/dummy-stats` behavior. |
| `skills/dummies-help/SKILL.md` | `/dummy-help` reference card. |

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
│   ├── dummy.toml           # /dummy <arg>
│   ├── dummy-glossary.toml
│   ├── dummy-help.toml
│   ├── dummy-stats.toml
│   └── expert.toml
├── evals/
│   ├── prompts/en.txt       # 15 vibecoder pain prompts
│   ├── llm_run.py           # Claude API runner (3-arm: baseline / terse / each skill)
│   ├── measure.py           # preservation rate measurement (8 artifact kinds)
│   ├── plot.py              # caveman's plotter, kept for parity
│   └── snapshots/           # results.json — committed when regenerated
├── hooks/
│   ├── dummies-activate.js
│   ├── dummies-mode-tracker.js
│   ├── dummies-config.js    # shared module
│   ├── dummies-statusline.sh / .ps1
│   ├── install.sh / .ps1    # standalone installer
│   ├── uninstall.sh / .ps1
│   ├── package.json         # CJS pin
│   └── README.md            # hooks-specific docs
├── rules/
│   └── dummies-activate.md  # v2 always-on rule (not yet wired into per-IDE dirs)
└── skills/
    ├── dummies/             # main skill
    ├── dummies-glossary/    # sub-skill
    ├── dummies-stats/       # sub-skill
    └── dummies-help/        # sub-skill
```

## Hook system (Claude Code)

Two hooks plus one shared module and a CJS pin. Communicate via flag file at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.dummies-active`.

```
SessionStart hook ──writes stage──▶ .dummies-active ◀──updates stage── UserPromptSubmit hook
                                          │
                                       reads
                                          ▼
                                  dummies-statusline.sh
                                  [1 🥚 dummies] / [2 🐣 dummies] / ...
```

### `dummies-activate.js` (SessionStart)

1. Reads `getDefaultMode()` (env > config.json > 'chick'). If `'off'`, removes the flag and exits.
2. Writes the stage to the flag file via `safeWriteFlag` (symlink-safe, atomic, 0600).
3. Calls `recordSession()` — sets `installedAt` on first run, increments `sessionCount`.
4. Reads `skills/dummies/SKILL.md` and emits the body (frontmatter stripped) as stdout. Claude Code injects this as system context.
5. If no SKILL.md is found (standalone install without `skills/`), falls back to a hardcoded minimum ruleset embedded in the file.
6. Detects missing `statusLine` config and appends a setup nudge.

Silent-fails on filesystem errors. Never blocks session start.

### `dummies-mode-tracker.js` (UserPromptSubmit)

Per turn:

1. `recordPrompt()` (cheap; writes `~/.config/dummies/metadata.json`).
2. If prompt starts with `/expert`: skip reinforcement, return (SKILL.md handles `/expert`).
3. Snapshot stage before parsing.
4. Natural-language deactivation (`stop dummies`, `normal mode`): unlink flag.
5. Natural-language activation: write `getDefaultMode()` to flag.
6. Slash-command parsing: `/dummy off|on|easier|harder|1|2|3|4` → mutate flag. Stage names (`egg`, `chick`, ...) **not accepted** as args — numeric only.
7. Sub-skill commands (`/dummy-glossary`, `/dummy-stats`, `/dummy-help`) don't change stage.
8. Detect transition vs snapshot. If changed, `recordStageChange(before, after)` and prepend a `STAGE CHANGE: N old → N new (upgrade|downgrade|activate)` line to `additionalContext`.
9. Per-turn reinforcement: emit `DUMMIES MODE ACTIVE (stage: X)` plus the preservation reminder + neutrality reminder via `hookSpecificOutput.additionalContext`.

### `dummies-config.js`

Shared module exporting:

- `getDefaultMode`, `getConfigDir`, `getConfigPath`, `VALID_MODES`
- `safeWriteFlag(flagPath, content)` — see security notes
- `readFlag(flagPath)` — symlink-safe, 64-byte cap, whitelist-validated. Returns `null` on any anomaly. **Never inject untrusted bytes into model context.**
- `getMetadataPath`, `readMetadata`, `writeMetadata`
- `recordSession`, `recordPrompt`, `recordStageChange` — best-effort metadata.

Security: the flag file at `~/.claude/.dummies-active` is a predictable path. Without symlink guards, a local attacker with write access could replace it with a symlink to `~/.ssh/id_rsa` (or any user-readable secret) and have every reader (statusline, mode-tracker reinforcement) slurp those bytes into the terminal or model context. `safeWriteFlag` and `readFlag` enforce the gauntlet — symlink refusal at target and immediate parent, `O_NOFOLLOW`, atomic temp+rename, size cap, value whitelist. Don't bypass these for any new flag-style file.

### `dummies-statusline.sh` / `.ps1`

Reads the flag, applies the same symlink + size + whitelist guards, and prints `[1 🥚 dummies]` style badge in green.

## Skill system

Skills are Markdown files with YAML frontmatter consumed by Claude Code's skill/plugin system. The `name` and `description` fields drive discovery; the body is the instruction the model loads when the skill is active.

Stages are **not** independent skills — they're intensity levels of one skill. `dummies-glossary`, `dummies-stats`, `dummies-help` are independent skills (one-shot; don't change the stage).

## Slash commands (TOML)

Each `/command` is a `commands/<name>.toml` file with `description`, optional `argument-hint`, and `prompt`. Claude Code surfaces them in autocomplete; when invoked, the `prompt` (with `{{args}}` substitution) becomes the model's instruction for that turn. Hooks fire in parallel for the same prompt.

## Build-time defaults (configurable in code, not user-facing)

| Field | Value | Where |
|-------|-------|-------|
| Default stage | `chick` | `dummies-config.js` `getDefaultMode()` final return |
| Stage history cap | 100 | `dummies-config.js` `MAX_STAGE_HISTORY` |
| Flag size cap | 64 bytes | `dummies-config.js` `MAX_FLAG_BYTES` |
| Hook timeout | 5 s | `.claude-plugin/plugin.json` |

## Evals

`evals/llm_run.py` runs `claude -p` for each prompt × each arm (baseline, terse control, each skill) and writes `evals/snapshots/results.json`. Real Claude API; needs `claude` CLI authenticated.

`evals/measure.py` reads the snapshot and reports:

1. **Output length delta vs baseline** per arm (Dummies should be longer; terse shorter).
2. **Preservation rate** per arm per artifact kind: `code_block`, `inline_code`, `url`, `path`, `env_var`, `flag`, `version`, `error`. The artifact set is extracted from the baseline answer (the natural full-technical answer); preservation = fraction that appears verbatim as substrings in the arm's answer.

Dummies should hit ~100% on every preservation kind. terse should drop substantially. The synthetic-snapshot smoke test in commit `1c1fac8` confirms the math.

## Honesty rules

- **Preservation must stay near 100%.** If you change SKILL.md and the eval drops below ~95% on any kind, that's a regression — fix the rule before merging.
- **Analogy humility footnote (`ⓘ analogy ≈`) stays.** It signals that analogies are approximations and is part of the product's trust posture.
- **Safety Clarity Mode keywords need context confirmation.** Single keywords like `password`, `production`, `token` show up in normal questions all the time. The rule is "drop analogies + preserve verbatim **only when the surrounding context confirms a destructive or security-sensitive scenario**."
- **No telemetry.** Metadata stays local at `~/.config/dummies/`. Don't add any phone-home.

## Release process

1. Bump version (none yet — v0.1.0 is the first release).
2. Run `python evals/llm_run.py` (real Claude run) and `python evals/measure.py` to refresh snapshot + table.
3. Update README's preservation table with the latest numbers if material.
4. Run install→commands→uninstall smoke test in a clean `CLAUDE_CONFIG_DIR`.
5. Commit, tag, push.
6. `claude plugin marketplace add <user>/claude-for-dummies` works against the `main` branch.

## Things to leave alone (without thought)

- The `safeWriteFlag` / `readFlag` invariants (security).
- The `package.json` `{"type": "commonjs"}` pin (interop).
- The `STAGES_BY_NUMBER` mapping in `dummies-mode-tracker.js` — numeric command interface is a deliberate UX choice; do not accept stage names as args (revives 2-name confusion).
- The Phoenix → no-caveman policy (we're an independent product, not a caveman funnel).

## Inspiration

Hook + skill plumbing pattern adapted from [caveman](https://github.com/JuliusBrussee/caveman) (MIT). What we reused vs what's new is in `ATTRIBUTION.md`.
