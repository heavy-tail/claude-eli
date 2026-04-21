---
name: dummies-stats
description: >
  Display the user's Dummies evolution progress card — current stage, install date,
  session count, prompt count, and a stage-appropriate suggestion. Trigger: /dummy-stats,
  "dummy stats", "내 진화", "what's my progress". One-shot; does NOT change the stage.
---

# Dummies Stats

One-shot. Read metadata and render the progress card.

## Data source

Read `~/.config/dummies/metadata.json` (XDG respected; Windows: `%APPDATA%/dummies/metadata.json`).

Shape:
```json
{
  "installedAt": "2026-04-21T08:10:00Z",
  "sessionCount": 42,
  "totalPrompts": 420,
  "lastSessionAt": "...",
  "stageHistory": [{ "from": "kid", "to": "adult", "at": "..." }]
}
```

Current stage comes from the SessionStart context (the `DUMMIES MODE ACTIVE — current stage: X` line).

## Format

Render exactly this shape (adjust emoji + number to match current stage):

```
[badge] Dummies stats

Current stage: [name] ([N]/3)
Installed: [days since installedAt, or "today"]
Sessions: [sessionCount]
Prompts: [totalPrompts]

Next stage: [stage+1 name + emoji, or "you're at Adult — try `/dummy off` for uncut Claude"]
Suggested: [see rules below]
```

## Stage → suggestion

| Current | Suggestion |
|---------|-----------|
| 1 👶 Baby | "Baby — bottom line + 한 줄 요약. Try `/dummy harder` when you want causes and options." |
| 2 🧒 Kid | "Kid — summary across 4-5 axes (the sweet spot). Try `/dummy harder` for trade-offs and edge cases." |
| 3 🎓 Adult | "Adult — full bookended answer with diagrams. For uncut Claude, use `/dummy off`." |

## Edge cases

- **First session / no data yet**: render a minimal card and add: "Installed today — more stats show once you've used it a while."
- **sessionCount < 2**: omit the "Prompts" line (not informative yet).
- **Current stage unknown** (shouldn't happen): say "Dummies is off. Run `/dummy on` to start."

## Important

- **Do NOT change the stage.** No flag writes.
- Render in the current stage's style — Baby/Kid may include a brief analogy if natural; Adult stays clean with a TL;DR + body.
- `ⓘ analogy ≈` footnote after any stats-related analogy (e.g. "like a pet game where your companion grows with you ⓘ analogy ≈").
