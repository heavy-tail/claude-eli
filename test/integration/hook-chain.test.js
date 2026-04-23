'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  makeIsolatedEnv,
  runActivate,
  runTracker,
  runStatusline,
  readRawFlag,
  flagExists,
  trackerAdditionalContext,
} = require('../helpers/isolated-env');

test('hook chain: activate → adult → statusline → off → statusline empty → OFF override', () => {
  const env = makeIsolatedEnv();
  try {
    // Step 1: SessionStart — runActivate should write the default flag ('kid')
    // and emit the SKILL.md body prefixed with 'ELI MODE ACTIVE'.
    const step1 = runActivate(env);
    assert.equal(step1.code, 0, 'activate exit code should be 0');
    assert.equal(
      readRawFlag(env.claudeDir).trim(),
      'kid',
      'flag should contain default stage "kid" after activate'
    );
    assert.ok(
      step1.stdout.includes('ELI MODE ACTIVE'),
      'activate stdout should contain "ELI MODE ACTIVE"'
    );

    // Step 2: UserPromptSubmit `/eli adult` — flag should flip to 'adult'
    // and the tracker should emit a STAGE CHANGE line in additionalContext.
    const step2 = runTracker(env, '/eli adult');
    assert.equal(
      readRawFlag(env.claudeDir).trim(),
      'adult',
      'flag should be "adult" after /eli adult'
    );
    assert.ok(
      (trackerAdditionalContext(step2.stdout) || '').includes('STAGE CHANGE:'),
      'tracker additionalContext should include "STAGE CHANGE:" on stage flip'
    );

    // Step 3: statusline reads the flag and prints the adult badge.
    // Skipped on Windows — runStatusline switches to PowerShell there, and
    // this suite pins the bash script behavior. Windows path is covered by
    // the Windows-specific integration test.
    if (process.platform !== 'win32') {
      const step3 = runStatusline(env);
      assert.ok(
        step3.stdout.includes('eli adult 🎓'),
        'statusline stdout should contain "eli adult 🎓" when flag is adult'
      );
    }

    // Step 4: `/eli off` — tracker unlinks the flag.
    runTracker(env, '/eli off');
    assert.equal(
      flagExists(env.claudeDir),
      false,
      'flag file should not exist after /eli off'
    );

    // Step 5: statusline with no flag emits empty stdout.
    // Skipped on Windows — see Step 3 comment.
    if (process.platform !== 'win32') {
      const step5 = runStatusline(env);
      assert.equal(
        step5.stdout,
        '',
        'statusline stdout should be empty when flag file is absent'
      );
    }

    // Step 6: v0.8.4 per-turn OFF override invariant — flag absent, any
    // prompt must still emit the "ELI MODE OFF" additionalContext so the
    // previously-injected SKILL.md system context is disarmed per turn.
    const step6 = runTracker(env, 'hello');
    assert.ok(
      (trackerAdditionalContext(step6.stdout) || '').includes('ELI MODE OFF'),
      'tracker additionalContext should include "ELI MODE OFF" when flag is absent'
    );
  } finally {
    env.cleanup();
  }
});
