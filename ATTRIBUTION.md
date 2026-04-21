# Attribution

Claude for Dummies is based on the structure of [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee, released under the MIT License.

caveman's hook architecture, multi-agent install scripts, and eval harness were invaluable references. Our project mirrors the plumbing (scaffolding, hooks, installers, eval framework) but inverts the behavior: caveman makes Claude terse, Claude for Dummies makes Claude's explanations plain-language and analogical while preserving code verbatim.

## What we reuse from caveman

- `hooks/*-activate.js` session-start pattern
- `hooks/*-mode-tracker.js` user-prompt hook pattern
- `hooks/*-config.js` shared config module pattern (including `safeWriteFlag`)
- `hooks/install.sh` / `install.ps1` idempotent settings.json merge
- `hooks/*-statusline.sh` / `.ps1` statusline badge pattern
- `.claude-plugin/plugin.json` marketplace metadata shape
- `.codex/hooks.json` + `.codex/config.toml`
- 3-arm eval harness (`evals/llm_run.py` + `measure.py`)
- Benchmark harness (`benchmarks/run.py`)

## What is fully new

- SKILL.md instruction content (plain-language translation rules)
- Analogy library (concept → metaphor mapping)
- Decision-detail stages (Baby / Kid / Adult) with the decision filter ("Does this affect what the user does next?")
- Safety Clarity Mode (preserve verbatim on security warnings)
- Code preservation measurement (AST diff + URL/path/flag/error checks)

## License

This project is licensed under MIT (same as caveman). See `LICENSE`.
