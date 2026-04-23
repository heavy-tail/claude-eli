'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  makeIsolatedEnv,
  runTracker,
  runTrackerRawStdin,
  readRawFlag,
  flagExists,
  trackerAdditionalContext,
} = require('./helpers/isolated-env');

function seedFlag(envBundle, value) {
  fs.mkdirSync(envBundle.claudeDir, { recursive: true });
  fs.writeFileSync(path.join(envBundle.claudeDir, '.eli-active'), value);
}

describe('slash command stage writes', () => {
  const cases = [
    { cmd: '/eli baby', expect: 'baby' },
    { cmd: '/eli kid', expect: 'kid' },
    { cmd: '/eli adult', expect: 'adult' },
    { cmd: '/eli auto', expect: 'auto' },
  ];
  for (const c of cases) {
    test(`${c.cmd} writes flag ${c.expect}`, () => {
      const env = makeIsolatedEnv();
      try {
        const res = runTracker(env, c.cmd);
        assert.equal(res.code, 0);
        assert.equal(readRawFlag(env.claudeDir), c.expect);
      } finally {
        env.cleanup();
      }
    });
  }
});

test('/eli off removes the flag', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'kid');
    const res = runTracker(env, '/eli off');
    assert.equal(res.code, 0);
    assert.equal(flagExists(env.claudeDir), false);
  } finally {
    env.cleanup();
  }
});

test('/eli on writes default stage kid', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runTracker(env, '/eli on');
    assert.equal(res.code, 0);
    assert.equal(readRawFlag(env.claudeDir), 'kid');
  } finally {
    env.cleanup();
  }
});

test('/eli (bare) writes default stage kid', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runTracker(env, '/eli');
    assert.equal(res.code, 0);
    assert.equal(readRawFlag(env.claudeDir), 'kid');
  } finally {
    env.cleanup();
  }
});

describe('/eli easier and /eli harder progression', () => {
  const cases = [
    { from: 'adult', cmd: '/eli easier', expect: 'kid' },
    { from: 'kid', cmd: '/eli easier', expect: 'baby' },
    { from: 'baby', cmd: '/eli easier', expect: 'baby' },
    { from: 'baby', cmd: '/eli harder', expect: 'kid' },
    { from: 'kid', cmd: '/eli harder', expect: 'adult' },
    { from: 'adult', cmd: '/eli harder', expect: 'adult' },
    { from: 'auto', cmd: '/eli easier', expect: 'baby' },
    { from: 'auto', cmd: '/eli harder', expect: 'adult' },
  ];
  for (const c of cases) {
    test(`${c.cmd} from ${c.from} becomes ${c.expect}`, () => {
      const env = makeIsolatedEnv();
      try {
        seedFlag(env, c.from);
        const res = runTracker(env, c.cmd);
        assert.equal(res.code, 0);
        assert.equal(readRawFlag(env.claudeDir), c.expect);
      } finally {
        env.cleanup();
      }
    });
  }
});

test('/eli raw from kid keeps flag and emits empty stdout', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'kid');
    const res = runTracker(env, '/eli raw');
    assert.equal(res.code, 0);
    assert.equal(readRawFlag(env.claudeDir), 'kid');
    assert.equal(res.stdout, '', '/eli raw early-returns before any additionalContext emit');
  } finally {
    env.cleanup();
  }
});

test('/eli-glossary sub-skill leaves flag unchanged and emits ACTIVE context', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'adult');
    const res = runTracker(env, '/eli-glossary');
    assert.equal(res.code, 0);
    assert.equal(readRawFlag(env.claudeDir), 'adult');
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx && ctx.includes('ELI MODE ACTIVE'), 'sub-skill should still emit active reinforcement');
  } finally {
    env.cleanup();
  }
});

describe('natural-language deactivation deletes flag', () => {
  const prompts = ['stop eli please', 'please disable eli', 'normal mode'];
  for (const p of prompts) {
    test(`prompt "${p}" clears the flag`, () => {
      const env = makeIsolatedEnv();
      try {
        seedFlag(env, 'kid');
        const res = runTracker(env, p);
        assert.equal(res.code, 0);
        assert.equal(flagExists(env.claudeDir), false);
      } finally {
        env.cleanup();
      }
    });
  }
});

describe('natural-language activation writes default stage', () => {
  const prompts = ['eli mode', 'activate eli', 'talk like eli'];
  for (const p of prompts) {
    test(`prompt "${p}" activates default stage kid`, () => {
      const env = makeIsolatedEnv();
      try {
        const res = runTracker(env, p);
        assert.equal(res.code, 0);
        assert.equal(readRawFlag(env.claudeDir), 'kid');
      } finally {
        env.cleanup();
      }
    });
  }
});

test('STAGE CHANGE upgrade: baby → adult via /eli adult', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'baby');
    const res = runTracker(env, '/eli adult');
    assert.equal(res.code, 0);
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx, 'additionalContext should be emitted');
    assert.ok(
      ctx.startsWith('STAGE CHANGE: baby → adult (upgrade)'),
      'transition line should prefix the context'
    );
  } finally {
    env.cleanup();
  }
});

test('STAGE CHANGE switch: adult → auto via /eli auto', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'adult');
    const res = runTracker(env, '/eli auto');
    assert.equal(res.code, 0);
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx, 'additionalContext should be emitted');
    assert.ok(
      ctx.includes('STAGE CHANGE: adult → auto (switch)'),
      'auto involvement should be labeled switch'
    );
  } finally {
    env.cleanup();
  }
});

test('STAGE CHANGE activate: off → kid via /eli kid', () => {
  const env = makeIsolatedEnv();
  try {
    // No flag file pre-seeded — represents off state.
    const res = runTracker(env, '/eli kid');
    assert.equal(res.code, 0);
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx, 'additionalContext should be emitted');
    assert.ok(
      ctx.includes('STAGE CHANGE: off → kid (activate)'),
      'off-to-on transition labeled activate'
    );
  } finally {
    env.cleanup();
  }
});

test('v0.8.4 OFF override fires on arbitrary prompt when flag absent', () => {
  const env = makeIsolatedEnv();
  try {
    const res = runTracker(env, 'hello');
    assert.equal(res.code, 0);
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx, 'off override additionalContext should be emitted');
    assert.ok(ctx.includes('ELI MODE OFF'), 'off override must announce ELI MODE OFF');
  } finally {
    env.cleanup();
  }
});

test('v0.8.4 OFF override persists turn-over-turn when flag stays absent', () => {
  const env = makeIsolatedEnv();
  try {
    const r1 = runTracker(env, 'hello');
    assert.equal(r1.code, 0);
    const ctx1 = trackerAdditionalContext(r1.stdout);
    assert.ok(ctx1 && ctx1.includes('ELI MODE OFF'), 'first turn emits OFF override');

    const r2 = runTracker(env, 'how do I deploy');
    assert.equal(r2.code, 0);
    const ctx2 = trackerAdditionalContext(r2.stdout);
    assert.ok(ctx2 && ctx2.includes('ELI MODE OFF'), 'second turn also emits OFF override');
  } finally {
    env.cleanup();
  }
});

test('malformed JSON stdin: exit 0, stdout empty, flag unchanged', () => {
  const env = makeIsolatedEnv();
  try {
    seedFlag(env, 'kid');
    const res = runTrackerRawStdin(env, '{invalid json');
    assert.equal(res.code, 0);
    assert.equal(res.stdout, '');
    assert.equal(readRawFlag(env.claudeDir), 'kid');
  } finally {
    env.cleanup();
  }
});

test('undefined prompt (stdin JSON {}): exit 0, no flag mutation, OFF override emitted', () => {
  const env = makeIsolatedEnv();
  try {
    // runTracker(env, undefined) → JSON.stringify({prompt:undefined}) drops the key → '{}'.
    const res = runTracker(env, undefined);
    assert.equal(res.code, 0);
    // No flag was seeded, so still off.
    assert.equal(flagExists(env.claudeDir), false);
    // Prompt defaults to '' → flag absent → OFF override emitted.
    const ctx = trackerAdditionalContext(res.stdout);
    assert.ok(ctx && ctx.includes('ELI MODE OFF'), 'empty-prompt + no flag → OFF override');
  } finally {
    env.cleanup();
  }
});
