#!/bin/bash
# Claude ELI — statusline badge script for Claude Code
# Reads the eli stage flag and outputs a colored badge with stage emoji.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/eli-statusline.sh" }
#
# Plugin users: Claude will offer to set this up on first session.
# Standalone users: install.sh wires this automatically.
#
# Based on the statusline pattern from caveman (JuliusBrussee/caveman, MIT).

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.eli-active"

# Refuse symlinks — a local attacker could point the flag at ~/.ssh/id_rsa and
# have the statusline render its bytes (including ANSI escape sequences) to
# the terminal every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap the read at 64 bytes and strip anything outside [a-z0-9-] — blocks
# terminal-escape injection and OSC hyperlink spoofing via the flag contents.
MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

# Whitelist stage name → badge + per-stage color. Anything else → render
# nothing rather than echo attacker bytes.
case "$MODE" in
  baby)  BADGE='baby 👶 eli';  COLOR='\033[36m' ;;  # cyan — fresh, starting
  kid)   BADGE='kid 🧒 eli';   COLOR='\033[32m' ;;  # green — default, steady
  adult) BADGE='adult 🎓 eli'; COLOR='\033[33m' ;;  # yellow/gold — matured
  auto)  BADGE='auto ✨ eli';  COLOR='\033[35m' ;;  # magenta — adaptive magic
  *) exit 0 ;;
esac

printf '%b[%s]\033[0m' "$COLOR" "$BADGE"
