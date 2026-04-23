'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  HOOKS_DIR,
  makeIsolatedEnv,
  runActivate,
  readRawFlag,
  flagExists,
  readMetadata,
  writeSettingsJson,
  readSettingsJson,
} = require('./helpers/isolated-env');

test('default activate writes kid flag and emits SKILL.md body', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runActivate(env);
    assert.equal(res.code, 0);
    assert.equal(readRawFlag(env.claudeDir).trim(), 'kid');
    assert.ok(
      res.stdout.includes('ELI MODE ACTIVE — current stage: kid'),
      'stdout should announce current stage'
    );
    // SKILL.md body anchor — Korean heading of the alalddakkalsen section.
    assert.ok(res.stdout.includes('알잘딱깔센'), 'stdout should contain SKILL.md body anchor');
  } finally {
    env.cleanup();
  }
});

test('activate strips YAML frontmatter from SKILL.md output', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runActivate(env);
    assert.equal(res.code, 0);
    // The first line of SKILL.md is '---' followed by 'name: eli' frontmatter.
    // After strip, the body should not carry those frontmatter tokens.
    assert.equal(res.stdout.includes('name: eli'), false, 'frontmatter "name: eli" line should be stripped');
    // Frontmatter opens with '---\n' on the very first line. Body text never starts with '---'.
    assert.equal(res.stdout.startsWith('---'), false, 'stdout should not lead with frontmatter delimiter');
  } finally {
    env.cleanup();
  }
});

test('activate increments sessionCount and sets installedAt', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runActivate(env);
    assert.equal(res.code, 0);
    const meta = readMetadata(env.xdgDir);
    assert.ok(meta, 'metadata.json should exist after activate');
    assert.equal(meta.sessionCount, 1);
    assert.equal(typeof meta.installedAt, 'string');
    // Basic ISO-8601 shape check — YYYY-MM-DDTHH:MM:SS...Z.
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(meta.installedAt), 'installedAt is ISO string');
  } finally {
    env.cleanup();
  }
});

test('ELI_DEFAULT_STAGE=off skips flag and emits OK', () => {
  const env = makeIsolatedEnv();
  try {
    env.env.ELI_DEFAULT_STAGE = 'off';
    const res = runActivate(env);
    assert.equal(res.code, 0);
    assert.equal(flagExists(env.claudeDir), false, 'flag must not exist in off mode');
    assert.equal(res.stdout, 'OK');
  } finally {
    env.cleanup();
  }
});

test('filesystem error on claudeDir is silent — exit 0', () => {
  const env = makeIsolatedEnv();
  try {
    // chmod 0o000 on the claudeDir — unreadable/unwritable. The hook must silent-fail.
    fs.chmodSync(env.claudeDir, 0o000);
    try {
      const res = runActivate(env);
      assert.equal(res.code, 0);
      // Should not throw / should not blow up even if settings.json + flag can't be written.
      assert.equal(res.signal, null);
    } finally {
      // Restore permissions so cleanup can rm the tree.
      try { fs.chmodSync(env.claudeDir, 0o755); } catch (e) { /* tolerate */ }
    }
  } finally {
    env.cleanup();
  }
});

test('fallback ruleset emits when skills/ is absent (standalone install)', () => {
  // Copy only hooks/eli-config.js + hooks/eli-activate.js + hooks/eli-statusline.sh
  // into a fresh temp dir, run eli-activate from there — no skills/ directory exists,
  // so SKILL.md read fails and the hardcoded fallback is emitted.
  const standaloneRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eli-standalone-'));
  const standaloneHooks = path.join(standaloneRoot, 'hooks');
  fs.mkdirSync(standaloneHooks, { recursive: true });
  fs.copyFileSync(path.join(HOOKS_DIR, 'eli-config.js'), path.join(standaloneHooks, 'eli-config.js'));
  fs.copyFileSync(path.join(HOOKS_DIR, 'eli-activate.js'), path.join(standaloneHooks, 'eli-activate.js'));
  fs.copyFileSync(path.join(HOOKS_DIR, 'eli-statusline.sh'), path.join(standaloneHooks, 'eli-statusline.sh'));
  // CJS pin — keep require() consistent.
  fs.writeFileSync(path.join(standaloneHooks, 'package.json'), '{"type":"commonjs"}');

  const env = makeIsolatedEnv();
  try {
    const activateJs = path.join(standaloneHooks, 'eli-activate.js');
    const result = spawnSync(process.execPath, [activateJs], {
      env: env.env,
      cwd: standaloneRoot,
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(result.status, 0);
    const stdout = result.stdout || '';
    assert.ok(stdout.includes('Mission:'), 'fallback body should include "Mission:"');
    assert.ok(stdout.includes('알잘딱깔센'), 'fallback body should include Korean 4-criteria anchor');
    assert.ok(stdout.includes('LEVEL-1 INVARIANT'), 'fallback body should include LEVEL-1 INVARIANT anchor');
    assert.ok(stdout.includes('✨'), 'fallback body should include ✨ emoji');
    assert.ok(stdout.includes('**auto**'), 'fallback body should include **auto** stage anchor');
  } finally {
    env.cleanup();
    try { fs.rmSync(standaloneRoot, { recursive: true, force: true }); } catch (e) { /* tolerate */ }
  }
});

test('statusLine auto-wire writes eli-statusline when settings.json absent', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runActivate(env);
    assert.equal(res.code, 0);
    const settings = readSettingsJson(env.claudeDir);
    assert.ok(settings, 'settings.json should now exist');
    assert.ok(settings.statusLine, 'statusLine block should be wired');
    assert.equal(settings.statusLine.type, 'command');
    assert.ok(
      /eli-statusline/.test(settings.statusLine.command),
      'statusLine command should point at eli-statusline'
    );
  } finally {
    env.cleanup();
  }
});

test('statusLine auto-wire leaves a non-eli user custom statusLine untouched', () => {
  const env = makeIsolatedEnv();
  try {
    writeSettingsJson(env.claudeDir, {
      statusLine: { type: 'command', command: 'date' },
    });
    const res = runActivate(env);
    assert.equal(res.code, 0);
    const settings = readSettingsJson(env.claudeDir);
    assert.equal(settings.statusLine.command, 'date');
  } finally {
    env.cleanup();
  }
});

test('statusLine stale plugin-cache path is rewritten to current HOOKS_DIR', () => {
  const env = makeIsolatedEnv();
  try {
    writeSettingsJson(env.claudeDir, {
      statusLine: {
        type: 'command',
        command: 'bash "/old/plugin-cache/abc123/eli-statusline.sh"',
      },
    });
    const res = runActivate(env);
    assert.equal(res.code, 0);
    const settings = readSettingsJson(env.claudeDir);
    const cmd = settings.statusLine.command;
    assert.equal(cmd.includes('/old/plugin-cache/abc123'), false, 'stale path should be dropped');
    assert.ok(cmd.includes(HOOKS_DIR), 'new command should reference the current HOOKS_DIR');
    assert.ok(/eli-statusline\.(sh|ps1)/.test(cmd), 'new command should point to eli-statusline');
  } finally {
    env.cleanup();
  }
});
