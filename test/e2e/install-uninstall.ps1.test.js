'use strict';

// Layer 3 E2E — install.ps1 / uninstall.ps1 lifecycle (Windows variant).
//
// Scaffold only. We develop on Linux, so this file's whole suite is a
// single skip on non-Windows hosts. On Windows, the lifecycle mirrors the
// bash variant: pre-seed settings.json, run install.ps1, assert the 6 hook
// files land, assert settings.json has ELI entries + statusLine, assert
// settings.json.bak exists, then run uninstall.ps1 and assert a clean
// removal (flag gone, .bak gone, hooks removed, user keys preserved).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  REPO_ROOT,
  HOOKS_DIR,
  makeIsolatedEnv,
  writeSettingsJson,
  readSettingsJson,
} = require('../helpers/isolated-env');

if (process.platform !== 'win32') {
  test('install.ps1 suite skipped on non-Windows', { skip: true }, () => {});
} else {
  // Detect pwsh (PowerShell 6+, cross-platform name). Fall back to
  // powershell.exe if pwsh is missing — both should accept -File.
  const which = spawnSync('where', ['pwsh'], { encoding: 'utf8' });
  const hasPwsh = which.status === 0 && (which.stdout || '').trim().length > 0;
  const whichPs = spawnSync('where', ['powershell'], { encoding: 'utf8' });
  const hasPowershell = whichPs.status === 0 && (whichPs.stdout || '').trim().length > 0;

  if (!hasPwsh && !hasPowershell) {
    test('install.ps1 suite skipped: pwsh/powershell not available', { skip: true }, () => {});
  } else {
    const shell = hasPwsh ? 'pwsh' : 'powershell';
    const INSTALL_PS1 = path.join(HOOKS_DIR, 'install.ps1');
    const UNINSTALL_PS1 = path.join(HOOKS_DIR, 'uninstall.ps1');

    // install.ps1 ships 6 hook files (adds eli-statusline.ps1 vs the 5 bash hooks).
    const HOOK_FILES = [
      'package.json',
      'eli-config.js',
      'eli-activate.js',
      'eli-mode-tracker.js',
      'eli-statusline.sh',
      'eli-statusline.ps1',
    ];

    test(
      'install.ps1 copies hooks and patches settings; uninstall.ps1 restores cleanly',
      () => {
        const envBundle = makeIsolatedEnv();
        try {
          writeSettingsJson(envBundle.claudeDir, { someUserKey: 'preserved' });

          const installResult = spawnSync(
            shell,
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', INSTALL_PS1],
            {
              env: envBundle.env,
              cwd: REPO_ROOT,
              encoding: 'utf8',
              timeout: 60000,
            }
          );
          assert.equal(
            installResult.status,
            0,
            'install.ps1 exit code should be 0; stderr: ' + (installResult.stderr || '')
          );

          const installedHooksDir = path.join(envBundle.claudeDir, 'hooks');
          for (const hook of HOOK_FILES) {
            const hookPath = path.join(installedHooksDir, hook);
            assert.equal(
              fs.existsSync(hookPath),
              true,
              'hook file should exist after install: ' + hookPath
            );
          }

          const settings = readSettingsJson(envBundle.claudeDir);
          assert.ok(settings, 'settings.json should parse after install');
          assert.equal(
            settings.someUserKey,
            'preserved',
            'pre-existing user key should survive the merge'
          );
          assert.ok(settings.statusLine, 'statusLine should be set after install');

          const bakPath = path.join(envBundle.claudeDir, 'settings.json.bak');
          assert.equal(
            fs.existsSync(bakPath),
            true,
            'settings.json.bak should exist after install.ps1'
          );

          const uninstallResult = spawnSync(
            shell,
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', UNINSTALL_PS1],
            {
              env: envBundle.env,
              cwd: REPO_ROOT,
              encoding: 'utf8',
              timeout: 60000,
            }
          );
          assert.equal(
            uninstallResult.status,
            0,
            'uninstall.ps1 exit code should be 0; stderr: ' + (uninstallResult.stderr || '')
          );

          for (const hook of HOOK_FILES) {
            const hookPath = path.join(installedHooksDir, hook);
            assert.equal(
              fs.existsSync(hookPath),
              false,
              'hook file should NOT exist after uninstall: ' + hookPath
            );
          }

          assert.equal(
            fs.existsSync(bakPath),
            false,
            'settings.json.bak should be removed after uninstall.ps1'
          );

          const afterSettings = readSettingsJson(envBundle.claudeDir);
          assert.ok(afterSettings, 'settings.json should still parse after uninstall');
          assert.equal(
            afterSettings.someUserKey,
            'preserved',
            'user key should still be present after uninstall'
          );
          assert.equal(
            afterSettings.statusLine,
            undefined,
            'statusLine should be removed after uninstall'
          );
        } finally {
          envBundle.cleanup();
        }
      }
    );
  }
}
