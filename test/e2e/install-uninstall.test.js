'use strict';

// Layer 3 E2E — install.sh / uninstall.sh lifecycle against an isolated
// CLAUDE_CONFIG_DIR. Verifies:
//   1. install.sh copies the 5 hook files
//   2. install.sh merges hooks + statusLine into settings.json while
//      preserving pre-existing user keys
//   3. install.sh backs up the pre-existing settings.json to .bak
//   4. eli-activate.js writes the flag after install
//   5. uninstall.sh removes the hook files, the .bak, the flag, and the
//      ELI entries from settings.json — leaves user keys intact

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  REPO_ROOT,
  HOOKS_DIR,
  ACTIVATE_JS,
  makeIsolatedEnv,
  writeSettingsJson,
  readSettingsJson,
  flagExists,
  readRawFlag,
} = require('../helpers/isolated-env');

// Bash-only suite. On Windows, install.sh is not the supported path — the
// companion install.ps1 test scaffold covers that. Register a single skip so
// the file still shows up in the run summary and exits green.
if (process.platform === 'win32') {
  test('install-uninstall bash suite skipped on Windows', { skip: true }, () => {});
} else {
  const INSTALL_SH = path.join(HOOKS_DIR, 'install.sh');
  const UNINSTALL_SH = path.join(HOOKS_DIR, 'uninstall.sh');

  const HOOK_FILES = [
    'package.json',
    'eli-config.js',
    'eli-activate.js',
    'eli-mode-tracker.js',
    'eli-statusline.sh',
  ];

  test(
    'install.sh copies hooks and patches settings; uninstall.sh restores cleanly',
    () => {
      const envBundle = makeIsolatedEnv();
      try {
        // Pre-seed settings.json with a user key so the installer must merge
        // (not create from scratch) and the .bak creation is verifiable.
        writeSettingsJson(envBundle.claudeDir, { someUserKey: 'preserved' });

        // ---- install phase -------------------------------------------------
        const installResult = spawnSync('bash', [INSTALL_SH], {
          env: envBundle.env,
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60000,
        });
        assert.equal(
          installResult.status,
          0,
          'install.sh exit code should be 0; stderr: ' + (installResult.stderr || '')
        );

        // All 5 hook files landed in $CLAUDE_CONFIG_DIR/hooks/
        const installedHooksDir = path.join(envBundle.claudeDir, 'hooks');
        for (const hook of HOOK_FILES) {
          const hookPath = path.join(installedHooksDir, hook);
          assert.equal(
            fs.existsSync(hookPath),
            true,
            'hook file should exist after install: ' + hookPath
          );
        }

        // settings.json patched — SessionStart + UserPromptSubmit + statusLine
        // all reference the correct script, and the user key survived the merge.
        const settings = readSettingsJson(envBundle.claudeDir);
        assert.ok(settings, 'settings.json should parse after install');
        assert.equal(
          settings.someUserKey,
          'preserved',
          'pre-existing user key should survive the merge'
        );

        assert.ok(
          Array.isArray(settings.hooks && settings.hooks.SessionStart),
          'hooks.SessionStart should be an array'
        );
        const hasActivate = settings.hooks.SessionStart.some(
          (entry) =>
            entry &&
            Array.isArray(entry.hooks) &&
            entry.hooks.some(
              (h) => h.command && h.command.includes('eli-activate.js')
            )
        );
        assert.equal(
          hasActivate,
          true,
          'SessionStart should contain an ELI entry whose command references eli-activate.js'
        );

        assert.ok(
          Array.isArray(settings.hooks && settings.hooks.UserPromptSubmit),
          'hooks.UserPromptSubmit should be an array'
        );
        const hasTracker = settings.hooks.UserPromptSubmit.some(
          (entry) =>
            entry &&
            Array.isArray(entry.hooks) &&
            entry.hooks.some(
              (h) => h.command && h.command.includes('eli-mode-tracker.js')
            )
        );
        assert.equal(
          hasTracker,
          true,
          'UserPromptSubmit should contain an ELI entry whose command references eli-mode-tracker.js'
        );

        assert.ok(settings.statusLine, 'settings.statusLine should be set');
        const statusCmd =
          typeof settings.statusLine === 'string'
            ? settings.statusLine
            : settings.statusLine.command || '';
        assert.ok(
          statusCmd.includes('eli-statusline.sh'),
          'statusLine.command should reference eli-statusline.sh; got: ' + statusCmd
        );

        // install.sh unconditionally cp's settings.json to settings.json.bak
        // before the merge — so the .bak must exist on disk after install.
        const bakPath = path.join(envBundle.claudeDir, 'settings.json.bak');
        assert.equal(
          fs.existsSync(bakPath),
          true,
          'settings.json.bak should exist after install'
        );

        // ---- flag lifecycle sanity ---------------------------------------
        // Run eli-activate.js from the INSTALLED location — running the source
        // copy would make __dirname diverge from the install's HOOKS_DIR, and
        // activate.js's stale-path detector would rewrite the statusLine away
        // from the managed path uninstall.sh looks for. Production always runs
        // the installed copy, so we mirror that.
        const installedActivateJs = path.join(installedHooksDir, 'eli-activate.js');
        const activateResult = spawnSync(process.execPath, [installedActivateJs], {
          env: envBundle.env,
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 15000,
        });
        assert.equal(
          activateResult.status,
          0,
          'eli-activate.js exit code should be 0; stderr: ' + (activateResult.stderr || '')
        );
        assert.equal(
          flagExists(envBundle.claudeDir),
          true,
          '.eli-active flag file should exist after activate'
        );
        assert.equal(
          readRawFlag(envBundle.claudeDir).trim(),
          'kid',
          '.eli-active flag content should be the default stage "kid"'
        );

        // ---- uninstall phase ---------------------------------------------
        const uninstallResult = spawnSync('bash', [UNINSTALL_SH], {
          env: envBundle.env,
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 60000,
        });
        assert.equal(
          uninstallResult.status,
          0,
          'uninstall.sh exit code should be 0; stderr: ' + (uninstallResult.stderr || '')
        );

        // All 5 hook files removed (directory itself may still exist — both are acceptable).
        for (const hook of HOOK_FILES) {
          const hookPath = path.join(installedHooksDir, hook);
          assert.equal(
            fs.existsSync(hookPath),
            false,
            'hook file should NOT exist after uninstall: ' + hookPath
          );
        }

        // .bak removed (uninstall.sh explicitly rm's $SETTINGS.bak).
        assert.equal(
          fs.existsSync(bakPath),
          false,
          'settings.json.bak should be removed after uninstall'
        );

        // .eli-active flag removed.
        assert.equal(
          flagExists(envBundle.claudeDir),
          false,
          '.eli-active flag file should be removed after uninstall'
        );

        // settings.json still parses, user key preserved, no ELI entries.
        const afterSettings = readSettingsJson(envBundle.claudeDir);
        assert.ok(afterSettings, 'settings.json should still parse after uninstall');
        assert.equal(
          afterSettings.someUserKey,
          'preserved',
          'pre-existing user key should still be present after uninstall'
        );

        // statusLine removed (it referenced the managed eli-statusline.sh).
        assert.equal(
          afterSettings.statusLine,
          undefined,
          'settings.statusLine should be removed after uninstall (it referenced eli-statusline.sh)'
        );

        // No ELI entries in hooks arrays. uninstall.sh also deletes empty
        // event keys and the empty hooks object, so both paths are valid:
        // either the arrays are gone or they contain no ELI entries.
        const hasAnyEliEntry = (event) => {
          const arr = afterSettings.hooks && afterSettings.hooks[event];
          if (!Array.isArray(arr)) return false;
          return arr.some(
            (entry) =>
              entry &&
              Array.isArray(entry.hooks) &&
              entry.hooks.some((h) => h.command && h.command.includes('eli'))
          );
        };
        assert.equal(
          hasAnyEliEntry('SessionStart'),
          false,
          'SessionStart should contain no ELI entries after uninstall'
        );
        assert.equal(
          hasAnyEliEntry('UserPromptSubmit'),
          false,
          'UserPromptSubmit should contain no ELI entries after uninstall'
        );
      } finally {
        envBundle.cleanup();
      }
    }
  );
}
