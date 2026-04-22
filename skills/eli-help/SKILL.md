---
name: eli-help
description: >
  Quick-reference card for all Claude ELI commands and natural triggers.
  One-shot display, not a persistent mode. Trigger: /eli-help, "eli help",
  "what eli commands", "how do I use eli".
---

# ELI Help

Display this reference card when invoked. **One-shot** — do NOT change stage, write flag files, or persist anything. Render inside a single fenced code block exactly as shown.

```
🧒 ELI — commands

Stage
  /eli level         show menu with examples
  /eli easier        ↓ one step (more compressed translation)
  /eli harder        ↑ one step (less translation)
  /eli baby          jump to 👶 baby  (deepest translation)
  /eli kid           jump to 🧒 kid   (light translation — default)
  /eli adult         jump to 🎓 adult (near-raw but clearer than raw)
  /eli auto          ✨ Claude picks baby/kid/adult per question

Switch
  /eli off           disable for this session (= uncut Claude)
  /eli on            re-enable
  /eli raw           this response only: raw Claude (no ELI filter)

Extra
  /eli-glossary      jargon from previous answer with plain defs
  /eli-stats         your evolution progress
  /eli-help          this card

Natural (just say it, no slash)
  "다시" / "again" / "한번 더"     re-translate previous answer
  "stop eli" / "normal mode"       disable for session
  "eli mode" / "talk like eli"     re-enable
```

## Configure default stage

Default = `kid`. Override:

**Environment variable** (highest priority):
```bash
export ELI_DEFAULT_STAGE=adult
```

Valid values: `baby`, `kid`, `adult`, `auto`, `off`.

**Config file** (`~/.config/eli/config.json`):
```json
{ "defaultStage": "auto" }
```

Set `"off"` to disable auto-activation on session start. User can still activate manually with `/eli on`.

Resolution: env var > config file > `kid`.

## Deactivate

Say `"stop eli"`, `"normal mode"`, or `/eli off`. Resume anytime with `/eli on`.

## More

Full docs in the project README.
