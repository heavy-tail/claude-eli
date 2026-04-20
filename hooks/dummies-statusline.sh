#!/bin/bash
# Claude for Dummies — statusline badge script for Claude Code
# Reads the dummies stage flag and outputs a colored badge with stage emoji.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/dummies-statusline.sh" }
#
# Plugin users: Claude will offer to set this up on first session.
# Standalone users: install.sh wires this automatically.
#
# Based on the statusline pattern from caveman (JuliusBrussee/caveman, MIT).

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.dummies-active"

# Refuse symlinks — a local attacker could point the flag at ~/.ssh/id_rsa and
# have the statusline render its bytes (including ANSI escape sequences) to
# the terminal every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap the read at 64 bytes and strip anything outside [a-z0-9-] — blocks
# terminal-escape injection and OSC hyperlink spoofing via the flag contents.
MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

# Whitelist stage name → badge. Anything else → render nothing rather than echo
# attacker bytes.
case "$MODE" in
  egg)     BADGE='1 🥚 dummies' ;;
  chick)   BADGE='2 🐣 dummies' ;;
  eagle)   BADGE='3 🦅 dummies' ;;
  phoenix) BADGE='4 🐦‍🔥 dummies' ;;
  *) exit 0 ;;
esac

# Green = active. Bright enough to see without being loud.
printf '\033[32m[%s]\033[0m' "$BADGE"
