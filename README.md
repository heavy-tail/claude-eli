# Claude ELI

![tests](https://img.shields.io/badge/tests-passing-brightgreen)

> Explain like I'm ___. Pick your level (3, 10, or 25) and Claude organizes every answer for that depth.

Claude ELI cuts the **"explain it again, but easier"** loop. The mission is simple: **help you understand** every answer the first time. Pick a stage on the simplification axis — 🎓 Adult (lossless, every detail kept), 🧒 Kid (strongly simplified, default), or 👶 Baby (second-pass essence) — and Claude organizes the answer around what you actually need to decide. Visual aids (analogies + diagrams) default ON. Code, commands, URLs, paths, errors, warnings — preserved verbatim at every stage. Always on.

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

Four stages on a single axis: **simplification strength × passes**. Each stage is defined by the prompt that would produce its answer from raw Claude.

| Badge | Stage | What it is | Length vs raw |
|-------|-------|-----------|---------------|
| 🎓 | **adult** | "이해하기 쉽게 설명해줘" × 1, **lossless** — every fact in raw preserved + visual structure (table / decision tree / flow) + Frame at top + TL;DR at bottom | ≥ raw |
| 🧒 | **kid** *(default)* | "아주 쉽게 설명해줘" × 1 — strong simplification, drop nuance OK, recommended path flagged ("처음이면 이거") | usually ≤ raw |
| 👶 | **baby** | "아주 쉽게 설명해줘" × 2 (internal 2-pass) — kid-quality answer mentally, then "더 쉽게" pass, output only the second pass: single dominant analogy + single concrete action | shortest |
| ✨ | **auto** | Claude picks adult / kid / baby per question. "쉽게" / "초보" → baby; "production / architecture / trade-offs" → adult; everything else → kid | varies |

**Visual aids (analogies + diagrams) are default ON at every stage.** Skip only for: (1) yes/no answer, (2) single-line answer, (3) pure code dump, (4) precise number/threshold IS the answer.

Want one-time raw Claude (no filter)? `/eli raw`. Want to disable for the session? `/eli off`.

The **North Star** — applied to every answer, every stage:

> **Help you understand.** Every ELI answer must be **obviously** easier than raw Claude on the same question — not subtly tweaked, clearly easier. If your answer reads like raw with cosmetic changes, the stage failed.

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
  /eli level         show menu
  /eli easier        ↓ one step (deeper translation)
  /eli harder        ↑ one step (less translation)
  /eli adult         jump to 🎓 adult ("이해하기 쉽게" ×1, lossless)
  /eli kid           jump to 🧒 kid   ("아주 쉽게" ×1 — default)
  /eli baby          jump to 👶 baby  ("아주 쉽게" ×2, second-pass essence)
  /eli auto          ✨ Claude picks per question

Switch
  /eli off           disable for this session (= uncut Claude)
  /eli on            re-enable
  /eli raw           this response only: raw Claude (no ELI filter)

Extra
  /eli-glossary      jargon from previous answer with plain defs
  /eli-stats         your evolution progress
  /eli-help          this card
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
