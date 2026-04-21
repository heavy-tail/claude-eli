# Attribution

Claude for Dummies is based on the structure of [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee, released under the MIT License.

caveman's hook architecture, multi-agent install scripts, and eval harness were invaluable references. Our project mirrors the plumbing (scaffolding, hooks, installers, eval framework) but pursues a different goal: caveman makes Claude terse; Claude for Dummies organizes Claude's answers so the user understands them on the first pass — around decision axes, with analogies and diagrams where they clarify, and code preserved verbatim.

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

- SKILL.md instruction content (North Star mission + 6 understanding principles)
- Analogy library (concept → metaphor mapping, culturally neutral)
- Three understanding-depth stages (Baby / Kid / Adult) unified by the North Star: help the user understand
- Question-form axis naming + diagram-first patterns (tables, funnels, cause trees)
- Safety Clarity Mode (preserve verbatim on security warnings)
- Code preservation measurement (AST diff + URL/path/flag/error checks)

## License

This project is licensed under MIT (same as caveman). See `LICENSE`.
