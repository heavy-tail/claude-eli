'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { HOOKS_DIR } = require('./helpers/isolated-env');
const eliConfig = require(path.join(HOOKS_DIR, 'eli-config'));

const isWindows = process.platform === 'win32';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* leak tolerated */ }
}

// Override XDG_CONFIG_HOME + ELI_DEFAULT_STAGE for the duration of fn().
// Always restores originals in a finally block.
function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const originals = {};
  for (const k of keys) {
    originals[k] = Object.prototype.hasOwnProperty.call(process.env, k)
      ? process.env[k]
      : undefined;
    if (overrides[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = overrides[k];
    }
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (originals[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = originals[k];
      }
    }
  }
}

test('VALID_MODES deep-equals the fixed stage list', () => {
  assert.deepEqual(eliConfig.VALID_MODES, ['off', 'baby', 'kid', 'adult', 'auto']);
});

test('safeWriteFlag happy path writes content with 0o600 mode', () => {
  const dir = mkTmp('eli-cfg-write-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    eliConfig.safeWriteFlag(flagPath, 'kid');
    const content = fs.readFileSync(flagPath, 'utf8');
    assert.equal(content, 'kid');
    if (!isWindows) {
      const st = fs.lstatSync(flagPath);
      assert.equal(st.mode & 0o777, 0o600);
    }
  } finally {
    rmTmp(dir);
  }
});

test('safeWriteFlag refuses symlink target', () => {
  const dir = mkTmp('eli-cfg-symtgt-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    fs.symlinkSync('/dev/null', flagPath);
    eliConfig.safeWriteFlag(flagPath, 'kid');
    const st = fs.lstatSync(flagPath);
    assert.equal(st.isSymbolicLink(), true);
  } finally {
    rmTmp(dir);
  }
});

test('safeWriteFlag refuses parent dir that is a symlink', () => {
  const root = mkTmp('eli-cfg-symparent-');
  try {
    const realDir = path.join(root, 'real');
    const linkDir = path.join(root, 'link');
    fs.mkdirSync(realDir);
    fs.symlinkSync(realDir, linkDir);
    const flagPath = path.join(linkDir, '.eli-active');
    eliConfig.safeWriteFlag(flagPath, 'kid');
    // File must NOT appear inside the real directory.
    assert.equal(fs.existsSync(path.join(realDir, '.eli-active')), false);
  } finally {
    rmTmp(root);
  }
});

test('safeWriteFlag ENOENT target proceeds with write', () => {
  const dir = mkTmp('eli-cfg-enoent-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    // Flag file does not exist yet — ENOENT path in lstat should just proceed.
    eliConfig.safeWriteFlag(flagPath, 'adult');
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'adult');
  } finally {
    rmTmp(dir);
  }
});

test('safeWriteFlag leaves no temp file behind after atomic rename', () => {
  const dir = mkTmp('eli-cfg-atomic-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    eliConfig.safeWriteFlag(flagPath, 'baby');
    const entries = fs.readdirSync(dir);
    // The only file present should be the final flag file. No leftover .eli-active.<pid>.<ts>.
    assert.deepEqual(entries, ['.eli-active']);
  } finally {
    rmTmp(dir);
  }
});

test('readFlag returns lowercased valid mode', () => {
  const dir = mkTmp('eli-cfg-read-valid-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    fs.writeFileSync(flagPath, 'ADULT\n');
    assert.equal(eliConfig.readFlag(flagPath), 'adult');
  } finally {
    rmTmp(dir);
  }
});

test('readFlag returns null when flag file is a symlink', () => {
  const dir = mkTmp('eli-cfg-read-sym-');
  try {
    const realFile = path.join(dir, 'real-file');
    const flagPath = path.join(dir, '.eli-active');
    fs.writeFileSync(realFile, 'kid');
    fs.symlinkSync(realFile, flagPath);
    assert.equal(eliConfig.readFlag(flagPath), null);
  } finally {
    rmTmp(dir);
  }
});

test('readFlag returns null when file size exceeds 64 bytes', () => {
  const dir = mkTmp('eli-cfg-read-big-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    fs.writeFileSync(flagPath, 'a'.repeat(65));
    assert.equal(eliConfig.readFlag(flagPath), null);
  } finally {
    rmTmp(dir);
  }
});

test('readFlag returns null when content is not in VALID_MODES', () => {
  const dir = mkTmp('eli-cfg-read-garbage-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    fs.writeFileSync(flagPath, 'garbage');
    assert.equal(eliConfig.readFlag(flagPath), null);
  } finally {
    rmTmp(dir);
  }
});

test('readFlag returns null for non-existent path', () => {
  const dir = mkTmp('eli-cfg-read-missing-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    assert.equal(eliConfig.readFlag(flagPath), null);
  } finally {
    rmTmp(dir);
  }
});

test('readFlag trims whitespace and newline', () => {
  const dir = mkTmp('eli-cfg-read-trim-');
  try {
    const flagPath = path.join(dir, '.eli-active');
    fs.writeFileSync(flagPath, '  kid  \n');
    assert.equal(eliConfig.readFlag(flagPath), 'kid');
  } finally {
    rmTmp(dir);
  }
});

test('getDefaultMode honors ELI_DEFAULT_STAGE env override', () => {
  const xdg = mkTmp('eli-cfg-defmode-env-');
  try {
    withEnv({ ELI_DEFAULT_STAGE: 'adult', XDG_CONFIG_HOME: xdg }, () => {
      assert.equal(eliConfig.getDefaultMode(), 'adult');
    });
  } finally {
    rmTmp(xdg);
  }
});

test('getDefaultMode falls back to config.json defaultStage when env absent', () => {
  const xdg = mkTmp('eli-cfg-defmode-cfg-');
  try {
    const dir = path.join(xdg, 'eli');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ defaultStage: 'baby' }));
    withEnv({ ELI_DEFAULT_STAGE: undefined, XDG_CONFIG_HOME: xdg }, () => {
      assert.equal(eliConfig.getDefaultMode(), 'baby');
    });
  } finally {
    rmTmp(xdg);
  }
});

test('getDefaultMode ultimate fallback is kid', () => {
  const xdg = mkTmp('eli-cfg-defmode-fallback-');
  try {
    withEnv({ ELI_DEFAULT_STAGE: undefined, XDG_CONFIG_HOME: xdg }, () => {
      assert.equal(eliConfig.getDefaultMode(), 'kid');
    });
  } finally {
    rmTmp(xdg);
  }
});

test('getDefaultMode ignores invalid env value and falls through', () => {
  const xdg = mkTmp('eli-cfg-defmode-invalid-');
  try {
    withEnv({ ELI_DEFAULT_STAGE: 'zzz', XDG_CONFIG_HOME: xdg }, () => {
      // No config file, no valid env → ultimate fallback 'kid'.
      assert.equal(eliConfig.getDefaultMode(), 'kid');
    });
  } finally {
    rmTmp(xdg);
  }
});

test('readMetadata on missing file returns DEFAULT_METADATA shape', () => {
  const xdg = mkTmp('eli-cfg-meta-empty-');
  try {
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      const meta = eliConfig.readMetadata();
      assert.deepEqual(meta, {
        installedAt: null,
        sessionCount: 0,
        totalPrompts: 0,
        lastSessionAt: null,
        stageHistory: [],
      });
    });
  } finally {
    rmTmp(xdg);
  }
});

test('writeMetadata round-trips via readMetadata', () => {
  const xdg = mkTmp('eli-cfg-meta-rt-');
  try {
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      const input = {
        installedAt: '2026-01-01T00:00:00.000Z',
        sessionCount: 7,
        totalPrompts: 42,
        lastSessionAt: '2026-04-23T12:00:00.000Z',
        stageHistory: [{ from: 'kid', to: 'adult', at: '2026-04-23T12:00:00.000Z' }],
      };
      eliConfig.writeMetadata(input);
      const roundTripped = eliConfig.readMetadata();
      assert.deepEqual(roundTripped, input);
    });
  } finally {
    rmTmp(xdg);
  }
});

test('recordStageChange caps stageHistory at MAX_STAGE_HISTORY (100)', () => {
  const xdg = mkTmp('eli-cfg-meta-cap-');
  try {
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      for (let i = 0; i < 110; i++) {
        eliConfig.recordStageChange('kid', i % 2 === 0 ? 'baby' : 'adult');
      }
      const meta = eliConfig.readMetadata();
      assert.equal(meta.stageHistory.length, 100);
      // Last entry is the most recent push: i=109 → odd → 'adult'.
      assert.equal(meta.stageHistory[meta.stageHistory.length - 1].to, 'adult');
      assert.equal(meta.stageHistory[meta.stageHistory.length - 1].from, 'kid');
    });
  } finally {
    rmTmp(xdg);
  }
});
