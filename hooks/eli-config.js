#!/usr/bin/env node
// Claude ELI — shared configuration resolver
//
// Resolution order for default stage:
//   1. ELI_DEFAULT_STAGE environment variable
//   2. Config file defaultStage field:
//      - $XDG_CONFIG_HOME/eli/config.json (any platform, if set)
//      - ~/.config/eli/config.json (macOS / Linux fallback)
//      - %APPDATA%\eli\config.json (Windows fallback)
//   3. 'kid'
//
// Based on the config pattern from caveman (JuliusBrussee/caveman, MIT).

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = [
  'off',
  'baby', 'kid', 'adult', 'auto'
];

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'eli');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'eli'
    );
  }
  return path.join(os.homedir(), '.config', 'eli');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getDefaultMode() {
  // 1. Environment variable (highest priority)
  const envMode = process.env.ELI_DEFAULT_STAGE;
  if (envMode && VALID_MODES.includes(envMode.toLowerCase())) {
    return envMode.toLowerCase();
  }

  // 2. Config file
  try {
    const configPath = getConfigPath();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.defaultStage && VALID_MODES.includes(config.defaultStage.toLowerCase())) {
      return config.defaultStage.toLowerCase();
    }
  } catch (e) {
    // Config file doesn't exist or is invalid — fall through
  }

  // 3. Default
  return 'kid';
}

// Symlink-safe flag file write.
// Refuses symlinks at the target file and at the immediate parent directory,
// uses O_NOFOLLOW where available, writes atomically via temp + rename with
// 0600 permissions. Protects against local attackers replacing the predictable
// flag path (~/.claude/.eli-active) with a symlink to clobber other files.
//
// Does NOT walk the full ancestor chain — macOS has /tmp -> /private/tmp and
// many legitimate setups route through symlinked home dirs, so a full walk
// produces false positives. The attack surface requires write access to the
// immediate parent, which is what we check.
//
// Silent-fails on any filesystem error — the flag is best-effort.
function safeWriteFlag(flagPath, content) {
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    // Refuse if the parent directory itself is a symlink (attacker redirect).
    try {
      if (fs.lstatSync(flagDir).isSymbolicLink()) return;
    } catch (e) {
      return;
    }

    // Refuse if the target already exists as a symlink.
    try {
      if (fs.lstatSync(flagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(flagDir, `.eli-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, flagPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}

// Symlink-safe, size-capped, whitelist-validated flag file read.
// Symmetric with safeWriteFlag: refuses symlinks at the target, caps the read,
// and rejects anything that isn't a known stage. Returns null on any anomaly.
//
// Without this, a local attacker with write access to ~/.claude/ could replace
// the flag with a symlink to ~/.ssh/id_rsa (or any user-readable secret). Every
// reader — statusline, per-turn reinforcement — would slurp that content and
// either echo it to the terminal or inject it into model context.
//
// MAX_FLAG_BYTES is a hard cap. The longest legitimate value is "adult"
// (5 bytes); 64 leaves slack without enabling exfil.
const MAX_FLAG_BYTES = 64;

function readFlag(flagPath) {
  try {
    let st;
    try {
      st = fs.lstatSync(flagPath);
    } catch (e) {
      return null;
    }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    const raw = out.trim().toLowerCase();
    if (!VALID_MODES.includes(raw)) return null;
    return raw;
  } catch (e) {
    return null;
  }
}

// ---- Metadata (for /eli-stats and Level-up events) ------------------------
//
// Stored at ~/.config/eli/metadata.json (XDG respected, Windows %APPDATA%).
// Tracks install date, session count, total prompts, and stage transition history.
// Not security-sensitive, so we skip the symlink gauntlet — but still atomic write.

const DEFAULT_METADATA = {
  installedAt: null,
  sessionCount: 0,
  totalPrompts: 0,
  lastSessionAt: null,
  stageHistory: []
};

function getMetadataPath() {
  return path.join(getConfigDir(), 'metadata.json');
}

function readMetadata() {
  try {
    const raw = fs.readFileSync(getMetadataPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_METADATA, ...parsed };
  } catch (e) {
    return { ...DEFAULT_METADATA };
  }
}

function writeMetadata(meta) {
  try {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    const tmp = getMetadataPath() + '.' + process.pid + '.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, getMetadataPath());
  } catch (e) {
    // Silent fail — metadata is best-effort
  }
}

function recordSession() {
  const meta = readMetadata();
  const now = new Date().toISOString();
  if (!meta.installedAt) meta.installedAt = now;
  meta.sessionCount = (meta.sessionCount || 0) + 1;
  meta.lastSessionAt = now;
  writeMetadata(meta);
}

function recordPrompt() {
  const meta = readMetadata();
  meta.totalPrompts = (meta.totalPrompts || 0) + 1;
  writeMetadata(meta);
}

// Cap stage history at 100 entries to prevent unbounded growth.
const MAX_STAGE_HISTORY = 100;

function recordStageChange(fromStage, toStage) {
  const meta = readMetadata();
  if (!Array.isArray(meta.stageHistory)) meta.stageHistory = [];
  meta.stageHistory.push({
    from: fromStage,
    to: toStage,
    at: new Date().toISOString()
  });
  if (meta.stageHistory.length > MAX_STAGE_HISTORY) {
    meta.stageHistory = meta.stageHistory.slice(-MAX_STAGE_HISTORY);
  }
  writeMetadata(meta);
}

module.exports = {
  getDefaultMode, getConfigDir, getConfigPath, VALID_MODES,
  safeWriteFlag, readFlag,
  getMetadataPath, readMetadata, writeMetadata,
  recordSession, recordPrompt, recordStageChange
};
