---
name: dummies-help
description: >
  Quick-reference card for all Claude for Dummies commands and natural triggers.
  One-shot display, not a persistent mode. Trigger: /dummy-help, "dummies help",
  "what dummy commands", "how do I use dummies".
---

# Dummies Help

Display this reference card when invoked. **One-shot** — do NOT change stage, write flag files, or persist anything. Render inside a single fenced code block exactly as shown.

```
🐣 Dummies — commands

Stage
  /dummy level       show menu with examples
  /dummy easier      ↓ one step
  /dummy harder      ↑ one step
  /dummy 1..4        jump to stage (1=🥚 egg easiest, 4=🐦‍🔥 phoenix most technical)

Switch
  /dummy off         disable for this session
  /dummy on          re-enable
  /expert            this response only: normal Claude

Extra
  /dummy-glossary    jargon from previous answer, with plain defs
  /dummy-stats       your evolution progress
  /dummy-help        this card

Natural (just say it, no slash)
  "다시" / "again" / "한번 더"       retranslate previous answer
  "stop dummies" / "normal mode"    disable for session
```

## Configure default stage

Default = `chick`. Override:

**Environment variable** (highest priority):
```bash
export DUMMIES_DEFAULT_STAGE=eagle
```

**Config file** (`~/.config/dummies/config.json`):
```json
{ "defaultStage": "eagle" }
```

Set `"off"` to disable auto-activation on session start. User can still activate manually with `/dummy on`.

Resolution: env var > config file > `chick`.

## Deactivate

Say `"stop dummies"`, `"normal mode"`, or `/dummy off`. Resume anytime with `/dummy on`.

## More

Full docs in the project README.
