# Claude for Dummies

> Always on. One command away. No questions needed.

Claude explains technical answers in plain language with analogies — while leaving every line of code, every command, every URL, every error message **exactly the way Claude wrote it**.

If you're a vibecoder, a beginner, a PM who codes occasionally, or anyone who's tired of nodding along to "fluid compute" without really getting it — this is for you.

---

## Before / After

**You ask:** *How do I deploy this Next.js app to Vercel?*

<table>
<tr>
<th>Default Claude</th>
<th>Claude for Dummies</th>
</tr>
<tr>
<td valign="top">

> Run `vercel deploy` from your project root. This triggers a build using your `vercel.ts` config and deploys to Vercel's edge network. For production, use `vercel --prod`. Make sure your environment variables are configured in the Vercel dashboard or via `vercel env`.

</td>
<td valign="top">

> Run `vercel deploy` from your project root.
>
> Think of it as putting your sign on a street corner — people can walk by and see your site. The build uses your `vercel.ts` config and uploads to Vercel's network. For the real version (not a test), use `vercel --prod`.
>
> Keep secrets (passwords, API keys) out of your code — set them in the Vercel dashboard. Those are called environment variables. ⓘ analogy ≈

</td>
</tr>
</table>

**The code stays exactly the same. Only the explanation changes.**

---

## Install

Claude Code:

```bash
claude plugin marketplace add wchun26/claude-for-dummies
claude plugin install dummies@dummies
```

Restart Claude Code. Done. Default ON — no further commands needed.

---

## How it works

Three layers, all automatic:

1. **A SessionStart hook** loads the dummies ruleset on every Claude Code session.
2. **A UserPromptSubmit hook** detects `/dummy` commands and quietly tracks your stage.
3. **A statusline badge** shows your current stage at a glance: `[2 🐣 dummies]`.

You don't have to think about any of it. Just talk to Claude like normal.

When you want a one-off normal-Claude answer, type `/expert`. Stage stays put for the next response.

---

## Evolution stages

Pick how much you want translated. Default is **Chick** (analogy + key term).

| # | Badge | Stage | What you see |
|---|-------|-------|--------------|
| 1 | 🥚 | **Egg** | Pure analogy, no jargon. *"a kitchen shared by many cooks"* |
| 2 | 🐣 | **Chick** | Analogy + key term in parens. *"a shared kitchen (fluid compute)"* — **default** |
| 3 | 🦅 | **Eagle** | Term first, plain gloss. *"fluid compute (shared-server runtime)"* |
| 4 | 🐦‍🔥 | **Phoenix** | Near-original technical prose. |

Switch any time:

```
/dummy 1        # jump to Egg
/dummy easier   # one step easier
/dummy harder   # one step technical
/dummy level    # show the menu
```

When you level up, you'll see a one-time **🎉 Level up!** message. Share your stage if you want.

---

## Commands

```
Stage
  /dummy level       show menu with examples
  /dummy easier      ↓ one step
  /dummy harder      ↑ one step
  /dummy 1..4        jump to stage (1=🥚 easiest, 4=🐦‍🔥 technical)

Switch
  /dummy off         disable for this session
  /dummy on          re-enable
  /expert            this response only: normal Claude

Extra
  /dummy-glossary    jargon from previous answer with plain defs
  /dummy-stats       your evolution progress
  /dummy-help        this card
```

### Natural triggers (no slash needed)

| You say | What happens |
|---------|--------------|
| `다시` / `again` / `한번 더` / `못 알아듣겠어` | Retranslate the previous answer in your current stage |
| `stop dummies` / `normal mode` | Disable for this session |
| `dummies mode` / `talk like dummies` | Re-enable |

These work because Dummies is Default ON — you can keep talking like a human, the plugin keeps the rules going.

---

## What we preserve, exactly

**Code, commands, URLs, file paths, environment variables, CLI flags, error messages, version numbers, warning sentences — all kept verbatim.** Only explanatory prose gets the analogy treatment.

We measure this with a regex-based extractor across every prompt in `evals/prompts/`. Synthetic-snapshot smoke test:

| Arm | code | inline | url | path | env_var | flag | version | error | Overall |
|-----|------|--------|-----|------|---------|------|---------|-------|---------|
| Plain "be terse" control | — | 50% | 0% | 25% | 0% | 100% | 0% | 0% | **25%** |
| **Dummies** | — | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** | **100%** |

Reproduce with `python evals/llm_run.py && python evals/measure.py` (needs `claude` CLI authenticated).

---

## Safety Clarity Mode

When Claude is about to warn you about something dangerous — destructive commands (`rm -rf`, `DROP TABLE`, `force push`), security issues, production-critical actions — Dummies **drops the analogy** and keeps the warning verbatim. The statusline shows `[⚠ safety mode]` for that response.

You won't get cute metaphors when something can wipe your database. That's the rule.

---

## Honesty about analogies

> All analogies are imperfect. Use them as a first step, not the final map.

Each analogy ends with a small `ⓘ analogy ≈` footnote so you know it's an approximation. If you spot a misleading one, please file an issue with the **bad-analogy** tag.

---

## Configure default stage

If Chick isn't your jam, set a different default.

**Environment variable** (highest priority):

```bash
export DUMMIES_DEFAULT_STAGE=eagle
```

**Config file** (`~/.config/dummies/config.json`):

```json
{ "defaultStage": "eagle" }
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

Architecture inspired by [caveman](https://github.com/JuliusBrussee/caveman) (MIT) — same hook + skill plumbing pattern, opposite behavior. See [`ATTRIBUTION.md`](./ATTRIBUTION.md) for what we reused versus what's new.

## License

MIT. See [`LICENSE`](./LICENSE).
