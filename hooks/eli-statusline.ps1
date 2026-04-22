# Claude ELI — statusline badge script for Claude Code (Windows)
# Reads the eli stage flag and outputs a colored badge with stage emoji.
#
# Based on the statusline pattern from caveman (JuliusBrussee/caveman, MIT).

$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$Flag = Join-Path $ClaudeDir ".eli-active"
if (-not (Test-Path $Flag)) { exit 0 }

# Refuse reparse points (symlinks / junctions) and oversized files.
try {
    $Item = Get-Item -LiteralPath $Flag -Force -ErrorAction Stop
    if ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { exit 0 }
    if ($Item.Length -gt 64) { exit 0 }
} catch {
    exit 0
}

$Mode = ""
try {
    $Raw = Get-Content -LiteralPath $Flag -TotalCount 1 -ErrorAction Stop
    if ($null -ne $Raw) { $Mode = ([string]$Raw).Trim() }
} catch {
    exit 0
}

# Strip anything outside [a-z0-9-] — blocks terminal-escape and OSC hyperlink
# injection via the flag contents. Then whitelist-validate.
$Mode = $Mode.ToLowerInvariant()
$Mode = ($Mode -replace '[^a-z0-9-]', '')

$Valid = @('off', 'baby', 'kid', 'adult')
if (-not ($Valid -contains $Mode)) { exit 0 }

$Badge = switch ($Mode) {
    'baby'  { "1 👶 eli" }
    'kid'   { "2 🧒 eli" }
    'adult' { "3 🎓 eli" }
    default { exit 0 }
}

$Esc = [char]27
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::Write("${Esc}[32m[$Badge]${Esc}[0m")
