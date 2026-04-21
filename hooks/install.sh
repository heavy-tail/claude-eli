#!/bin/bash
# Claude for Dummies — one-command hook installer for Claude Code
# Installs: SessionStart hook (auto-load rules) + UserPromptSubmit hook (stage tracking)
# Usage: bash hooks/install.sh
#   or:  bash <(curl -s https://raw.githubusercontent.com/wchun26/claude-for-dummies/main/hooks/install.sh)
#   or:  bash hooks/install.sh --force   (re-install over existing hooks)
#
# Based on the installer pattern from caveman (JuliusBrussee/caveman, MIT).
set -e

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
  esac
done

# Detect Windows (Git Bash / MSYS / MINGW) — not WSL (WSL reports "linux-gnu")
case "$OSTYPE" in
  msys*|cygwin*|mingw*)
    echo "WARNING: Running on Windows ($OSTYPE)."
    echo "         This script works in Git Bash/MSYS but symlinks may require"
    echo "         Developer Mode or admin privileges."
    echo "         If you installed via 'claude plugin install', you don't need this script."
    echo ""
    ;;
esac

# Require node — we use it to merge the hook config into settings.json
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 'node' is required to install the Claude for Dummies hooks (used to merge"
  echo "       the hook config into ~/.claude/settings.json safely)."
  echo "       Install Node.js from https://nodejs.org and re-run this script."
  exit 1
fi

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"
REPO_URL="https://raw.githubusercontent.com/wchun26/claude-for-dummies/main/hooks"

HOOK_FILES=("package.json" "dummies-config.js" "dummies-activate.js" "dummies-mode-tracker.js" "dummies-statusline.sh")

# Resolve source — works from repo clone or curl pipe
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
fi

# Check if already installed (unless --force).
ALREADY_INSTALLED=0
if [ "$FORCE" -eq 0 ]; then
  ALL_FILES_PRESENT=1
  for hook in "${HOOK_FILES[@]}"; do
    if [ ! -f "$HOOKS_DIR/$hook" ]; then
      ALL_FILES_PRESENT=0
      break
    fi
  done

  HOOKS_WIRED=0
  HAS_STATUSLINE=0
  if [ "$ALL_FILES_PRESENT" -eq 1 ] && [ -f "$SETTINGS" ]; then
    if DUMMIES_SETTINGS="$SETTINGS" node -e "
      const fs = require('fs');
      const settings = JSON.parse(fs.readFileSync(process.env.DUMMIES_SETTINGS, 'utf8'));
      const hasDummiesHook = (event) =>
        Array.isArray(settings.hooks?.[event]) &&
        settings.hooks[event].some(e =>
          e.hooks && e.hooks.some(h => h.command && h.command.includes('dummies'))
        );
      process.exit(
        hasDummiesHook('SessionStart') &&
        hasDummiesHook('UserPromptSubmit') &&
        !!settings.statusLine
          ? 0
          : 1
      );
    " >/dev/null 2>&1; then
      HOOKS_WIRED=1
      HAS_STATUSLINE=1
    fi
  fi

  if [ "$ALL_FILES_PRESENT" -eq 1 ] && [ "$HOOKS_WIRED" -eq 1 ] && [ "$HAS_STATUSLINE" -eq 1 ]; then
    ALREADY_INSTALLED=1
    echo "Claude for Dummies hooks already installed in $HOOKS_DIR"
    echo "  Re-run with --force to overwrite: bash hooks/install.sh --force"
    echo ""
  fi
fi

if [ "$ALREADY_INSTALLED" -eq 1 ] && [ "$FORCE" -eq 0 ]; then
  echo "Nothing to do. Hooks are already in place."
  exit 0
fi

if [ "$FORCE" -eq 1 ] && [ -f "$HOOKS_DIR/dummies-activate.js" ]; then
  echo "Reinstalling Claude for Dummies hooks (--force)..."
else
  echo "Installing Claude for Dummies hooks..."
fi

# 1. Ensure hooks dir exists
mkdir -p "$HOOKS_DIR"

# 2. Copy or download hook files
for hook in "${HOOK_FILES[@]}"; do
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/$hook" ]; then
    cp "$SCRIPT_DIR/$hook" "$HOOKS_DIR/$hook"
  else
    curl -fsSL "$REPO_URL/$hook" -o "$HOOKS_DIR/$hook"
  fi
  echo "  Installed: $HOOKS_DIR/$hook"
done

# Make statusline script executable
chmod +x "$HOOKS_DIR/dummies-statusline.sh"

# 3. Wire hooks + statusline into settings.json (idempotent)
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

# Back up existing settings.json before touching it
cp "$SETTINGS" "$SETTINGS.bak"

# Pass paths via env vars — avoids shell injection if $HOME contains single quotes
DUMMIES_SETTINGS="$SETTINGS" DUMMIES_HOOKS_DIR="$HOOKS_DIR" node -e "
  const fs = require('fs');
  const settingsPath = process.env.DUMMIES_SETTINGS;
  const hooksDir = process.env.DUMMIES_HOOKS_DIR;
  const managedStatusLinePath = hooksDir + '/dummies-statusline.sh';
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.hooks) settings.hooks = {};

  // SessionStart — auto-load Dummies rules
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  const hasStart = settings.hooks.SessionStart.some(e =>
    e.hooks && e.hooks.some(h => h.command && h.command.includes('dummies'))
  );
  if (!hasStart) {
    settings.hooks.SessionStart.push({
      hooks: [{
        type: 'command',
        command: 'node \"' + hooksDir + '/dummies-activate.js\"',
        timeout: 5,
        statusMessage: 'Loading Claude for Dummies...'
      }]
    });
  }

  // UserPromptSubmit — track stage changes when user types /dummy commands
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  const hasPrompt = settings.hooks.UserPromptSubmit.some(e =>
    e.hooks && e.hooks.some(h => h.command && h.command.includes('dummies'))
  );
  if (!hasPrompt) {
    settings.hooks.UserPromptSubmit.push({
      hooks: [{
        type: 'command',
        command: 'node \"' + hooksDir + '/dummies-mode-tracker.js\"',
        timeout: 5,
        statusMessage: 'Tracking Dummies stage...'
      }]
    });
  }

  // Statusline — wire dummies badge (report if skipped)
  if (!settings.statusLine) {
    settings.statusLine = {
      type: 'command',
      command: 'bash \"' + managedStatusLinePath + '\"'
    };
    console.log('  Statusline badge configured.');
  } else {
    const cmd = typeof settings.statusLine === 'string'
      ? settings.statusLine
      : (settings.statusLine.command || '');
    if (cmd.includes(managedStatusLinePath)) {
      console.log('  Statusline badge already configured.');
    } else {
      console.log('  NOTE: Existing statusline detected — Dummies badge NOT added.');
      console.log('        See hooks/README.md to add the badge to your existing statusline.');
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('  Hooks wired in settings.json');
"

echo ""
echo "Done! Restart Claude Code to activate."
echo ""
echo "What's installed:"
echo "  - SessionStart hook: auto-loads Dummies rules every session"
echo "  - Stage tracker hook: updates statusline badge when you change stage"
echo "    (/dummy 1, /dummy 2, /dummy harder, /dummy off, etc.)"
echo "  - Statusline badge: shows [1 👶 dummies] / [2 🧒 dummies] / [3 🎓 dummies]"
