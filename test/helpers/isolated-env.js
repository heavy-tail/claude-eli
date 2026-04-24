'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
const ACTIVATE_JS = path.join(HOOKS_DIR, 'eli-activate.js');
const TRACKER_JS = path.join(HOOKS_DIR, 'eli-mode-tracker.js');
const STATUSLINE_SH = path.join(HOOKS_DIR, 'eli-statusline.sh');
const STATUSLINE_PS1 = path.join(HOOKS_DIR, 'eli-statusline.ps1');

function makeIsolatedEnv(opts = {}) {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eli-test-claude-'));
  const xdgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eli-test-xdg-'));
  const env = Object.assign({}, process.env, {
    CLAUDE_CONFIG_DIR: claudeDir,
    XDG_CONFIG_HOME: xdgDir,
  });
  delete env.ELI_DEFAULT_STAGE;
  delete env.APPDATA;
  delete env.CLAUDE_PROJECT_DIR;

  let projectDir = null;
  if (opts.withProjectDir) {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eli-test-project-'));
  }

  return {
    claudeDir,
    xdgDir,
    projectDir,
    env,
    cleanup() {
      try { fs.rmSync(claudeDir, { recursive: true, force: true }); } catch (e) { /* leak tolerated */ }
      try { fs.rmSync(xdgDir, { recursive: true, force: true }); } catch (e) { /* leak tolerated */ }
      if (projectDir) {
        try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (e) { /* leak tolerated */ }
      }
    },
  };
}

function runHook(scriptAbsPath, opts = {}) {
  const { env = process.env, stdin, cwd = REPO_ROOT, timeout = 15000 } = opts;
  let command;
  let args;
  if (scriptAbsPath.endsWith('.js')) {
    command = process.execPath;
    args = [scriptAbsPath];
  } else if (scriptAbsPath.endsWith('.sh')) {
    command = 'bash';
    args = [scriptAbsPath];
  } else if (scriptAbsPath.endsWith('.ps1')) {
    command = 'pwsh';
    args = ['-NoProfile', '-NonInteractive', '-File', scriptAbsPath];
  } else {
    throw new Error('unknown hook script extension: ' + scriptAbsPath);
  }
  const result = spawnSync(command, args, {
    env,
    input: stdin,
    cwd,
    encoding: 'utf8',
    timeout,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    code: result.status,
    signal: result.signal,
    error: result.error,
  };
}

function runActivate(envBundle, opts = {}) {
  let env = envBundle.env;
  const projectDir = opts.projectDir || envBundle.projectDir;
  if (projectDir) {
    env = Object.assign({}, env, { CLAUDE_PROJECT_DIR: projectDir });
  }
  return runHook(ACTIVATE_JS, { env });
}

function runTracker(envBundle, prompt) {
  return runHook(TRACKER_JS, {
    env: envBundle.env,
    stdin: JSON.stringify({ prompt }),
  });
}

function runTrackerRawStdin(envBundle, rawStdin) {
  return runHook(TRACKER_JS, {
    env: envBundle.env,
    stdin: rawStdin,
  });
}

function runStatusline(envBundle) {
  const script = process.platform === 'win32' ? STATUSLINE_PS1 : STATUSLINE_SH;
  return runHook(script, { env: envBundle.env });
}

function flagPathFor(claudeDir) {
  return path.join(claudeDir, '.eli-active');
}

function readRawFlag(claudeDir) {
  try {
    return fs.readFileSync(flagPathFor(claudeDir), 'utf8');
  } catch (e) {
    return null;
  }
}

function flagExists(claudeDir) {
  try {
    return fs.lstatSync(flagPathFor(claudeDir)).isFile();
  } catch (e) {
    return false;
  }
}

function writeConfigJson(xdgDir, obj) {
  const dir = path.join(xdgDir, 'eli');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(obj));
}

function readMetadata(xdgDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(xdgDir, 'eli', 'metadata.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeSettingsJson(claudeDir, obj) {
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(obj, null, 2));
}

function readSettingsJson(claudeDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeProjectSettings(projectDir, fileName, obj) {
  const dir = path.join(projectDir, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(obj, null, 2));
}

function readProjectSettings(projectDir, fileName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, '.claude', fileName), 'utf8'));
  } catch (e) {
    return null;
  }
}

function projectSettingsExists(projectDir, fileName) {
  try {
    return fs.existsSync(path.join(projectDir, '.claude', fileName));
  } catch (e) {
    return false;
  }
}

function parseTrackerJsonStdout(stdout) {
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch (e) {
    return null;
  }
}

function trackerAdditionalContext(stdout) {
  const parsed = parseTrackerJsonStdout(stdout);
  if (!parsed || !parsed.hookSpecificOutput) return null;
  return parsed.hookSpecificOutput.additionalContext || null;
}

module.exports = {
  REPO_ROOT,
  HOOKS_DIR,
  ACTIVATE_JS,
  TRACKER_JS,
  STATUSLINE_SH,
  STATUSLINE_PS1,
  makeIsolatedEnv,
  runHook,
  runActivate,
  runTracker,
  runTrackerRawStdin,
  runStatusline,
  flagPathFor,
  readRawFlag,
  flagExists,
  writeConfigJson,
  readMetadata,
  writeSettingsJson,
  readSettingsJson,
  writeProjectSettings,
  readProjectSettings,
  projectSettingsExists,
  parseTrackerJsonStdout,
  trackerAdditionalContext,
};
