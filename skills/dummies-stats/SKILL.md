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

Next stage: [stage+1 name + emoji, or "you're at Phoenix"]
Suggested: [see rules below]
```

## Stage → suggestion

| Current | Suggestion |
|---------|-----------|
| 1 👶 Baby | "Baby — the tightest filter. TL;DR only. Try `/dummy harder` when you want main causes too." |
| 2 🧒 Kid | "Kid is the sweet spot. Summary + key info. Stay as long as you like; `/dummy harder` for trade-offs." |
| 3 🎓 Adult | "Adult — full structure with options and trade-offs. For uncut Claude, use `/dummy off`." |

## Edge cases

- **First session / no data yet**: render a minimal card and add: "Installed today — more stats show once you've used it a while."
- **sessionCount < 2**: omit the "Prompts" line (not informative yet).
- **Current stage unknown** (shouldn't happen): say "Dummies is off. Run `/dummy on` to start."

## Important

- **Do NOT change the stage.** No flag writes.
- Render in the current stage's style — if Chick, use analogy + term; if Phoenix, technical.
- `ⓘ analogy ≈` footnote after any stats-related analogy (e.g. "like a pet game where your companion grows with you ⓘ analogy ≈").
