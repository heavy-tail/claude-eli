# Claude ELI

> Explain like I'm ___. Pick your level (3, 10, or 25) and Claude organizes every answer for that depth.

Claude ELI cuts the **"explain it again, but easier"** loop. The mission is simple: **help you understand** every answer the first time. Pick the depth — 👶 Baby (ELI 3), 🧒 Kid (ELI 10), or 🎓 Adult (ELI 25) — and Claude organizes the answer around what you actually need to decide. Code, commands, URLs, paths, errors, warnings — preserved verbatim at every stage. Always on.

For vibecoders, beginners, PMs who code, or anyone tired of re-prompting Claude for a TL;DR.

---

## Before / After

**You ask:** *Why did only 58 of my 2,207 restaurants pass the price filter?*

<table>
<tr>
<th>Default Claude (full answer)</th>
<th>Claude ELI — 🧒 Kid (default)</th>
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

Three stages differ in **depth only, not quality** — all three fully help you understand, just with different context depth.

| # | Badge | Stage | ≈ ELI | What you get |
|---|-------|-------|-------|--------------|
| 1 | 👶 | **Baby** | ELI 3 | Bottom line. 3 axes max (result / cause / action), ends with "한 줄 요약". 5-10 lines. |
| 2 | 🧒 | **Kid** *(default)* | ELI 10 | Summary. 4-5 axes, 2-3 bullets each, ends with "한 줄 요약". 15-25 lines. |
| 3 | 🎓 | **Adult** | ELI 25 | Full, bookended. TL;DR at top + body with trade-offs + "한 줄 정리". Diagrams expected. 30-60 lines. |

Want fully uncut Claude? `/eli off`.

What every stage does equally well — the **North Star**:

> **Help you understand.** Include the core + anything important for the decision (Completeness). Cover every axis you need to decide — result, cause, action, trade-off, check (MECE). Everyday words. One-line summary at the end. Analogies when they beat plain prose. Diagrams when they clarify.

Tables, arrows, funnels, analogies — all welcome **when they help you understand faster**, not when they look thorough.

---

## Install

Claude Code:

```bash
claude plugin marketplace add heavy-tail/claude-eli
claude plugin install eli@eli
```

Restart Claude Code. Default ON — no further commands needed.

---

## Commands

```
Stage
  /eli level       show menu
  /eli easier      ↓ one step (more compressed)
  /eli harder      ↑ one step (more detail)
  /eli 1..3        jump to stage (1=👶, 2=🧒 default, 3=🎓)

Switch
  /eli off         disable for this session (= uncut Claude)
  /eli on          re-enable
  /expert            this response only: full technical mode

Extra
  /eli-glossary    jargon from previous answer with plain defs
  /eli-stats       your evolution progress
  /eli-help        this card
```

### Natural triggers (no slash needed)

| You say | What happens |
|---------|--------------|
| `다시` / `again` / `한번 더` / `못 알아듣겠어` | Re-translate previous answer in current stage |
| `stop eli` / `normal mode` | Disable for this session |
| `eli mode` / `talk like eli` | Re-enable |

---

## What we preserve, exactly

**Code blocks, inline commands, URLs, file paths, env vars, CLI flags, error messages, version numbers, warning sentences — all verbatim. At every stage.** Only the explanatory prose around them gets filtered.

We measure this with regex extraction across every prompt in `evals/prompts/`. Synthetic-snapshot smoke test:

| Arm | code | inline | url | path | env_var | flag | version | error | Overall |
|-----|------|--------|-----|------|---------|------|---------|-------|---------|
| Plain "be terse" control | — | 50% | 0% | 25% | 0% | 100% | 0% | 0% | **25%** |
| **ELI** | — | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** |

Reproduce: `python evals/llm_run.py && python evals/measure.py` (needs `claude` CLI authenticated).

---

## Safety Clarity Mode

When Claude is about to warn you about something dangerous — destructive commands (`rm -rf`, `DROP TABLE`, `force push`), security issues, production-critical actions — ELI **drops the analogy** and keeps the warning verbatim. Statusline shows `[⚠ safety mode]` for that response.

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
export ELI_DEFAULT_STAGE=adult
```

**Config file** (`~/.config/eli/config.json`):

```json
{ "defaultStage": "adult" }
```

Set `"off"` to disable auto-activation entirely (you can still turn it on per-session with `/eli on`).

---

## Privacy & data

Everything stays local:
- Stage flag: `~/.claude/.eli-active`
- Usage stats: `~/.config/eli/metadata.json` (XDG honored; Windows: `%APPDATA%/eli/`)

Nothing leaves your machine. No telemetry, no analytics, no phone-home.

---

## Uninstall

```bash
claude plugin disable eli
rm -rf ~/.config/eli/
```

That's it.

---

## Inspiration

Architecture inspired by [caveman](https://github.com/JuliusBrussee/caveman) (MIT) — same hook + skill plumbing pattern, different goal. caveman compresses *all* prose tokens; ELI **organizes prose around understanding** — around decision axes, with analogies and diagrams where they clarify. See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for what we reused.

## License

MIT. See [`LICENSE`](./LICENSE).
