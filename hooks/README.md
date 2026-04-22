# Claude ELI — Hooks

These hooks are bundled with the **eli** Claude Code plugin and activate automatically when the plugin is installed. No manual setup required.

If you installed ELI standalone (without the plugin marketplace), use `bash hooks/install.sh` (or `powershell -ExecutionPolicy Bypass -File hooks\install.ps1` on Windows) to wire them into your `settings.json` manually.

## Files

### `eli-activate.js` — SessionStart hook

- Runs once when Claude Code starts a session
- Writes the active stage to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.eli-active`
- Reads `skills/eli/SKILL.md` and emits the full ruleset as hidden SessionStart context (Claude Code injects hook stdout as system context)
- Records session start in `~/.config/eli/metadata.json` (sessionCount + installedAt on first run)
- Detects missing statusline config and emits a setup nudge

### `eli-mode-tracker.js` — UserPromptSubmit hook

- Fires on every user prompt
- Detects `/eli` commands and natural-language triggers, updates the stage flag
- Records every prompt in metadata for `/eli-stats`
- On a stage change, emits a `STAGE CHANGE: ...` line in `additionalContext` so `commands/eli.toml` can render the Level-up! message
- Skips the per-turn reinforcement on `/eli raw` (so Claude can answer normally for that one turn; flag stays unchanged)

### `eli-config.js` — shared module (not a hook)

- `getDefaultMode()` — resolves default stage from `ELI_DEFAULT_STAGE` env var, then `~/.config/eli/config.json`'s `defaultStage` field, then `'kid'`
- `safeWriteFlag(path, content)` — symlink-safe atomic write of the flag file (refuses symlinks, uses `O_NOFOLLOW`, writes `0600`)
- `readFlag(path)` — symlink-safe size-capped whitelist-validated read
- `recordSession() / recordPrompt() / recordStageChange()` — best-effort metadata writes

### `eli-statusline.sh` / `.ps1` — statusline badge

Outputs a colored badge based on the flag value, with per-stage color for at-a-glance recognition:

- `baby` → `[baby 👶 eli]` (cyan — fresh)
- `kid` → `[kid 🧒 eli]` (green — default, steady)
- `adult` → `[adult 🎓 eli]` (yellow/gold — matured)
- `auto` → `[auto ✨ eli]` (magenta — adaptive, Claude picks per question)

Refuses symlinks, caps reads at 64 bytes, and whitelists stage values to block terminal-escape injection through the flag file.

### `package.json`

```json
{ "type": "commonjs" }
```

Pins this directory to CommonJS so `require()` resolves correctly even when an ancestor `package.json` (e.g. `~/.claude/package.json` from another plugin) declares `"type": "module"`.

## Manual install (without `claude plugin`)

```bash
bash hooks/install.sh
```

Installer is idempotent (skips work if hooks are already wired) and accepts `--force` to overwrite. Backs up `settings.json` to `settings.json.bak` before editing. Requires `node`.

## Manual uninstall

```bash
bash hooks/uninstall.sh
```

Removes the hook files, the flag file, and the eli entries from `settings.json`.

## Statusline config

The installer writes this to your `settings.json` automatically. If you already have a custom statusline, the installer **does not** overwrite it — see `eli-statusline.sh` and merge the badge into your existing line manually.

## Environment

- `CLAUDE_CONFIG_DIR` — alternative location for `~/.claude` (respected by all scripts)
- `XDG_CONFIG_HOME` — alternative location for `~/.config` (used for `~/.config/eli/`)
- `ELI_DEFAULT_STAGE` — overrides the default stage (`baby|kid|adult|auto|off`)

## Inspiration

Hook architecture borrowed from [caveman](https://github.com/JuliusBrussee/caveman) (MIT). See the project root `ATTRIBUTION.md` for what we reused.
