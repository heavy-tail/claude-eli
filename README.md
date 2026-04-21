# Claude for Dummies

> Stop asking "explain that easier." Get decision-friendly answers by default.

Claude for Dummies cuts the **"explain it again, but easier"** loop. Instead of long technical answers you have to re-prompt down to a summary, you get the summary first — only the information that actually changes what you do next. Code, commands, URLs, paths, errors, warnings — preserved verbatim. Always on.

For vibecoders, beginners, PMs who code, or anyone tired of re-prompting Claude for a TL;DR.

---

## Before / After

**You ask:** *Why did only 58 of my 2,207 restaurants pass the price filter?*

<table>
<tr>
<th>Default Claude (full answer)</th>
<th>Claude for Dummies — 🧒 Kid (default)</th>
</tr>
<tr>
<td valign="top">

> Looking at your funnel, 2,207 restaurants entered the pipeline. 168 had no URL, leaving 2,039. Of those, 587 failed to fetch (anti-bot blocks, HTTP 404s, crawl4ai fallbacks all failing). 327 more failed at menu page parsing, leaving 1,125. Of those, 516 failed price extraction. 609 had prices extracted. Of those 609, only 58 had `all_prices ≤ $15` confirmed by the LLM, while 493 were marked `residual` (LLM confidence too low for "solo main ≤$15"). Borough breakdown: Manhattan 25, Queens 18, Brooklyn 11, Bronx 4, Staten Island 0. Anti-bot detection is dominant in fetch_failed. Stage 5→6 is the largest drop. Recommended levers: (1) loosen the LLM confidence threshold, (2) add anti-bot bypass via paid services, (3) Google Places URL recovery...

(continues for ~600 more words with tables, options, trade-offs)

</td>
<td valign="top">

> **2.6% (58/2,207). Too few to launch.**
>
> **Two real causes:**
> 1. Sites have anti-bot blocks → ~half of fetches die.
> 2. AI is too strict — 493 had prices extracted but were marked "not confident" and dumped.
>
> **Biggest finding:** those 493. Loosening the AI prompt could push pass count to 200-300.
>
> **Next:** spend a day testing prompt loosening on 20 of those 493 (free). If lift confirmed → re-run on full set.
>
> If that doesn't work, anti-bot bypass (paid, more time) is the next lever.

</td>
</tr>
</table>

**Same data, same code preserved. Just only what you need to decide.**

---

## How it works

Three stages on a **decision-detail axis**:

| # | Badge | Stage | What you get |
|---|-------|-------|--------------|
| 1 | 👶 | **Baby** | TL;DR. Bottom line + 2-4 bullets max. |
| 2 | 🧒 | **Kid** *(default)* | Summary. 5-10 bullets, key facts + main causes + next action. |
| 3 | 🎓 | **Adult** | Standard. Full structure with options, trade-offs, edge cases. |

Want fully uncut Claude? `/dummy off`.

The decision filter applied at every stage:

> **"Does this affect what the user does next?"**
> If yes → include. If no → cut.

Tables, numbers, code — all welcome **when they help you decide faster**, not when they look thorough.

---

## Install

Claude Code:

```bash
claude plugin marketplace add wchun26/claude-for-dummies
claude plugin install dummies@dummies
```

Restart Claude Code. Default ON — no further commands needed.

---

## Commands

```
Stage
  /dummy level       show menu
  /dummy easier      ↓ one step (more dummy)
  /dummy harder      ↑ one step (more detail)
  /dummy 1..3        jump to stage (1=👶, 2=🧒 default, 3=🎓)

Switch
  /dummy off         disable for this session (= uncut Claude)
  /dummy on          re-enable
  /expert            this response only: full technical mode

Extra
  /dummy-glossary    jargon from previous answer with plain defs
  /dummy-stats       your evolution progress
  /dummy-help        this card
```

### Natural triggers (no slash needed)

| You say | What happens |
|---------|--------------|
| `다시` / `again` / `한번 더` / `못 알아듣겠어` | Re-translate previous answer in current stage |
| `stop dummies` / `normal mode` | Disable for this session |
| `dummies mode` / `talk like dummies` | Re-enable |

---

## What we preserve, exactly

**Code blocks, inline commands, URLs, file paths, env vars, CLI flags, error messages, version numbers, warning sentences — all verbatim. At every stage.** Only the explanatory prose around them gets filtered.

We measure this with regex extraction across every prompt in `evals/prompts/`. Synthetic-snapshot smoke test:

| Arm | code | inline | url | path | env_var | flag | version | error | Overall |
|-----|------|--------|-----|------|---------|------|---------|-------|---------|
| Plain "be terse" control | — | 50% | 0% | 25% | 0% | 100% | 0% | 0% | **25%** |
| **Dummies** | — | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** |

Reproduce: `python evals/llm_run.py && python evals/measure.py` (needs `claude` CLI authenticated).

---

## Safety Clarity Mode

When Claude is about to warn you about something dangerous — destructive commands (`rm -rf`, `DROP TABLE`, `force push`), security issues, production-critical actions — Dummies **drops the analogy** and keeps the warning verbatim. Statusline shows `[⚠ safety mode]` for that response.

You won't get cute metaphors when something can wipe your database.

---

## Honesty about analogies

> All analogies are imperfect. Use them as a first step, not the final map.

When we use one (only when it actually helps), we end with a small `ⓘ analogy ≈` footnote. If you spot a misleading one, file an issue with the **bad-analogy** tag.

Analogies are a **tool**, not a goal. We skip them when:
- The answer is mostly code/commands (the code is the answer)
- It's a step-by-step setup (numbered steps clearer than metaphor)
- A precise number/threshold matters (just give the number)

---

## Configure default stage

If Kid isn't your jam, set a different default.

**Environment variable** (highest priority):

```bash
export DUMMIES_DEFAULT_STAGE=adult
```

**Config file** (`~/.config/dummies/config.json`):

```json
{ "defaultStage": "adult" }
```

Set `"off"` to disable auto-activation entirely (you can still turn it on per-session with `/dummy on`).

---

## Privacy & data

Everything stays local:
- Stage flag: `~/.claude/.dummies-active`
- Usage stats: `~/.config/dummies/metadata.json` (XDG honored; Windows: `%APPDATA%/dummies/`)

Nothing leaves your machine. No telemetry, no analytics, no phone-home.

---

## Uninstall

```bash
claude plugin disable dummies
rm -rf ~/.config/dummies/
```

That's it.

---

## Inspiration

Architecture inspired by [caveman](https://github.com/JuliusBrussee/caveman) (MIT) — same hook + skill plumbing pattern, different axis. caveman compresses *all* prose tokens; Dummies filters for **decision-relevant prose** while expanding analogies where they help. See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for what we reused.

## License

MIT. See [`LICENSE`](./LICENSE).
