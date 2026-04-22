# Launch Checklist — Claude ELI v0.1.0

## Code-side checks (this commit)

- [x] `.claude-plugin/plugin.json` — name `eli`, hooks point to `eli-*.js`, author/description set
- [x] `.claude-plugin/marketplace.json` — name `eli`, listing description set
- [x] `skills/eli/SKILL.md` — full ruleset, North Star mission, 6 principles, 3 stages (Baby/Kid/Adult), preservation rule, Safety Clarity, analogy humility
- [x] 3 sub-skills present — `eli-glossary`, `eli-stats`, `eli-help`
- [x] 5 commands present — `eli.toml`, `eli-glossary.toml`, `eli-stats.toml`, `eli-help.toml`, `eli-raw.toml`
- [x] Hooks renamed and rewired — `eli-activate.js`, `eli-mode-tracker.js`, `eli-config.js`, `eli-statusline.sh/.ps1`
- [x] `install.sh` / `install.ps1` / `uninstall.sh` / `uninstall.ps1` — all reference eli paths and `~/.config/eli/`
- [x] `evals/` — 15 prompts in `prompts/en.txt`, `measure.py` rewritten for preservation rate
- [x] `README.md` — first-fold tagline + Before/After + install + stages + commands + preservation + privacy + footer attribution
- [x] `ATTRIBUTION.md` — caveman credit + reuse map
- [x] `CLAUDE.md` — internal dev guide for contributors
- [x] `LICENSE` — MIT
- [x] `.gitignore` — node_modules / *.log / .env / .DS_Store / pycache

## Local validation (already done — Day 10 smoke test)

- [x] `bash hooks/install.sh` in clean `CLAUDE_CONFIG_DIR` — copies 5 files + wires settings.json + statusline
- [x] `node hooks/eli-activate.js` — reads SKILL.md, strips frontmatter, emits ruleset, writes flag, records session
- [x] `echo '{"prompt":"/eli adult"}' | node hooks/eli-mode-tracker.js` — updates flag to `adult`, emits `STAGE CHANGE` line, records stageHistory
- [x] `bash hooks/eli-statusline.sh` — emits `[eli adult 🎓]` (gold). baby=cyan, kid=green, auto=magenta.
- [x] `echo '{"prompt":"/eli off"}' | node hooks/eli-mode-tracker.js` — deletes flag
- [x] `bash hooks/uninstall.sh` — removes files, settings entries, statusline, .bak

## Pre-publish (manual)

- [x] Repo URL confirmed: `heavy-tail/claude-eli` (WH's GitHub handle) in:
  - `README.md` (install command + footer)
  - `hooks/install.sh` `REPO_URL`
  - `hooks/install.ps1` `$RepoUrl`
  - `hooks/uninstall.sh` (curl URL in usage comment)
  - `hooks/uninstall.ps1` (irm URL in usage comment)
  - `.claude-plugin/plugin.json` `author.url`
  - `.claude-plugin/marketplace.json` `owner.url`
- [ ] Optional: replace `WH` author display name with full name in:
  - `.claude-plugin/plugin.json`
  - `.claude-plugin/marketplace.json`
- [ ] Tag the commit: `git tag -a v0.1.0 -m "v0.1.0 — first release"`
- [ ] Create GitHub repo at the chosen URL
- [ ] `git remote add origin git@github.com:<user>/claude-eli.git`
- [ ] `git push -u origin main --tags`

## Post-publish (manual)

- [ ] Real Claude API eval run: `python evals/llm_run.py && python evals/measure.py` and update README's preservation table with real numbers (currently shows synthetic-snapshot smoke test).
- [ ] Test the marketplace install path on a fresh machine: `claude plugin marketplace add heavy-tail/claude-eli && claude plugin install eli@eli` — confirm SessionStart hook fires and `/eli adult` updates statusline.
- [ ] Friend demo: ask 3-5 vibecoder/PM-coder friends to install and try `/eli level` + ask Claude a question. Capture quotes for README testimonials section (v0.2).

## Marketing / virality (separate workstream)

- [ ] r/vibecoding post draft (WH karma 73 — should clear filter)
- [ ] X / Twitter post — single Before/After screenshot from README
- [ ] Reddit r/ClaudeAI announcement
- [ ] HN Show HN — only after some seed traction (HN suppresses brand-new accounts; build replies first)

## Known v2 deferred items

- Cursor / Windsurf / Cline / Copilot / Gemini adapters (per-IDE rules dirs with always-on frontmatter)
- `caveman.skill`-style ZIP build for `npx skills` agents
- CI sync workflow (single source of truth → all per-agent files)
- `/eli-stats` showing real data after a week of use (right now it shows install-day numbers)
- Bad-analogy issue template + community contribution loop
- Cross-platform binary signing for installers (currently `node` is required)
